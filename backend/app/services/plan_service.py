import stripe

from app.repositories.plan_repository import PlanRepository


PLANS_TO_SEED = [
    {
        "planId": "PLAN_65",
        "name": "Unlimited Plan",
        "price": 65,
        "currency": "USD",
        "active": True,
    },
    {
        "planId": "PLAN_35",
        "name": "Basic Plan",
        "price": 35,
        "currency": "USD",
        "active": True,
    },
]


class PlanService:
    def __init__(self, database) -> None:
        self._repo = PlanRepository(database)

    async def seed_plans_if_needed(self) -> None:
        for plan in PLANS_TO_SEED:
            if not await self._repo.exists_by_plan_id(plan["planId"]):
                await self._repo.insert(plan)

    async def seed_plans(self) -> dict:
        await self.seed_plans_if_needed()
        return {"message": "Plans seeded (missing plans only)"}

    async def get_active_plans(self) -> list[dict]:
        return await self._repo.find_active()
