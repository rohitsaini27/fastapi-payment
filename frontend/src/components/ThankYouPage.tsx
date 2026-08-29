import { useState } from "react";
import type { Plan } from "../types/plan";
import type { Payment } from "../types/payment";
import type { UserDetails } from "../types/user";

type Props = {
  user: UserDetails;
  plan: Plan | null;
  payment: Payment;
  gatewayPaymentId: string | null;
  gatewayChargeId: string | null;
  onStartOver: () => void;
};

function ThankYouPage({
  user,
  plan,
  payment,
  gatewayPaymentId,
  gatewayChargeId,
  onStartOver,
}: Props) {
  const [showTechnical, setShowTechnical] = useState(false);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="thank-you">
      <div className="thank-you__icon" aria-hidden>
        <svg viewBox="0 0 52 52" fill="none">
          <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" />
          <path
            d="M14 27l8 8 16-18"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="thank-you__title">Thank you, {firstName}!</h1>
      <p className="thank-you__subtitle">Payment Successful!</p>
      <p className="thank-you__message">
        Your order is confirmed. A receipt may be sent to{" "}
        <strong>{user.email}</strong>.
      </p>

      <div className="thank-you__receipt">
        <div className="thank-you__row">
          <span className="thank-you__label">Customer</span>
          <span className="thank-you__value">{user.name}</span>
        </div>
        {plan && (
          <div className="thank-you__row">
            <span className="thank-you__label">Plan</span>
            <span className="thank-you__value">{plan.name}</span>
          </div>
        )}
        <div className="thank-you__row">
          <span className="thank-you__label">Amount</span>
          <span className="thank-you__value thank-you__value--amount">
            {payment.currency} {payment.amount}
          </span>
        </div>
        <div className="thank-you__row">
          <span className="thank-you__label">Order</span>
          <span className="thank-you__value">
            <code>{payment.orderId}</code>
          </span>
        </div>
      </div>

      {(gatewayPaymentId || gatewayChargeId) && (
        <div className="thank-you__technical">
          <button
            type="button"
            className="thank-you__toggle"
            onClick={() => setShowTechnical((v) => !v)}
          >
            {showTechnical ? "Hide" : "Show"} transaction details
          </button>
          {showTechnical && (
            <div className="thank-you__technical-body">
              {gatewayPaymentId && (
                <p>
                  Stripe PaymentIntent: <code>{gatewayPaymentId}</code>
                </p>
              )}
              {gatewayChargeId && (
                <p>
                  Stripe Charge: <code>{gatewayChargeId}</code>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <button type="button" className="btn btn--primary" onClick={onStartOver}>
        Choose another plan
      </button>
    </div>
  );
}

export default ThankYouPage;
