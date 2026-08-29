from bson import ObjectId


class PaymentRepository:
    def __init__(self, database) -> None:
        self._collection = database.payments

    async def find_by_id(self, payment_id: str) -> dict | None:
        if not ObjectId.is_valid(payment_id):
            return None
        return await self._collection.find_one({"_id": ObjectId(payment_id)})

    async def find_by_idempotency_key(self, idempotency_key: str) -> dict | None:
        return await self._collection.find_one({"idempotencyKey": idempotency_key})

    async def insert(self, payment: dict) -> str:
        result = await self._collection.insert_one(payment)
        return str(result.inserted_id)

    async def update(self, payment_id: str, fields: dict) -> None:
        await self._collection.update_one(
            {"_id": ObjectId(payment_id)},
            {"$set": fields},
        )
