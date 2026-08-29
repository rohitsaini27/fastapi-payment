from fastapi import APIRouter, Depends

from app.core.dependencies import get_database, get_mongodb_client
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService
from app.services.plan_service import PlanService
from app.schemas.order import OrderRequest
from app.schemas.payment import PaymentProcessRequest, PaymentRequest

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/db")
async def database_health(mongodb_client=Depends(get_mongodb_client)):
    await mongodb_client.admin.command("ping")
    return {"status": "ok", "database": "connected"}


@router.get("/api/plans")
async def get_plans(database=Depends(get_database)):
    return await PlanService(database).get_active_plans()


@router.post("/api/plans/seed")
async def seed_plans(database=Depends(get_database)):
    return await PlanService(database).seed_plans()


@router.post("/api/orders")
async def create_order(order: OrderRequest, database=Depends(get_database)):
    return await OrderService(database).create_order(order)


@router.post("/api/payment")
async def create_payment(
    payment: PaymentRequest, database=Depends(get_database)
):
    return await PaymentService(database).create_payment(payment)


@router.post("/api/payment/{payment_id}/process")
async def process_payment(
    payment_id: str,
    payment: PaymentProcessRequest,
    database=Depends(get_database),
):
    return await PaymentService(database).process_payment(payment_id, payment)


@router.post("/api/payment/{payment_id}/confirm")
async def confirm_payment_after_action(
    payment_id: str, database=Depends(get_database)
):
    return await PaymentService(database).confirm_payment_after_action(payment_id)


@router.get("/api/payment/{payment_id}")
async def get_payment(payment_id: str, database=Depends(get_database)):
    return await PaymentService(database).get_payment(payment_id)
