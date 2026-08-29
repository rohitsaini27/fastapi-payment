from bson import ObjectId


class OrderRepository:
    def __init__(self, database) -> None:
        self._collection = database.orders

    async def find_by_id(self, order_id: str) -> dict | None:
        if not ObjectId.is_valid(order_id):
            return None
        return await self._collection.find_one({"_id": ObjectId(order_id)})

    async def insert(self, order: dict) -> str:
        result = await self._collection.insert_one(order)
        return str(result.inserted_id)

    async def mark_paid(self, order_id: str, updated_at) -> None:
        await self._collection.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"status": "PAID", "updatedAt": updated_at}},
        )
