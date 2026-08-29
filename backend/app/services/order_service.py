from datetime import datetime, timezone

from fastapi import HTTPException

from app.repositories.order_repository import OrderRepository
from app.repositories.plan_repository import PlanRepository
from app.schemas.order import OrderRequest


class OrderService:
    def __init__(self, database) -> None:
        self._plan_repo = PlanRepository(database)
        self._order_repo = OrderRepository(database)

    async def create_order(self, order: OrderRequest) -> dict:
        plan = await self._plan_repo.find_by_plan_id(order.planId)

        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        new_order = {
            "planId": plan["planId"],
            "price": plan["price"],
            "currency": plan["currency"],
            "user": order.user,
            "address": order.address,
            "status": "PENDING",
            "createdAt": datetime.now(timezone.utc),
        }

        order_id = await self._order_repo.insert(new_order)

        return {
            "orderId": order_id,
            "planId": plan["planId"],
            "price": plan["price"],
            "currency": plan["currency"],
            "status": "PENDING",
        }
