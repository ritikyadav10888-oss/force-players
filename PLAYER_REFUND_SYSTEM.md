# Player Refund System - 95% Refund Policy

## ✅ Feature Implemented

Created a comprehensive player refund system where organizers can process refunds for player cancellations with a 95% refund (5% processing fee retained).

---

## 💰 Refund Calculation

### Standard Player Cancellation:
- **Player Paid:** ₹100
- **Refund Amount:** ₹95 (95%)
- **Processing Fee:** ₹5 (5%)

### Example Scenarios:

| Original Payment | Refund (95%) | Processing Fee (5%) |
|-----------------|--------------|---------------------|
| ₹10 | ₹9.50 | ₹0.50 |
| ₹50 | ₹47.50 | ₹2.50 |
| ₹100 | ₹95.00 | ₹5.00 |
| ₹500 | ₹475.00 | ₹25.00 |
| ₹1000 | ₹950.00 | ₹50.00 |

---

## 🔐 Authorization

### Who Can Process Refunds:
- ✅ **Tournament Owners** (Role: owner/admin)
- ✅ **Tournament Organizers** (Only for their assigned tournaments)
- ❌ **Players** (Cannot self-refund)

---

## 📋 Refund Conditions

### ✅ Refund Allowed When:
1. Player has made a payment (`paid: true`)
2. Payment ID exists in Razorpay
3. No previous refund processed
4. Request made by authorized user

### ❌ Refund Blocked When:
- Player hasn't paid
- Already refunded
- Payment ID missing
- Unauthorized user
- Tournament not found

---

## 🔧 Technical Implementation

### Files Created/Modified:

1. **`functions/index.js`** (MODIFIED)
   - Added `processPlayerRefund` Cloud Function
   - Razorpay refund API integration
   - Authorization checks
   - Database updates
   - Email notifications

2. **`src/services/RefundService.js`** (NEW)
   - Client-side refund service
   - Calls Cloud Function

3. **`app/policies/refund.js`** (MODIFIED)
   - Updated refund policy
   - Added player cancellation terms
   - Clarified 95% refund with 5% fee

---

## 🚀 How It Works

### Step-by-Step Process:

1. **Organizer Initiates Refund**
   - Selects player from tournament
   - Clicks "Process Refund" button
   - Enters refund reason

2. **Authorization Check**
   - Verifies user is owner/organizer
   - Checks tournament ownership

3. **Validation**
   - Confirms player has paid
   - Checks payment ID exists
   - Verifies no previous refund

4. **Calculation**
   - Calculates 95% of paid amount
   - Calculates 5% processing fee

5. **Razorpay Refund**
   - Calls Razorpay Refund API
   - Processes refund to original payment method

6. **Database Updates**
   - Marks player as refunded
   - Updates tournament totals
   - Creates refund transaction record

7. **Email Notification**
   - Sends refund confirmation to player
   - Includes refund details

---

## 📊 Database Changes

### Player Document Updates:
```javascript
{
  refunded: true,
  refundAmount: 9.50,
  refundId: "rfnd_XXXXX",
  refundReason: "Player cancellation",
  refundProcessedAt: Timestamp,
  refundProcessedBy: "userId",
  processingFee: 0.50,
  refundPercentage: 95,
  paid: false,
  status: "refunded"
}
```

### Tournament Document Updates:
```javascript
{
  totalCollections: -10, // Decremented
  paidPlayerCount: -1, // Decremented
  refundedCount: +1, // Incremented
  totalRefunded: +9.50 // Incremented
}
```

### Transaction Record Created:
```javascript
{
  type: "refund",
  tournamentId: "...",
  tournamentName: "Chess Tournament",
  playerId: "...",
  playerName: "John Doe",
  playerEmail: "john@example.com",
  originalAmount: 10,
  refundAmount: 9.50,
  processingFee: 0.50,
  refundPercentage: 95,
  razorpayPaymentId: "pay_XXXXX",
  razorpayRefundId: "rfnd_XXXXX",
  reason: "Player cancellation",
  status: "SUCCESS",
  processedBy: "userId",
  createdAt: "2026-01-20T...",
  updatedAt: Timestamp
}
```

---

## 🎯 Usage Example

### Client-Side Code:
```javascript
import { RefundService } from '../services/RefundService';

// Process refund
const handleRefund = async (tournamentId, playerId) => {
  try {
    const result = await RefundService.processPlayerRefund({
      tournamentId: tournamentId,
      playerId: playerId,
      reason: 'Player requested cancellation',
      refundPercentage: 95 // Optional, defaults to 95
    });

    console.log('Refund processed:', result);
    // result = {
    //   success: true,
    //   refundId: "rfnd_XXXXX",
    //   refundAmount: 9.50,
    //   processingFee: 0.50,
    //   refundPercentage: 95,
    //   message: "Refund of ₹9.50 processed successfully..."
    // }
  } catch (error) {
    console.error('Refund failed:', error);
  }
};
```

---

## 📧 Email Notification

### Refund Confirmation Email Template:
```
Subject: Refund Processed - [Tournament Name]

Dear [Player Name],

Your refund request has been processed successfully.

Tournament: [Tournament Name]
Original Payment: ₹[Amount]
Refund Amount: ₹[Refund Amount] (95%)
Processing Fee: ₹[Fee] (5%)

Refund ID: [Razorpay Refund ID]
Reason: [Reason]

The refund will be credited to your original payment method within 5-7 business days.

Thank you,
Force Player Field Team
```

---

## 🔒 Security Features

### ✅ Implemented:
- **Authorization Checks** - Only owners/organizers can refund
- **Duplicate Prevention** - Cannot refund twice
- **Payment Verification** - Validates payment exists
- **Razorpay Integration** - Secure refund processing
- **Audit Logging** - All refunds logged
- **Error Logging** - Failed attempts tracked

---

## 📝 Refund Policy (Updated)

### Player Cancellation:
- **Refund:** 95% of registration fee
- **Processing Fee:** 5% deducted
- **Condition:** Request 24 hours before event
- **Method:** Original payment method
- **Timeline:** 5-7 business days

### Event Cancellation:
- **Refund:** 95% of registration fee
- **Reason:** Organizer/Force cancellation
- **Condition:** Unforeseen circumstances

### Medical Withdrawal:
- **Refund:** 50% of registration fee
- **Condition:** Valid medical certificate
- **Timeline:** Before event starts

---

## 🧪 Testing Checklist

- [x] Cloud Function created
- [x] Client service created
- [x] Refund policy updated
- [ ] Deploy Cloud Function
- [ ] Test refund with real payment
- [ ] Verify Razorpay refund
- [ ] Check database updates
- [ ] Verify email sent
- [ ] Test authorization
- [ ] Test error cases

---

## 🚀 Deployment Steps

### 1. Deploy Cloud Function:
```bash
firebase deploy --only functions:processPlayerRefund
```

### 2. Test in Development:
```bash
# Make a test payment
# Process refund
# Verify refund in Razorpay Dashboard
```

### 3. Monitor Logs:
```bash
firebase functions:log --only processPlayerRefund
```

---

## 📊 Monitoring

### Collections to Monitor:
1. **`transactions`** - Refund records
2. **`refund_logs`** - Failed attempts
3. **`mail`** - Email queue

### Key Metrics:
- Total refunds processed
- Average refund amount
- Processing fees collected
- Failed refund attempts

---

## 🐛 Troubleshooting

### "Payment ID not found"
- **Cause:** Old registration without payment ID
- **Solution:** Cannot refund, manual process required

### "Permission denied"
- **Cause:** User not authorized
- **Solution:** Verify user role and tournament ownership

### "Already refunded"
- **Cause:** Duplicate refund attempt
- **Solution:** Check player document for refund status

### Razorpay API Error
- **Cause:** Invalid payment ID or insufficient balance
- **Solution:** Check Razorpay Dashboard and logs

---

## 💡 Future Enhancements

Potential improvements:
- [ ] Partial refunds (custom percentage)
- [ ] Refund approval workflow
- [ ] Bulk refunds
- [ ] Refund analytics dashboard
- [ ] Player-initiated refund requests
- [ ] Automated refund for event cancellation

---

## ✅ Summary

**Feature:** Player Refund System  
**Refund Amount:** 95% of payment  
**Processing Fee:** 5% retained  
**Authorization:** Owners & Organizers only  
**Integration:** Razorpay Refund API  
**Status:** ✅ **READY FOR DEPLOYMENT**

---

**Created:** January 20, 2026  
**Version:** 1.0.0  
**Dependencies:** Razorpay SDK (already installed)
