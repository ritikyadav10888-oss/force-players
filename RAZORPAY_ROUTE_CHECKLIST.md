# Razorpay Route Implementation Checklist

## Pre-Implementation

### ✅ Code Review
- [x] Reviewed implementation plan
- [x] Understood Route vs RazorpayX differences
- [x] Reviewed all documentation
- [x] Backup created (`functions/index.js.backup`)

### ⏳ Razorpay Account Setup
- [ ] Contact Razorpay support (support@razorpay.com)
- [ ] Request Route feature enablement
- [ ] Request Settlement Hold feature
- [ ] Provide business details and use case
- [ ] Wait for approval (1-5 business days)
- [ ] Verify Route is enabled in Dashboard

---

## Implementation Phase

### ✅ Backend Changes
- [x] Removed `razorpayXCall()` function
- [x] Removed `createPayoutTransaction()` function
- [x] Removed `processPayout()` function
- [x] Removed `syncPayoutStatus()` function
- [x] Removed `syncRazorpayDetails()` trigger
- [x] Removed payout webhook handling
- [x] Added `createLinkedAccount()` helper
- [x] Updated `createOrganizer()` to use linked accounts
- [x] Added `createPaymentWithRoute()` function
- [x] Added `releaseSettlement()` function
- [x] Updated webhook to handle transfer events
- [x] Updated `verifyPayment()` to track transfers

### ✅ Frontend Changes
- [x] Added `createPaymentWithRoute()` to RazorpayService
- [x] Updated `openCheckout()` to use order-based payments
- [x] Added `releaseSettlement()` to RazorpayService
- [x] Removed `initiateTransfer()` function

### ✅ Documentation
- [x] Created implementation plan
- [x] Created testing guide
- [x] Created owner dashboard update guide
- [x] Created flow diagrams
- [x] Created migration scripts
- [x] Created verification scripts

---

## Deployment Phase

### ⏳ Firebase Secrets
- [ ] Verify `RAZORPAY_KEY_ID` exists
  ```bash
  firebase functions:secrets:access RAZORPAY_KEY_ID
  ```
- [ ] Verify `RAZORPAY_KEY_SECRET` exists
  ```bash
  firebase functions:secrets:access RAZORPAY_KEY_SECRET
  ```
- [ ] Verify `RAZORPAY_WEBHOOK_SECRET` exists
  ```bash
  firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET
  ```
- [ ] Remove `RAZORPAYX_WEBHOOK_SECRET`
  ```bash
  firebase functions:secrets:destroy RAZORPAYX_WEBHOOK_SECRET
  ```
- [ ] Remove `RAZORPAYX_ACCOUNT_NUMBER`
  ```bash
  firebase functions:secrets:destroy RAZORPAYX_ACCOUNT_NUMBER
  ```

### ⏳ Code Verification
- [ ] Run verification script
  ```bash
  .\scripts\verify-route-migration.ps1
  ```
- [ ] All checks pass
- [ ] No RazorpayX references found
- [ ] All Route functions present

### ⏳ Function Deployment
- [ ] Deploy functions
  ```bash
  firebase deploy --only functions
  ```
- [ ] Deployment successful
- [ ] No errors in logs
- [ ] Verify functions list
  ```bash
  firebase functions:list
  ```
- [ ] Confirm these functions exist:
  - [ ] `createOrganizer`
  - [ ] `createPaymentWithRoute`
  - [ ] `releaseSettlement`
  - [ ] `razorpayWebhook`
  - [ ] `verifyPayment`

### ⏳ Webhook Configuration
- [ ] Login to Razorpay Dashboard
- [ ] Go to Settings → Webhooks
- [ ] Update webhook URL (if changed)
- [ ] Enable these events:
  - [ ] `payment.captured`
  - [ ] `payment.authorized`
  - [ ] `payment.failed`
  - [ ] `transfer.processed`
  - [ ] `transfer.failed`
- [ ] Disable old payout events:
  - [ ] `payout.processed`
  - [ ] `payout.reversed`
  - [ ] `payout.failed`
- [ ] Save webhook configuration
- [ ] Test webhook with simulator

---

## Testing Phase

### ⏳ Test 1: Organizer Creation
- [ ] Login as owner
- [ ] Create new organizer
- [ ] Verify linked account created
- [ ] Check Firestore for `linkedAccountId`
- [ ] Verify in Razorpay Dashboard → Route → Linked Accounts
- [ ] Confirm KYC email sent

### ⏳ Test 2: Payment with Route
- [ ] Create test tournament (₹100 entry fee)
- [ ] Register as player
- [ ] Make payment
- [ ] Verify payment success
- [ ] Check console logs for split confirmation
- [ ] Verify in Razorpay Dashboard:
  - [ ] Payment captured (₹100)
  - [ ] Transfer created (₹95)
  - [ ] Transfer status: On Hold
  - [ ] Platform balance: +₹5
- [ ] Check Firestore transaction:
  - [ ] `amount`: 100
  - [ ] `organizerShare`: 95
  - [ ] `platformCommission`: 5
  - [ ] `settlementHeld`: true
  - [ ] `transferStatus`: "on_hold"

### ⏳ Test 3: Settlement Hold
- [ ] Login as organizer
- [ ] Check dashboard
- [ ] Verify shows "Pending Release" or "Held"
- [ ] Confirm cannot withdraw yet
- [ ] Verify held amount visible

### ⏳ Test 4: Release Settlement
- [ ] Login as owner
- [ ] Navigate to tournaments
- [ ] Click "Release Settlement"
- [ ] Confirm action
- [ ] Verify success message
- [ ] Check Firestore:
  - [ ] Tournament `settlementStatus`: "released"
  - [ ] Transaction `settlementHeld`: false
  - [ ] Transaction `transferStatus`: "processing"
- [ ] Verify in Razorpay Dashboard:
  - [ ] Transfer status changed
  - [ ] On Hold: false

### ⏳ Test 5: Webhook Processing
- [ ] Wait for transfer processing (or simulate)
- [ ] Check Cloud Functions logs
- [ ] Verify `transfer.processed` event received
- [ ] Check Firestore updates:
  - [ ] Transaction `transferStatus`: "processed"
  - [ ] Tournament `settlementStatus`: "completed"

### ⏳ Test 6: Multiple Payments
- [ ] Create tournament with multiple slots
- [ ] Register 5 players
- [ ] All pay successfully
- [ ] Verify 5 transfers created (all held)
- [ ] Platform commission: ₹25 (5 × ₹5)
- [ ] Release all settlements at once
- [ ] Verify all transfers released

### ⏳ Test 7: Error Handling
- [ ] Test with invalid organizer (no KYC)
- [ ] Verify error handling
- [ ] Test failed transfer scenario
- [ ] Verify error logged
- [ ] Test webhook failure
- [ ] Verify retry mechanism

### ⏳ Test 8: Refund Flow
- [ ] Make payment
- [ ] Process refund (95%)
- [ ] Verify refund successful
- [ ] Check transfer reversal
- [ ] Verify processing fee retained (5%)

---

## UI Updates Phase

### ⏳ Owner Dashboard
- [ ] Update tournaments list view
  - [ ] Add "Held Amount" column
  - [ ] Update "Status" column
  - [ ] Replace "Process Payout" with "Release Settlement"
- [ ] Update tournament details view
  - [ ] Add settlement section
  - [ ] Show split breakdown
  - [ ] Add release button
  - [ ] Add status indicators
- [ ] Update transactions view
  - [ ] Show organizer share
  - [ ] Show platform commission
  - [ ] Show transfer status
  - [ ] Add held/released indicators
- [ ] Add dashboard widgets
  - [ ] Held Settlements widget
  - [ ] Platform Commission widget
  - [ ] Pending Releases widget
- [ ] Implement release settlement function
  - [ ] Add confirmation dialog
  - [ ] Show loading state
  - [ ] Handle errors
  - [ ] Show success message
- [ ] Update financial reports
  - [ ] Show split details
  - [ ] Include settlement status
  - [ ] Add transfer information

### ⏳ Organizer Dashboard
- [ ] Update earnings view
  - [ ] Show held amount
  - [ ] Show settlement status
  - [ ] Add "Pending Release" indicator
- [ ] Add settlement timeline
- [ ] Update notifications
  - [ ] Settlement released notification
  - [ ] Settlement completed notification

### ⏳ Notifications
- [ ] Implement settlement released email
- [ ] Implement settlement completed email
- [ ] Test email delivery
- [ ] Verify email content

---

## Data Migration Phase

### ⏳ Existing Organizers
- [ ] Identify organizers with old RazorpayX contacts
- [ ] Create migration script
- [ ] Test migration with one organizer
- [ ] Migrate all organizers to linked accounts
- [ ] Verify all migrations successful
- [ ] Update organizer records in Firestore

### ⏳ Existing Tournaments
- [ ] Identify active tournaments
- [ ] Update settlement status fields
- [ ] Archive old payout records
- [ ] Verify data integrity

---

## Go Live Phase

### ⏳ Pre-Launch Checks
- [ ] All tests passed
- [ ] UI updates complete
- [ ] Data migration complete
- [ ] Webhook configured
- [ ] Secrets verified
- [ ] Functions deployed
- [ ] Documentation reviewed

### ⏳ Monitoring Setup
- [ ] Set up Cloud Functions monitoring
- [ ] Set up error alerts
- [ ] Set up webhook monitoring
- [ ] Set up payment success rate tracking
- [ ] Set up settlement release tracking

### ⏳ Launch
- [ ] Announce to organizers
- [ ] Provide KYC instructions
- [ ] Monitor first few payments
- [ ] Monitor first settlement release
- [ ] Check for errors
- [ ] Verify split accuracy

### ⏳ Post-Launch
- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Verify webhook delivery
- [ ] Check payment success rate
- [ ] Verify settlement releases
- [ ] Collect organizer feedback

---

## Rollback Plan

### If Issues Arise
- [ ] Identify issue
- [ ] Document error
- [ ] Decide if rollback needed
- [ ] If yes, execute rollback:
  ```bash
  # Restore backup
  Copy-Item functions\index.js.backup functions\index.js
  
  # Restore secrets
  firebase functions:secrets:set RAZORPAYX_WEBHOOK_SECRET
  firebase functions:secrets:set RAZORPAYX_ACCOUNT_NUMBER
  
  # Redeploy
  firebase deploy --only functions
  ```
- [ ] Verify old system works
- [ ] Notify stakeholders
- [ ] Plan fix and retry

---

## Success Metrics

### Week 1
- [ ] Payment success rate ≥ 95%
- [ ] All payments split correctly (95/5)
- [ ] Platform commission received instantly
- [ ] Zero manual calculation errors
- [ ] Settlement releases working

### Month 1
- [ ] Transfer success rate ≥ 95%
- [ ] Average release time < 24 hours
- [ ] Zero settlement disputes
- [ ] Organizer satisfaction high
- [ ] System stable

---

## Documentation Checklist

### Created Documents
- [x] `RAZORPAY_ROUTE_IMPLEMENTATION.md` - Complete guide
- [x] `RAZORPAY_ROUTE_TESTING.md` - Testing procedures
- [x] `RAZORPAY_ROUTE_SUMMARY.md` - Executive summary
- [x] `RAZORPAY_ROUTE_FLOW_DIAGRAM.md` - Visual flows
- [x] `OWNER_DASHBOARD_UPDATES.md` - UI changes
- [x] `scripts/migrate-to-route.ps1` - Migration script
- [x] `scripts/verify-route-migration.ps1` - Verification script
- [x] `functions/index.js.backup` - Code backup

### Updated Files
- [x] `functions/index.js` - Complete rewrite
- [x] `src/services/RazorpayService.js` - Updated payment flow

---

## Support Contacts

### Razorpay
- **Email:** support@razorpay.com
- **Phone:** +91-80-6811-6811
- **Dashboard:** https://dashboard.razorpay.com
- **Docs:** https://razorpay.com/docs/route/

### Internal
- **Implementation Guide:** `RAZORPAY_ROUTE_IMPLEMENTATION.md`
- **Testing Guide:** `RAZORPAY_ROUTE_TESTING.md`
- **Summary:** `RAZORPAY_ROUTE_SUMMARY.md`

---

## Final Sign-Off

### Code Review
- [ ] Backend code reviewed
- [ ] Frontend code reviewed
- [ ] No security issues
- [ ] No performance issues
- [ ] Code follows best practices

### Testing
- [ ] All automated tests pass
- [ ] All manual tests pass
- [ ] Edge cases tested
- [ ] Error handling verified
- [ ] Performance acceptable

### Documentation
- [ ] All docs created
- [ ] All docs reviewed
- [ ] Docs are clear and complete
- [ ] Examples provided
- [ ] Troubleshooting included

### Deployment
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Team trained

### Approval
- [ ] Technical lead approval
- [ ] Product owner approval
- [ ] Ready for production

---

**Checklist Version:** 1.0  
**Last Updated:** 2026-01-24  
**Status:** Ready for Use

---

## Quick Commands Reference

```bash
# Verify implementation
.\scripts\verify-route-migration.ps1

# Run migration
.\scripts\migrate-to-route.ps1

# Deploy functions
firebase deploy --only functions

# Check functions
firebase functions:list

# View logs
firebase functions:log

# Check secrets
firebase functions:secrets:access RAZORPAY_KEY_ID
firebase functions:secrets:access RAZORPAY_KEY_SECRET
firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET
```

---

**Print this checklist and mark items as you complete them!**
