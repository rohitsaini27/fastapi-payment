from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import AsyncMongoClient
from pymongo.server_api import ServerApi

from app.config.settings import settings
from app.services.plan_service import PlanService


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncMongoClient(
        settings.mongodb_uri,
        server_api=ServerApi(
            version="1",
            strict=True,
            deprecation_errors=True,
        ),
    )

    await client.admin.command("ping")

    app.mongodb_client = client
    app.database = client[settings.mongodb_database]

    await PlanService(app.database).seed_plans_if_needed()

    print("MongoDB connected successfully")

    yield

    await client.close()

    print("MongoDB connection closed")
