# Project Context — Payment System (FastAPI + React + MongoDB + Stripe)

Use this document to understand what was built, why, and how everything connects. This is a **learning project** for understanding real payment backend architecture (not a production-ready SaaS).

---

## 1. Goal

Build a **customer checkout flow** from scratch:

1. User picks a subscription plan
2. User enters details (name, email, phone, address)
3. User pays with card via Stripe
4. Backend owns pricing and payment state
5. Success shows a Thank You page with receipt info

**Key principle:** Frontend is **untrusted**. Prices, amounts, and plan data always come from **MongoDB on the backend**, never from the client.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | FastAPI (Python) + Uvicorn |
| Database | MongoDB Atlas (async via `pymongo` AsyncMongoClient) |
| Payment gateway | Stripe (test mode) |
| Stripe frontend | `@stripe/stripe-js`, `@stripe/react-stripe-js` |

---

## 3. Project Structure

```
fastapi/
├── backend/
│   ├── main.py                    # Entry: re-exports app (uvicorn main:app)
│   ├── app/
│   │   ├── main.py                # FastAPI app factory + CORS + routers
│   │   ├── config/settings.py     # Env vars, Stripe key setup
│   │   ├── core/
│   │   │   ├── database.py        # Mongo lifespan connect/disconnect
│   │   │   └── dependencies.py    # get_database, get_mongodb_client
│   │   ├── schemas/               # Pydantic request models
│   │   │   ├── order.py
│   │   │   └── payment.py
│   │   ├── repositories/          # MongoDB queries only
│   │   │   ├── plan_repository.py
│   │   │   ├── order_repository.py
│   │   │   └── payment_repository.py
│   │   ├── services/              # Business logic
│   │   │   ├── plan_service.py
│   │   │   ├── order_service.py
│   │   │   ├── payment_service.py
│   │   │   └── stripe_service.py
│   │   └── api/v1/router.py       # HTTP routes (thin — call services)
│   ├── .env
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── pages/PaymentPage.tsx
│   │   ├── components/
│   │   ├── services/api.ts
│   │   └── types/
│   └── .env
└── PROJECT_CONTEXT.md
```

**Run backend:** `cd backend` → `uvicorn main:app --reload` (same as before)

---

## 4. Core Architecture — Order ≠ Payment

This is the most important design decision.

### Order (business intent)
- Represents **what the customer wants to buy**
- Created when user submits details after choosing a plan
- States: `PENDING` → `PAID` (only on successful payment)
- On payment failure, order **stays PENDING** (user can retry)

### Payment (money collection attempt)
- Represents **one attempt to collect money** for an order
- States: `PENDING` → `PROCESSING` → `SUCCESS` | `FAILED` | `REQUIRES_ACTION`
- One order can have **multiple payment records** (retry = new payment + new idempotency key)
- Amount is copied from order at creation time (from DB, not frontend)

```
Order (1) ──has many──▶ Payment attempts (N)
```

---

## 5. MongoDB Collections

### `plans`
Seeded on backend startup if missing.

| Field | Example |
|-------|---------|
| planId | `PLAN_65`, `PLAN_35` |
| name | `Unlimited Plan`, `Basic Plan` |
| price | `65`, `35` |
| currency | `USD` |
| active | `true` |

### `orders`
| Field | Example |
|-------|---------|
| planId | `PLAN_35` |
| price | `35` (copied from plan at order time) |
| currency | `USD` |
| user | `{ name, email, phone }` |
| address | `{ city, country }` |
| status | `PENDING` / `PAID` |
| createdAt | UTC datetime |

### `payments`
| Field | Example |
|-------|---------|
| orderId | MongoDB ObjectId string |
| idempotencyKey | UUID from frontend (one per attempt) |
| amount | from order.price |
| currency | from order.currency |
| status | `PENDING` / `PROCESSING` / `SUCCESS` / `FAILED` |
| gateway | `STRIPE` (set when processing starts) |
| gatewayPaymentId | Stripe PaymentIntent id `pi_...` |
| gatewayChargeId | Stripe Charge id `ch_...` |
| createdAt, updatedAt | UTC datetime |

---

## 6. Backend API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Basic health check |
| GET | `/health/db` | MongoDB ping |
| GET | `/api/plans` | List active plans |
| POST | `/api/plans/seed` | Manually seed missing plans |
| POST | `/api/orders` | Create order (price from DB) |
| POST | `/api/payment` | Create payment attempt for order |
| POST | `/api/payment/{id}/process` | Charge via Stripe |
| POST | `/api/payment/{id}/confirm` | Finalize after 3DS (`requires_action`) |
| GET | `/api/payment/{id}` | Get payment status |

### POST `/api/orders` body
```json
{
  "planId": "PLAN_35",
  "user": { "name": "Rohit Saini", "email": "rohit@example.com", "phone": "+91..." },
  "address": { "city": "Delhi", "country": "India" }
}
```

### POST `/api/payment` body
```json
{
  "orderId": "<mongo order _id>",
  "idempotencyKey": "<uuid v4>"
}
```

### POST `/api/payment/{id}/process` body
```json
{
  "paymentMethodId": "pm_..."
}
```

**Backend never receives card number.** Only the Stripe payment method reference.

---

## 7. Frontend Checkout Flow (4 steps)

```
Step 1: plans     → GET /api/plans, user picks Unlimited ($65) or Basic ($35)
Step 2: details   → Form: name, email, phone, city, country
Step 3: checkout  → POST /api/orders → POST /api/payment → Stripe card form
Step 4: result    → ThankYouPage (success) or PaymentFailedPage (retry)
```

### State in `PaymentPage.tsx`
- `step`: `"plans" | "details" | "checkout" | "result"`
- `selectedPlan`, `userDetails`, `payment`, `orderId`
- `gatewayPaymentId`, `gatewayChargeId` (from Stripe after charge)

### Retry on failure
- Same `orderId`, new `crypto.randomUUID()` idempotency key
- New payment record created, user goes back to checkout step

---

## 8. Stripe Integration

### Tokenization (frontend — Stripe handles this)
1. User types card in `CardElement` (Stripe iframe — card never hits our server)
2. On Pay click: `stripe.createPaymentMethod({ type: "card", card: cardElement })`
3. Returns `paymentMethod.id` = `pm_...` (equivalent to company's "payment token")
4. Frontend sends only `paymentMethodId` to backend

### Card validation errors
- Invalid/incomplete card → **Stripe** validates (red text in CardElement + error banner)
- Backend is **not called** until tokenization succeeds

### Charging (backend)
```python
stripe.PaymentIntent.create(
    amount=amount_cents,           # from MongoDB payment record
    currency="usd",
    payment_method=payment_method_id,
    confirm=True,
    receipt_email=user_email,      # from order.user.email
    metadata={                     # visible in Stripe Dashboard
        "orderId", "paymentId", "planId",
        "userName", "userEmail", "userPhone"
    }
)
```

### ID mapping (company vs this project)

| Concept | This project | When created |
|---------|--------------|--------------|
| Payment token | `paymentMethodId` (`pm_...`) | Frontend tokenization |
| Customer token | Not implemented | Would be `cus_...` if Stripe Customer created |
| Our payment ID | MongoDB `_id` on payments | POST /api/payment |
| Our order ID | MongoDB `_id` on orders | POST /api/orders |
| Gateway transaction | `gatewayPaymentId` = `pi_...` | After Stripe charge |
| Actual money movement | `gatewayChargeId` = `ch_...` | Same moment as pi_ |

### Test cards
```
# No 3DS — succeeds immediately
4242 4242 4242 4242

# Requires 3DS authentication (requires_action flow)
4000 0025 0000 3155
```
Any future expiry, any CVC, any ZIP for test cards.

### 3D Secure (`requires_action`) flow
1. Backend creates PaymentIntent with `confirm=True`
2. If Stripe returns `requires_action` → backend responds with `status: REQUIRES_ACTION` + `clientSecret`
3. Frontend calls `stripe.confirmCardPayment(clientSecret)` → user completes bank OTP/modal
4. Frontend calls `POST /api/payment/{id}/confirm` → backend retrieves PaymentIntent from Stripe and updates DB
5. Order marked `PAID` only after Stripe reports `succeeded`

**Never trust frontend alone for success** — confirm endpoint re-checks with Stripe.

---

## 9. Where User Data Appears

| Location | What's stored |
|----------|---------------|
| MongoDB `orders.user` | name, email, phone — full source of truth for "who bought what" |
| MongoDB `payments` | links to orderId + Stripe IDs |
| Stripe Dashboard | receipt_email + metadata (userName, userEmail, etc.) on each PaymentIntent |
| Thank You page | Shows customer name, plan, amount, order id; optional toggle for pi_/ch_ ids |

To query "how much did user X pay": filter `orders` by `user.email`, join with `payments` where status = SUCCESS.

---

## 10. Security & Trust Model

- Frontend sends: `planId`, user info, `paymentMethodId`, `idempotencyKey`
- Frontend does **NOT** send: price, amount, currency for charging
- Backend reads amount from `payments` collection (copied from order at payment creation)
- CORS allows only `http://localhost:5173`
- Fake webhook endpoint requires `x_webhook_secret` header matching `WEBHOOK_SECRET`

---

## 11. Idempotency

- Each payment attempt gets a unique `idempotencyKey` (UUID from frontend)
- If same key is sent twice to POST `/api/payment`, backend returns existing payment (no duplicate)
- Retry after failure uses a **new** idempotency key → new payment document

---

## 12. Environment Variables

### backend/.env
```
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=<dbname>
STRIPE_SECRET_KEY=sk_test_...
WEBHOOK_SECRET=<any shared secret for fake webhook>
```

### frontend/.env
```
VITE_API_BASE_URL=http://localhost:8000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 13. How to Run

```bash
# Backend
cd backend
venv\Scripts\activate          # Windows
uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173`

Plans auto-seed on backend startup. Swagger docs at `http://localhost:8000/docs`

---

## 14. UI Components

| Component | Role |
|-----------|------|
| `PaymentPage` | Orchestrates full multi-step flow |
| `StripePaymentForm` | Card input + createPaymentMethod + call process API |
| `ThankYouPage` | Personalized success: "Thank you, {name}!", receipt summary, optional Stripe IDs |
| `PaymentFailedPage` | Failure message + Try Again button |

---

## 15. What Was Built vs What's NOT Done

### Built ✅
- Two plans with backend-driven pricing
- User details form before payment
- Order / Payment separation with state machines
- Stripe tokenization + synchronous charge
- Payment retry on failure
- User metadata sent to Stripe
- Thank You page with receipt
- Idempotency on payment creation
- Fake webhook endpoint (for learning async flows — tested with manual calls)
- GET payment status endpoint

### Not done / production gaps ❌
- Real **Stripe webhooks** (payment_intent.succeeded etc.)
- Stripe Customer (`cus_...`) / saved cards
- User authentication / login
- Admin panel
- Email receipts from our backend (Stripe may send receipt if enabled)
- Production CORS / deployment
- requirements.txt pinned dependencies
- Renaming `paymentMethodId` → `paymentToken` for company naming parity
- Proper Pydantic models for user/address (currently `dict`)
- create_order returns `{"error": "Plan not found"}` instead of HTTP 404

---

## 16. Typical Successful Request Sequence

```
1. GET  /api/plans
2. POST /api/orders          { planId, user, address }
3. POST /api/payment         { orderId, idempotencyKey }
4. [Browser] stripe.createPaymentMethod() → pm_...
5. POST /api/payment/{id}/process  { paymentMethodId: "pm_..." }
6. [If 3DS] stripe.confirmCardPayment(clientSecret) → POST /api/payment/{id}/confirm
7. [Backend] Stripe PaymentIntent → pi_..., ch_...
8. [Backend] payment.status = SUCCESS, order.status = PAID
9. [Frontend] ThankYouPage with customer name + receipt
```

---

## 18. Developer Preferences

- Built step-by-step for **learning**, not copy-paste tutorial
- User understands Order vs Payment, idempotency, tokenization, and gateway transaction IDs
- Company pattern comparison: payment token + customer token ≈ Stripe pm_ + cus_ (cus not implemented yet)

---

*Last updated: August 2026 — reflects current state of `backend/main.py` and `frontend/src/`.*
