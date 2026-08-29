type Props = {
  onRetry: () => void;
  processing: boolean;
};

function PaymentFailedPage({ onRetry, processing }: Props) {
  return (
    <div className="thank-you thank-you--failed">
      <div className="thank-you__icon thank-you__icon--failed" aria-hidden>
        <svg viewBox="0 0 52 52" fill="none">
          <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" />
          <path
            d="M18 18l16 16M34 18L18 34"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h1 className="thank-you__title">Payment Failed</h1>
      <p className="thank-you__message">
        Your card was not charged. You can try again with the same order.
      </p>

      <button
        type="button"
        className="btn btn--primary"
        onClick={onRetry}
        disabled={processing}
      >
        {processing ? "Creating new attempt..." : "Try Again"}
      </button>
    </div>
  );
}

export default PaymentFailedPage;
