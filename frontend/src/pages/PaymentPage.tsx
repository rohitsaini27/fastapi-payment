import { useEffect, useState } from "react";
import {
  createOrder,
  createPayment,
  getPlans,
  getPaymentStatus,
} from "../services/api";
import type { Plan } from "../types/plan";
import type { Payment } from "../types/payment";
import type { UserDetails } from "../types/user";

import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import StripePaymentForm from "../components/stripePaymentForm";
import ThankYouPage from "../components/ThankYouPage";
import PaymentFailedPage from "../components/PaymentFailedPage";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

type Step = "plans" | "details" | "checkout" | "result";

const emptyUser: UserDetails = {
  name: "",
  email: "",
  phone: "",
  city: "",
  country: "",
};

function PaymentPage() {
  const [step, setStep] = useState<Step>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails>(emptyUser);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [gatewayPaymentId, setGatewayPaymentId] = useState<string | null>(
    null
  );
  const [gatewayChargeId, setGatewayChargeId] = useState<string | null>(null);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  const handleChoosePlan = (plan: Plan) => {
    setError(null);
    setResult(null);
    setSelectedPlan(plan);
    setStep("details");
  };

  const handleUserDetailsChange = (
    field: keyof UserDetails,
    value: string
  ) => {
    setUserDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    try {
      setError(null);
      setProcessing(true);

      const order = await createOrder(
        selectedPlan.planId,
        {
          name: userDetails.name,
          email: userDetails.email,
          phone: userDetails.phone,
        },
        {
          city: userDetails.city,
          country: userDetails.country,
        }
      );

      setOrderId(order.orderId);

      const idempotencyKey = crypto.randomUUID();
      const newPayment = await createPayment(order.orderId, idempotencyKey);

      setPayment(newPayment);
      setStep("checkout");
    } catch (err) {
      console.error("Payment flow failed:", err);
      setError("Failed to create order or payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!orderId) return;

    try {
      setError(null);
      setResult(null);
      setProcessing(true);
      setGatewayPaymentId(null);
      setGatewayChargeId(null);

      const idempotencyKey = crypto.randomUUID();
      const newPayment = await createPayment(orderId, idempotencyKey);

      setPayment(newPayment);
      setStep("checkout");
    } catch (err) {
      console.error("Retry failed:", err);
      setError("Failed to create new payment attempt");
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!payment) return;

    try {
      setProcessing(true);
      setError(null);

      const updated = await getPaymentStatus(payment.paymentId);

      if (updated.status === "SUCCESS") {
        setGatewayPaymentId(updated.gatewayPaymentId ?? null);
        setGatewayChargeId(updated.gatewayChargeId ?? null);
        setResult("Payment Successful!");
        setStep("result");
      } else if (updated.status === "FAILED") {
        setResult("Payment Failed");
        setStep("result");
      } else if (updated.status === "PROCESSING") {
        setResult("Payment is still processing...");
        setStep("result");
      } else {
        setResult(`Payment status: ${updated.status}`);
        setStep("result");
      }
    } catch (err) {
      console.error("Status check failed:", err);
      setError("Failed to check payment status");
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentSuccess = (
    stripePaymentId?: string,
    stripeChargeId?: string
  ) => {
    setGatewayPaymentId(stripePaymentId ?? null);
    setGatewayChargeId(stripeChargeId ?? null);
    setResult("Payment Successful!");
    setStep("result");
  };

  const handlePaymentFailed = () => {
    setResult("Payment Failed");
    setStep("result");
  };

  const handleStartOver = () => {
    setStep("plans");
    setSelectedPlan(null);
    setUserDetails(emptyUser);
    setPayment(null);
    setResult(null);
    setOrderId(null);
    setGatewayPaymentId(null);
    setGatewayChargeId(null);
    setError(null);
  };

  if (loading) {
    return <p className="loading-text">Loading plans...</p>;
  }

  return (
    <div
      className={`payment-page${
        step === "result" && result === "Payment Successful!"
          ? " payment-page--thankyou"
          : ""
      }`}
    >
      {step === "plans" && (
        <>
          <h1>Choose a Plan</h1>
          <p className="payment-page__subtitle">
            Select a plan, enter your details, then pay securely with Stripe
          </p>

          <div className="plan-grid">
            {plans.map((plan) => (
              <div key={plan.planId} className="plan-card">
                <h2>{plan.name}</h2>
                <p className="plan-card__price">
                  {plan.currency} {plan.price}
                </p>
                <button
                  className="btn btn--primary"
                  onClick={() => handleChoosePlan(plan)}
                >
                  Choose Plan
                </button>
              </div>
            ))}
          </div>

          {plans.length === 0 && (
            <p className="loading-text">No plans available. Restart backend.</p>
          )}
        </>
      )}

      {step === "details" && selectedPlan && (
        <div className="checkout-card">
          <h2>Your Details</h2>
          <p className="checkout-card__meta">
            Plan: <strong>{selectedPlan.name}</strong> — {selectedPlan.currency}{" "}
            {selectedPlan.price}
          </p>

          <form className="user-form" onSubmit={handleContinueToPayment}>
            <label className="form-field">
              Full name
              <input
                type="text"
                required
                value={userDetails.name}
                onChange={(e) => handleUserDetailsChange("name", e.target.value)}
                placeholder="Rohit Sharma"
              />
            </label>

            <label className="form-field">
              Email
              <input
                type="email"
                required
                value={userDetails.email}
                onChange={(e) =>
                  handleUserDetailsChange("email", e.target.value)
                }
                placeholder="you@example.com"
              />
            </label>

            <label className="form-field">
              Phone
              <input
                type="tel"
                required
                value={userDetails.phone}
                onChange={(e) =>
                  handleUserDetailsChange("phone", e.target.value)
                }
                placeholder="+91 98765 43210"
              />
            </label>

            <label className="form-field">
              City
              <input
                type="text"
                required
                value={userDetails.city}
                onChange={(e) => handleUserDetailsChange("city", e.target.value)}
                placeholder="Delhi"
              />
            </label>

            <label className="form-field">
              Country
              <input
                type="text"
                required
                value={userDetails.country}
                onChange={(e) =>
                  handleUserDetailsChange("country", e.target.value)
                }
                placeholder="India"
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setStep("plans")}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn--primary btn--inline"
                disabled={processing}
              >
                {processing ? "Creating order..." : "Continue to Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "checkout" && payment && (
        <div className="checkout-card">
          <h2>Complete Payment</h2>
          <p className="checkout-card__amount">
            {payment.currency} {payment.amount}
          </p>
          <p className="checkout-card__meta">
            Customer: <strong>{userDetails.name}</strong> ({userDetails.email})
          </p>
          <p className="checkout-card__meta">
            Order: <code>{payment.orderId}</code>
          </p>
          <p className="checkout-card__meta" style={{ marginBottom: 20 }}>
            Payment: <code>{payment.paymentId}</code>
          </p>

          <Elements stripe={stripePromise}>
            <StripePaymentForm
              paymentId={payment.paymentId}
              amount={payment.amount}
              currency={payment.currency}
              onSuccess={handlePaymentSuccess}
              onFailed={handlePaymentFailed}
            />
          </Elements>
        </div>
      )}

      {step === "result" && result === "Payment Successful!" && payment && (
        <ThankYouPage
          user={userDetails}
          plan={selectedPlan}
          payment={payment}
          gatewayPaymentId={gatewayPaymentId}
          gatewayChargeId={gatewayChargeId}
          onStartOver={handleStartOver}
        />
      )}

      {step === "result" && result === "Payment Failed" && (
        <PaymentFailedPage
          onRetry={handleRetryPayment}
          processing={processing}
        />
      )}

      {step === "result" &&
        result !== "Payment Successful!" &&
        result !== "Payment Failed" && (
        <div className="result-card result-card--processing">
          <h2>{result}</h2>
          {result === "Payment is still processing..." && (
            <button
              className="btn btn--secondary"
              onClick={handleCheckStatus}
              disabled={processing}
            >
              {processing ? "Checking..." : "Check Status"}
            </button>
          )}
        </div>
      )}

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
export default PaymentPage;
