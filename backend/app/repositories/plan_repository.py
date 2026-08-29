class PlanRepository:
    def __init__(self, database) -> None:
        self._collection = database.plans

    async def find_active(self) -> list[dict]:
        plans = []
        async for plan in self._collection.find({"active": True}):
            plan["_id"] = str(plan["_id"])
            plans.append(plan)
        return plans

    async def find_by_plan_id(self, plan_id: str) -> dict | None:
        return await self._collection.find_one({"planId": plan_id, "active": True})

    async def exists_by_plan_id(self, plan_id: str) -> bool:
        doc = await self._collection.find_one({"planId": plan_id})
        return doc is not None

    async def insert(self, plan: dict) -> None:
        await self._collection.insert_one(plan)
