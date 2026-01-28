# Razorpay Route Testing Guide

## Overview
This guide provides step-by-step instructions for testing the Razorpay Route implementation with Settlement Hold.

---

## Prerequisites

Before testing, ensure:

- [ ] Razorpay Route feature is enabled in your Razorpay Dashboard
- [ ] Settlement Hold feature is enabled
- [ ] All Firebase secrets are configured correctly
- [ ] Functions are deployed: `firebase deploy --only functions`
- [ ] At least one organizer with completed KYC exists

---

## Test Scenarios

### Test 1: Create Organizer with Linked Account

**Objective:** Verify that organizers are created with Razorpay linked accounts instead of RazorpayX contacts.

**Steps:**

1. **Login as Owner**
   - Navigate to owner dashboard
   - Go to "Organizers" section

2. **Create New Organizer**
   - Click "Add Organizer"
   - Fill in details:
     - Name: Test Organizer
     - Email: test.organizer@example.com
     - Phone: +919876543210
     - Bank Details:
       - Account Number: 1234567890
       - IFSC Code: HDFC0000123
       - Account Holder Name: Test Organizer

3. **Verify Creation**
   - Check Firebase Console → Firestore → `users` collection
   - Verify organizer document has:
     - `linkedAccountId`: acc_xxxxx
     - `linkedAccountStatus`: created or active
     - NO `razorpayContactId` or `razorpayFundAccountId`

4. **Check Razorpay Dashboard**
   - Go to Razorpay Dashboard → Route → Linked Accounts
   - Verify new linked account exists
   - Check KYC status

**Expected Result:**
- ✅ Organizer created successfully
- ✅ Linked account ID stored in Firestore
- ✅ Linked account visible in Razorpay Dashboard
- ✅ KYC email sent to organizer

---

### Test 2: Payment with Automatic Route Split

**Objective:** Verify that player payments automatically split 95/5 with settlement hold.

**Steps:**

1. **Create Tournament**
   - Login as organizer
   - Create a test tournament
   - Set entry fee: ₹100
   - Publish tournament

2. **Register as Player**
   - Logout and register as a new player
   - Join the tournament
   - Proceed to payment

3. **Make Payment**
   - Click "Pay Now"
   - Observe console logs for:
     ```
     📦 Creating payment order with Route
     ✅ Order created: order_xxxxx
     💰 Split: ₹95 (held) + ₹5 (instant)
     ```
   - Complete payment via UPI/Card

4. **Verify Payment Success**
   - Check player registration status: "Paid"
   - Check Firebase Console → Firestore → `transactions`
   - Verify transaction document has:
     - `amount`: 100
     - `organizerShare`: 95
     - `platformCommission`: 5
     - `settlementHeld`: true
     - `transferStatus`: "on_hold"
     - `transferId`: trf_xxxxx

5. **Check Razorpay Dashboard**
   - Go to Razorpay Dashboard → Payments
   - Find the payment
   - Verify:
     - Amount: ₹100
     - Status: Captured
   - Go to Route → Transfers
   - Verify transfer exists:
     - Amount: ₹95
     - Status: On Hold
     - Linked Account: Organizer's account

6. **Verify Platform Commission**
   - Check your Razorpay balance
   - Verify ₹5 is in your account (instant)

**Expected Result:**
- ✅ Payment successful
- ✅ Automatic 95/5 split
- ✅ ₹95 held in organizer's linked account
- ✅ ₹5 in platform account (instant)
- ✅ Transfer status: "on_hold"

---

### Test 3: Settlement Hold Verification

**Objective:** Verify that organizer cannot withdraw held funds.

**Steps:**

1. **Login as Organizer**
   - Go to organizer dashboard
   - Check "Settlements" or "Earnings" section

2. **Verify Held Status**
   - Should see:
     - Total Collected: ₹100
     - Your Share: ₹95
     - Status: "Pending Release" or "Held"
     - Cannot withdraw yet

3. **Check Razorpay Dashboard (Organizer)**
   - If organizer has Razorpay dashboard access
   - Go to Route → Settlements
   - Verify funds are visible but not settled

**Expected Result:**
- ✅ Organizer can see their share (₹95)
- ✅ Status shows "Held" or "Pending Release"
- ✅ Organizer cannot withdraw funds yet

---

### Test 4: Release Settlement (Owner Control)

**Objective:** Verify that owner can release held settlements.

**Steps:**

1. **Login as Owner**
   - Go to owner dashboard
   - Navigate to "Tournaments" section

2. **Mark Tournament Complete**
   - Find the test tournament
   - Click "Mark Complete" or "Release Settlement"
   - Confirm action

3. **Verify Release**
   - Check console logs for:
     ```
     🔓 Releasing settlement for tournament: xxx
     ✅ Released 1 settlements
     ```
   - Check Firebase Console → Firestore
   - Verify tournament document:
     - `settlementStatus`: "released"
     - `settlementReleasedAt`: timestamp
     - `settlementReleasedBy`: owner UID

4. **Verify Transaction Update**
   - Check `transactions` collection
   - Verify transaction document:
     - `settlementHeld`: false
     - `transferStatus`: "processing"
     - `releasedAt`: timestamp
     - `releasedBy`: owner UID

5. **Check Razorpay Dashboard**
   - Go to Route → Transfers
   - Verify transfer status changed:
     - Status: Processing or Processed
     - On Hold: false

**Expected Result:**
- ✅ Settlement released successfully
- ✅ Transfer status changed to "processing"
- ✅ Organizer can now withdraw funds

---

### Test 5: Transfer Processed Webhook

**Objective:** Verify that webhook updates status when transfer is processed.

**Steps:**

1. **Wait for Transfer Processing**
   - Razorpay typically processes transfers within 24 hours
   - For testing, you can use Razorpay's webhook simulator

2. **Simulate Webhook (Optional)**
   - Go to Razorpay Dashboard → Webhooks
   - Find your webhook URL
   - Send test event: `transfer.processed`
   - Payload:
     ```json
     {
       "event": "transfer.processed",
       "payload": {
         "transfer": {
           "entity": {
             "id": "trf_xxxxx",
             "status": "processed",
             "notes": {
               "tournamentId": "xxx",
               "playerId": "xxx"
             }
           }
         }
       }
     }
     ```

3. **Verify Webhook Processing**
   - Check Cloud Functions logs:
     ```
     🔔 Event: transfer.processed
     ✅ Transaction updated: xxx
     ✅ Tournament settlement completed: xxx
     ```

4. **Verify Database Updates**
   - Check `transactions` collection:
     - `transferStatus`: "processed"
     - `settlementCompletedAt`: timestamp
   - Check `tournaments` collection:
     - `settlementStatus`: "completed"
     - `settlementCompletedAt`: timestamp

**Expected Result:**
- ✅ Webhook received and processed
- ✅ Transaction status updated to "processed"
- ✅ Tournament settlement marked as "completed"
- ✅ Organizer receives funds in bank account

---

### Test 6: Multiple Players Payment

**Objective:** Verify that multiple payments are handled correctly.

**Steps:**

1. **Create Tournament**
   - Entry fee: ₹100
   - Max players: 10

2. **Register 5 Players**
   - Each player pays ₹100
   - Total collected: ₹500

3. **Verify Splits**
   - Check Razorpay Dashboard → Route → Transfers
   - Should see 5 transfers:
     - Each transfer: ₹95
     - All on hold
   - Platform balance: ₹25 (5 × ₹5)

4. **Release All Settlements**
   - Owner marks tournament complete
   - All 5 transfers released at once

5. **Verify Total Settlement**
   - Check tournament document:
     - `totalCollections`: 500
     - `totalHeldAmount`: 475 (5 × ₹95)
   - After release:
     - `settlementStatus`: "released"
     - All transfers processing

**Expected Result:**
- ✅ All 5 payments split correctly
- ✅ Total organizer share: ₹475 (held)
- ✅ Total platform commission: ₹25 (instant)
- ✅ All transfers released together
- ✅ Organizer receives ₹475 after processing

---

### Test 7: Failed Transfer Handling

**Objective:** Verify that failed transfers are handled gracefully.

**Steps:**

1. **Create Organizer with Invalid Bank Details**
   - Use invalid IFSC code or account number
   - KYC will fail

2. **Make Payment**
   - Player pays ₹100
   - Payment succeeds
   - Transfer creation may fail

3. **Check Webhook**
   - Wait for `transfer.failed` event
   - Check Cloud Functions logs:
     ```
     ❌ Transfer failed: trf_xxxxx
     ```

4. **Verify Database Updates**
   - Check `transactions` collection:
     - `transferStatus`: "failed"
     - `failureReason`: error message
   - Check `tournaments` collection:
     - `settlementStatus`: "failed"
     - `lastTransferError`: error message

5. **Owner Dashboard**
   - Should show error message
   - Owner can retry or contact support

**Expected Result:**
- ✅ Payment still succeeds (platform receives money)
- ✅ Transfer failure logged
- ✅ Error visible in owner dashboard
- ✅ Can retry after fixing organizer details

---

### Test 8: Refund with Route

**Objective:** Verify that refunds work correctly with Route.

**Steps:**

1. **Make Payment**
   - Player pays ₹100
   - Transfer ₹95 held

2. **Process Refund**
   - Owner/Organizer initiates refund
   - Refund amount: ₹95 (95%)
   - Processing fee: ₹5 (5%)

3. **Verify Refund**
   - Check Razorpay Dashboard → Payments
   - Refund of ₹95 processed
   - Check `transactions` collection:
     - New refund transaction created
     - Original transaction marked as refunded

4. **Verify Transfer Reversal**
   - If transfer was on hold, it should be reversed
   - Check Route → Transfers
   - Transfer status: "reversed"

**Expected Result:**
- ✅ Refund of ₹95 processed
- ✅ ₹5 processing fee retained
- ✅ Transfer reversed if not yet processed
- ✅ Player receives ₹95 back

---

## Performance Testing

### Load Test: 100 Concurrent Payments

**Objective:** Verify system handles high volume.

**Steps:**

1. **Create Tournament**
   - Entry fee: ₹100
   - Max players: 100

2. **Simulate 100 Payments**
   - Use Razorpay's test mode
   - Create script to simulate concurrent payments

3. **Verify All Splits**
   - Check all 100 transfers created
   - All on hold
   - Platform commission: ₹500 (100 × ₹5)

4. **Release All**
   - Owner releases settlement
   - All 100 transfers released

5. **Monitor Performance**
   - Check Cloud Functions logs
   - Verify no timeouts or errors
   - All webhooks processed

**Expected Result:**
- ✅ All 100 payments processed
- ✅ All transfers created and held
- ✅ All transfers released successfully
- ✅ No performance issues

---

## Rollback Testing

### Test Rollback Procedure

**Objective:** Verify that rollback works if issues arise.

**Steps:**

1. **Restore Backup**
   - Copy `functions/index.js.backup` to `functions/index.js`

2. **Restore Secrets**
   ```bash
   firebase functions:secrets:set RAZORPAYX_WEBHOOK_SECRET
   firebase functions:secrets:set RAZORPAYX_ACCOUNT_NUMBER
   ```

3. **Deploy Old Functions**
   ```bash
   firebase deploy --only functions
   ```

4. **Verify Old System Works**
   - Test payment with old payout system
   - Verify manual payout processing works

**Expected Result:**
- ✅ Rollback successful
- ✅ Old system functional
- ✅ No data loss

---

## Checklist

Before going live, ensure all tests pass:

- [ ] Test 1: Create Organizer with Linked Account ✅
- [ ] Test 2: Payment with Automatic Route Split ✅
- [ ] Test 3: Settlement Hold Verification ✅
- [ ] Test 4: Release Settlement (Owner Control) ✅
- [ ] Test 5: Transfer Processed Webhook ✅
- [ ] Test 6: Multiple Players Payment ✅
- [ ] Test 7: Failed Transfer Handling ✅
- [ ] Test 8: Refund with Route ✅
- [ ] Performance Test: 100 Concurrent Payments ✅
- [ ] Rollback Test ✅

---

## Troubleshooting

### Issue: Transfer not created

**Possible Causes:**
- Organizer KYC not completed
- Invalid linked account
- Razorpay Route not enabled

**Solution:**
- Check organizer's `linkedAccountStatus`
- Verify KYC completion in Razorpay Dashboard
- Contact Razorpay support to enable Route

### Issue: Settlement not releasing

**Possible Causes:**
- Transfer ID not found
- Razorpay API error
- Invalid authentication

**Solution:**
- Check Cloud Functions logs for errors
- Verify `transferId` in transaction document
- Check Razorpay API credentials

### Issue: Webhook not received

**Possible Causes:**
- Webhook URL not configured
- Webhook secret mismatch
- Firewall blocking webhooks

**Solution:**
- Verify webhook URL in Razorpay Dashboard
- Check `RAZORPAY_WEBHOOK_SECRET` is correct
- Test webhook with Razorpay's webhook simulator

---

## Support

For issues or questions:

- **Razorpay Support:** support@razorpay.com
- **Razorpay Dashboard:** https://dashboard.razorpay.com
- **Route Documentation:** https://razorpay.com/docs/route/
- **Implementation Guide:** RAZORPAY_ROUTE_IMPLEMENTATION.md

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-24  
**Status:** Ready for Testing
