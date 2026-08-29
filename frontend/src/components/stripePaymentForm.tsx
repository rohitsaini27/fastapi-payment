import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { confirmPaymentAfterAction, processPayment } from "../services/api";

type Props = {
  paymentId: string;
  amount: number;
  currency: string;
  onSuccess: (gatewayPaymentId?: string, gatewayChargeId?: string) => void;
  onFailed: () => void;
};

const cardStyle = {
  style: {
    base: {
      fontSize: "16px",
      color: "#08060d",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444" },
  },
};

function StripePaymentForm({
  paymentId,
  amount,
  currency,
  onSuccess,
  onFailed,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card form not ready");
      setProcessing(false);
      return;
    }

    const { error: stripeError, paymentMethod } =
      await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

    if (stripeError || !paymentMethod) {
      setError(stripeError?.message ?? "Card error");
      setProcessing(false);
      return;
    }

    try {
      const response = await processPayment(paymentId, paymentMethod.id);

      if (response.status === "SUCCESS") {
        onSuccess(
          response.gatewayPaymentId ?? undefined,
          response.gatewayChargeId ?? undefined
        );
        return;
      }

      if (
        response.status === "REQUIRES_ACTION" &&
        response.clientSecret
      ) {
        setError(null);
        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(response.clientSecret, {
            payment_method: paymentMethod.id,
          });

        if (confirmError) {
          setError(confirmError.message ?? "Authentication failed");
          onFailed();
          return;
        }

        if (paymentIntent?.status === "succeeded") {
          const confirmed = await confirmPaymentAfterAction(paymentId);
          if (confirmed.status === "SUCCESS") {
            onSuccess(
              confirmed.gatewayPaymentId ?? undefined,
              confirmed.gatewayChargeId ?? undefined
            );
          } else {
            setError("Payment could not be confirmed");
            onFailed();
          }
          return;
        }

        setError("Payment authentication incomplete");
        onFailed();
        return;
      }

      onFailed();
    } catch {
      setError("Payment failed");
      onFailed();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 8 }}>
        Card details (secured by Stripe)
      </p>
      <div className="stripe-card-box">
        <CardElement options={cardStyle} />
      </div>

      <button
        className="btn btn--primary"
        disabled={processing || !stripe}
        onClick={handlePay}
      >
        {processing ? "Processing..." : `Pay ${currency} ${amount}`}
      </button>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}

export default StripePaymentForm;
