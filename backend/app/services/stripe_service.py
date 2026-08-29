import stripe


class StripeService:
    @staticmethod
    def charge_with_stripe(
        payment_method_id: str,
        amount: float,
        currency: str,
        receipt_email: str | None = None,
        metadata: dict | None = None,
    ):
        amount_cents = int(round(amount * 100))
        params = {
            "amount": amount_cents,
            "currency": currency.lower(),
            "payment_method": payment_method_id,
            "confirm": True,
            "payment_method_types": ["card"],
        }

        if receipt_email:
            params["receipt_email"] = receipt_email

        if metadata:
            params["metadata"] = {
                k: str(v) for k, v in metadata.items() if v is not None
            }

        return stripe.PaymentIntent.create(**params)

    @staticmethod
    def retrieve_intent(gateway_payment_id: str):
        return stripe.PaymentIntent.retrieve(gateway_payment_id)

    @staticmethod
    def get_charge_id(intent) -> str | None:
        charge_id = intent.latest_charge
        if isinstance(charge_id, stripe.Charge):
            return charge_id.id
        return charge_id

    @staticmethod
    def map_intent_status(intent_status: str) -> str:
        if intent_status == "succeeded":
            return "SUCCESS"
        if intent_status == "processing":
            return "PROCESSING"
        if intent_status == "requires_action":
            return "REQUIRES_ACTION"
        return "FAILED"
