from pydantic import BaseModel


class OrderRequest(BaseModel):
    planId: str
    user: dict
    address: dict
