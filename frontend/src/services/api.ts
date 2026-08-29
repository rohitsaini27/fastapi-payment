import type { Plan } from "../types/plan";
import type { Payment, ProcessPaymentResponse } from "../types/payment";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getPlans(): Promise<Plan[]> {
  const response = await fetch(`${API_BASE_URL}/api/plans`);

  if (!response.ok) {
    throw new Error("Failed to fetch plans");
  }

  return response.json();
}

export async function createOrder(
  planId: string,
  user: object,
  address: object
) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      planId,
      user,
      address,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create order");
  }

  return response.json();
}

export async function createPayment(
  orderId: string,
  idempotencyKey: string
): Promise<Payment> {
  const response = await fetch(`${API_BASE_URL}/api/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      idempotencyKey,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create payment");
  }

  return response.json();
}

export async function processPayment(
  paymentId: string,
  paymentMethodId: string
): Promise<ProcessPaymentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/payment/${paymentId}/process`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentMethodId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to process payment");
  }

  return response.json();
}

export async function confirmPaymentAfterAction(
  paymentId: string
): Promise<ProcessPaymentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/payment/${paymentId}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to confirm payment");
  }

  return response.json();
}