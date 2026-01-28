# Razorpay Route Flow Diagram

## Payment Flow Comparison

### OLD SYSTEM (RazorpayX Payouts)
```
┌─────────────────────────────────────────────────────────────────┐
│                         PLAYER PAYS ₹100                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  Platform Account    │
                  │      ₹100            │
                  └──────────┬───────────┘
                             │
                             │ Owner marks complete
                             ▼
                  ┌──────────────────────┐
                  │  Owner Dashboard     │
                  │  "Process Payout"    │
                  └──────────┬───────────┘
                             │
                             │ Manual action
                             ▼
                  ┌──────────────────────┐
                  │  Create Payout       │
                  │  Request (₹95)       │
                  └──────────┬───────────┘
                             │
                             │ API call
                             ▼
                  ┌──────────────────────┐
                  │  RazorpayX           │
                  │  Processes Payout    │
                  └──────────┬───────────┘
                             │
                             │ 1-2 days
                             ▼
                  ┌──────────────────────┐
                  │  Organizer Bank      │
                  │      ₹95             │
                  └──────────────────────┘
                  
                  Platform keeps ₹5
```

### NEW SYSTEM (Razorpay Route with Settlement Hold)
```
┌─────────────────────────────────────────────────────────────────┐
│                         PLAYER PAYS ₹100                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Automatic split
                             ▼
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
   ┌──────────────────┐         ┌──────────────────┐
   │ Organizer's      │         │ Platform Account │
   │ Linked Account   │         │      ₹5          │
   │   ₹95 (HELD)     │         │   (INSTANT)      │
   └────────┬─────────┘         └──────────────────┘
            │
            │ Held until release
            │
            │ Owner marks complete
            ▼
   ┌──────────────────┐
   │ Owner Dashboard  │
   │ "Release         │
   │  Settlement"     │
   └────────┬─────────┘
            │
            │ One click
            ▼
   ┌──────────────────┐
   │ Razorpay         │
   │ Releases Hold    │
   └────────┬─────────┘
            │
            │ 1-2 days
            ▼
   ┌──────────────────┐
   │ Organizer Bank   │
   │      ₹95         │
   └──────────────────┘
```

## Detailed Route Flow

### Step 1: Payment Creation
```
Player clicks "Pay Now"
         │
         ▼
┌────────────────────────────────────────┐
│ Client: RazorpayService.openCheckout() │
└────────────┬───────────────────────────┘
             │
             │ Calls backend
             ▼
┌────────────────────────────────────────┐
│ Backend: createPaymentWithRoute()      │
│                                        │
│ 1. Get tournament details              │
│ 2. Get organizer's linkedAccountId     │
│ 3. Calculate split (95/5)              │
│ 4. Create Razorpay order with:        │
│    - amount: ₹100                      │
│    - transfers: [                      │
│        {                               │
│          account: linkedAccountId,     │
│          amount: ₹95,                  │
│          on_hold: true,                │
│          on_hold_until: 30 days        │
│        }                               │
│      ]                                 │
└────────────┬───────────────────────────┘
             │
             │ Returns order_id
             ▼
┌────────────────────────────────────────┐
│ Client: Opens Razorpay checkout        │
│ with order_id                          │
└────────────┬───────────────────────────┘
             │
             │ Player completes payment
             ▼
┌────────────────────────────────────────┐
│ Razorpay: Processes payment            │
│                                        │
│ 1. Captures ₹100                       │
│ 2. Splits automatically:               │
│    - ₹95 → Organizer (held)            │
│    - ₹5 → Platform (instant)           │
│ 3. Creates transfer with on_hold=true │
└────────────┬───────────────────────────┘
             │
             │ Sends webhook
             ▼
┌────────────────────────────────────────┐
│ Backend: razorpayWebhook()             │
│                                        │
│ Event: payment.captured                │
│ 1. Mark player as paid                 │
│ 2. Update tournament collections       │
│ 3. Create transaction record:          │
│    - organizerShare: ₹95               │
│    - platformCommission: ₹5            │
│    - settlementHeld: true              │
│    - transferStatus: "on_hold"         │
└────────────────────────────────────────┘
```

### Step 2: Settlement Release
```
Owner marks tournament complete
         │
         ▼
┌────────────────────────────────────────┐
│ Owner Dashboard: Click "Release        │
│ Settlement"                            │
└────────────┬───────────────────────────┘
             │
             │ Confirmation dialog
             ▼
┌────────────────────────────────────────┐
│ Client: RazorpayService.                │
│ releaseSettlement(tournamentId)        │
└────────────┬───────────────────────────┘
             │
             │ Calls backend
             ▼
┌────────────────────────────────────────┐
│ Backend: releaseSettlement()           │
│                                        │
│ 1. Get all held transactions           │
│ 2. For each transaction:               │
│    - Get order details                 │
│    - Extract transfer ID               │
│    - Call Razorpay API:                │
│      PATCH /transfers/{id}             │
│      { on_hold: false }                │
│ 3. Update transaction:                 │
│    - settlementHeld: false             │
│    - transferStatus: "processing"      │
│    - releasedAt: now                   │
│ 4. Update tournament:                  │
│    - settlementStatus: "released"      │
└────────────┬───────────────────────────┘
             │
             │ Returns success
             ▼
┌────────────────────────────────────────┐
│ Razorpay: Processes transfer           │
│                                        │
│ 1. Releases hold on ₹95                │
│ 2. Initiates bank transfer             │
│ 3. Sends webhook after processing      │
└────────────┬───────────────────────────┘
             │
             │ 1-2 business days
             ▼
┌────────────────────────────────────────┐
│ Backend: razorpayWebhook()             │
│                                        │
│ Event: transfer.processed              │
│ 1. Update transaction:                 │
│    - transferStatus: "processed"       │
│    - settlementCompletedAt: now        │
│ 2. Update tournament:                  │
│    - settlementStatus: "completed"     │
│ 3. Send notification to organizer      │
└────────────┬───────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ Organizer receives ₹95 in bank account │
└────────────────────────────────────────┘
```

## State Diagram

### Transaction States
```
┌─────────┐
│ STARTED │ (Payment initiated)
└────┬────┘
     │
     │ Payment captured
     ▼
┌─────────────┐
│   SUCCESS   │ (Payment successful)
│ on_hold     │ (Transfer held)
└────┬────────┘
     │
     │ Owner releases
     ▼
┌─────────────┐
│ PROCESSING  │ (Transfer released)
│ processing  │ (Being transferred)
└────┬────────┘
     │
     │ Transfer completed
     ▼
┌─────────────┐
│ COMPLETED   │ (Money in organizer's bank)
│ processed   │
└─────────────┘

Alternative paths:
┌─────────┐
│ FAILED  │ (Payment failed)
└─────────┘

┌─────────┐
│ REVERSED│ (Transfer reversed)
└─────────┘
```

### Settlement Status Flow
```
Tournament Created
     │
     │ First payment
     ▼
┌──────────┐
│   HELD   │ (Funds held in organizer's account)
└────┬─────┘
     │
     │ Owner clicks "Release Settlement"
     ▼
┌──────────┐
│ RELEASED │ (Hold removed, transfer processing)
└────┬─────┘
     │
     │ Razorpay completes transfer
     ▼
┌──────────┐
│COMPLETED │ (Money in organizer's bank)
└──────────┘

Alternative:
┌──────────┐
│  FAILED  │ (Transfer failed, needs retry)
└──────────┘
```

## Data Flow

### Database Updates
```
Payment Captured
     │
     ▼
┌─────────────────────────────────────┐
│ tournaments/{id}                    │
│ - totalCollections: +₹100           │
│ - paidPlayerCount: +1               │
│ - totalHeldAmount: +₹95             │
│ - settlementStatus: "held"          │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ tournaments/{id}/players/{playerId} │
│ - paid: true                        │
│ - paymentId: "pay_xxxxx"            │
│ - paidAmount: ₹100                  │
│ - paidAt: timestamp                 │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ transactions/{id}                   │
│ - type: "collection"                │
│ - amount: ₹100                      │
│ - organizerShare: ₹95               │
│ - platformCommission: ₹5            │
│ - settlementHeld: true              │
│ - transferStatus: "on_hold"         │
│ - transferId: "trf_xxxxx"           │
└─────────────────────────────────────┘

Settlement Released
     │
     ▼
┌─────────────────────────────────────┐
│ tournaments/{id}                    │
│ - settlementStatus: "released"      │
│ - settlementReleasedAt: timestamp   │
│ - settlementReleasedBy: owner_uid   │
│ - totalHeldAmount: 0                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ transactions/{id}                   │
│ - settlementHeld: false             │
│ - transferStatus: "processing"      │
│ - releasedAt: timestamp             │
│ - releasedBy: owner_uid             │
└─────────────────────────────────────┘

Transfer Completed
     │
     ▼
┌─────────────────────────────────────┐
│ tournaments/{id}                    │
│ - settlementStatus: "completed"     │
│ - settlementCompletedAt: timestamp  │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ transactions/{id}                   │
│ - transferStatus: "processed"       │
│ - settlementCompletedAt: timestamp  │
└─────────────────────────────────────┘
```

## API Calls

### Payment Creation
```
Client → Backend: createPaymentWithRoute({ tournamentId, playerId, amount })
Backend → Razorpay: POST /v1/orders
                    {
                      amount: 10000,
                      currency: "INR",
                      transfers: [{
                        account: "acc_xxxxx",
                        amount: 9500,
                        on_hold: true
                      }]
                    }
Razorpay → Backend: { id: "order_xxxxx", ... }
Backend → Client: { orderId: "order_xxxxx", ... }
Client → Razorpay: Opens checkout with order_id
Razorpay → Backend: Webhook: payment.captured
```

### Settlement Release
```
Client → Backend: releaseSettlement({ tournamentId })
Backend → Razorpay: GET /v1/orders/{order_id}
Razorpay → Backend: { transfers: [{ id: "trf_xxxxx" }] }
Backend → Razorpay: PATCH /v1/transfers/trf_xxxxx
                    { on_hold: false }
Razorpay → Backend: { id: "trf_xxxxx", on_hold: false }
Backend → Client: { success: true, releasedCount: 1 }
Razorpay → Backend: Webhook: transfer.processed (after 1-2 days)
```

## Legend
```
┌─────────┐
│  Box    │  = Process/Action
└─────────┘

    │
    ▼         = Flow direction

┌─────────┐
│ CAPS    │  = State/Status
└─────────┘

₹95         = Money amount
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-24  
**Purpose:** Visual reference for Razorpay Route flow
