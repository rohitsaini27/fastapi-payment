from datetime import datetime, timezone

import stripe
from bson import ObjectId
from fastapi import HTTPException

from app.repositories.order_repository import OrderRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentProcessRequest, PaymentRequest
from app.services.stripe_service import StripeService


class PaymentService:
    def __init__(self, database) -> None:
        self._payment_repo = PaymentRepository(database)
        self._order_repo = OrderRepository(database)
        self._stripe = StripeService()

    async def create_payment(self, payment: PaymentRequest) -> dict:
        if not ObjectId.is_valid(payment.orderId):
            raise HTTPException(status_code=400, detail="Invalid orderId")

        order = await self._order_repo.find_by_id(payment.orderId)

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order["status"] == "PAID":
            raise HTTPException(status_code=400, detail="Order already paid")

        existing_payment = await self._payment_repo.find_by_idempotency_key(
            payment.idempotencyKey
        )

        if existing_payment:
            return {
                "paymentId": str(existing_payment["_id"]),
                "orderId": existing_payment["orderId"],
                "amount": existing_payment["amount"],
                "currency": existing_payment["currency"],
                "status": existing_payment["status"],
            }

        now = datetime.now(timezone.utc)

        new_payment = {
            "orderId": payment.orderId,
            "idempotencyKey": payment.idempotencyKey,
            "amount": order["price"],
            "currency": order["currency"],
            "status": "PENDING",
            "gateway": None,
            "gatewayPaymentId": None,
            "createdAt": now,
            "updatedAt": now,
        }

        payment_id = await self._payment_repo.insert(new_payment)

        return {
            "paymentId": payment_id,
            "orderId": payment.orderId,
            "amount": order["price"],
            "currency": order["currency"],
            "status": "PENDING",
        }

    async def get_payment(self, payment_id: str) -> dict:
        if not ObjectId.is_valid(payment_id):
            raise HTTPException(status_code=400, detail="Invalid paymentId")

        payment = await self._payment_repo.find_by_id(payment_id)

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        return {
            "paymentId": str(payment["_id"]),
            "orderId": payment["orderId"],
            "amount": payment["amount"],
            "currency": payment["currency"],
            "status": payment["status"],
            "gatewayPaymentId": payment.get("gatewayPaymentId"),
            "gatewayChargeId": payment.get("gatewayChargeId"),
        }

    async def process_payment(
        self, payment_id: str, payment: PaymentProcessRequest
    ) -> dict:
        if not ObjectId.is_valid(payment_id):
            raise HTTPException(status_code=400, detail="Invalid paymentId")

        existing_payment = await self._payment_repo.find_by_id(payment_id)

        if not existing_payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        if existing_payment["status"] != "PENDING":
            return {
                "paymentId": payment_id,
                "status": existing_payment["status"],
            }

        now = datetime.now(timezone.utc)

        await self._payment_repo.update(
            payment_id,
            {
                "status": "PROCESSING",
                "gateway": "STRIPE",
                "updatedAt": now,
            },
        )

        order = await self._order_repo.find_by_id(existing_payment["orderId"])
        user = order.get("user", {}) if order else {}
        stripe_metadata = {
            "orderId": existing_payment["orderId"],
            "paymentId": payment_id,
            "planId": order.get("planId", "") if order else "",
            "userName": user.get("name", ""),
            "userEmail": user.get("email", ""),
            "userPhone": user.get("phone", ""),
        }

        try:
            intent = self._stripe.charge_with_stripe(
                payment.paymentMethodId,
                existing_payment["amount"],
                existing_payment["currency"],
                receipt_email=user.get("email"),
                metadata=stripe_metadata,
            )
        except stripe.error.CardError:
            await self._payment_repo.update(
                payment_id,
                {"status": "FAILED", "updatedAt": datetime.now(timezone.utc)},
            )
            return {
                "paymentId": payment_id,
                "orderId": existing_payment["orderId"],
                "status": "FAILED",
            }
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e

        return await self._apply_intent_to_payment(
            payment_id,
            existing_payment["orderId"],
            intent,
        )

    async def confirm_payment_after_action(self, payment_id: str) -> dict:
        if not ObjectId.is_valid(payment_id):
            raise HTTPException(status_code=400, detail="Invalid paymentId")

        existing_payment = await self._payment_repo.find_by_id(payment_id)

        if not existing_payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        if existing_payment["status"] == "SUCCESS":
            return {
                "paymentId": payment_id,
                "orderId": existing_payment["orderId"],
                "status": "SUCCESS",
                "gatewayPaymentId": existing_payment.get("gatewayPaymentId"),
                "gatewayChargeId": existing_payment.get("gatewayChargeId"),
            }

        if existing_payment["status"] not in ["REQUIRES_ACTION", "PROCESSING"]:
            return {
                "paymentId": payment_id,
                "orderId": existing_payment["orderId"],
                "status": existing_payment["status"],
            }

        gateway_payment_id = existing_payment.get("gatewayPaymentId")
        if not gateway_payment_id:
            raise HTTPException(
                status_code=400,
                detail="No Stripe PaymentIntent linked to this payment",
            )

        try:
            intent = self._stripe.retrieve_intent(gateway_payment_id)
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e

        return await self._apply_intent_to_payment(
            payment_id,
            existing_payment["orderId"],
            intent,
        )

    async def _apply_intent_to_payment(
        self, payment_id: str, order_id: str, intent
    ) -> dict:
        payment_status = self._stripe.map_intent_status(intent.status)
        charge_id = (
            self._stripe.get_charge_id(intent)
            if payment_status == "SUCCESS"
            else None
        )

        update_fields = {
            "status": payment_status,
            "gatewayPaymentId": intent.id,
            "updatedAt": datetime.now(timezone.utc),
        }

        if charge_id:
            update_fields["gatewayChargeId"] = charge_id

        await self._payment_repo.update(payment_id, update_fields)

        if payment_status == "SUCCESS":
            await self._order_repo.mark_paid(
                order_id, datetime.now(timezone.utc)
            )

        response = {
            "paymentId": payment_id,
            "orderId": order_id,
            "status": payment_status,
            "gatewayPaymentId": intent.id,
            "gatewayChargeId": charge_id,
        }

        if payment_status == "REQUIRES_ACTION":
            response["clientSecret"] = intent.client_secret

        return response
