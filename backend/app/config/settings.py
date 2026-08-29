import os

import stripe
from dotenv import load_dotenv

load_dotenv()


class Settings:
    mongodb_uri: str
    mongodb_database: str
    stripe_secret_key: str
    cors_origins: list[str]

    def __init__(self) -> None:
        self.mongodb_uri = os.getenv("MONGODB_URI", "")
        self.mongodb_database = os.getenv("MONGODB_DATABASE", "")
        self.stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "")
        self.cors_origins = ["http://localhost:5173"]

        if not self.mongodb_uri:
            raise RuntimeError("MONGODB_URI is not set")
        if not self.mongodb_database:
            raise RuntimeError("MONGODB_DATABASE is not set")
        if not self.stripe_secret_key:
            raise RuntimeError("STRIPE_SECRET_KEY is not set")

        stripe.api_key = self.stripe_secret_key


settings = Settings()
