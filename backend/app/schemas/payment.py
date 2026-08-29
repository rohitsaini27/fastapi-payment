from pydantic import BaseModel


class PaymentRequest(BaseModel):
    orderId: str
    idempotencyKey: str


class PaymentProcessRequest(BaseModel):
    paymentMethodId: str
