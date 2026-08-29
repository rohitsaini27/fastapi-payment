export interface Payment {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    status: string;
    gatewayPaymentId?: string | null;
    gatewayChargeId?: string | null;
  }
  
export interface ProcessPaymentResponse {
    paymentId: string;
    orderId: string;
    status: string;
    gatewayPaymentId?: string | null;
    gatewayChargeId?: string | null;
    clientSecret?: string | null;
}