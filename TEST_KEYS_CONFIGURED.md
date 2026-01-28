# ✅ Test Keys Configured Successfully!

## 🎉 What Was Done

### 1. Client-Side Configuration
**File:** `.env`

✅ **Test key activated:**
```bash
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_S7hNQVFMSudblg
```

✅ **Live key disabled (commented out):**
```bash
# EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_S4UFro656NZEhB
```

### 2. Server-Side Configuration
**Firebase Functions Secrets:**

You need to set these secrets manually:

```bash
# Set Test Key ID
firebase functions:secrets:set RAZORPAY_KEY_ID
# When prompted, enter: rzp_test_S7hNQVFMSudblg

# Set Test Key Secret
firebase functions:secrets:set RAZORPAY_KEY_SECRET
# When prompted, enter: BbiWuz8TSlez1FUV4E1sz6o4
```

**Or use the automated script:**
```bash
.\scripts\set-test-keys.ps1
```

---

## 🚀 Next Steps

### Step 1: Set Firebase Secrets (5 minutes)

**Option A: Use Automated Script (Recommended)**
```bash
.\scripts\set-test-keys.ps1
```
This will:
- Set RAZORPAY_KEY_ID
- Set RAZORPAY_KEY_SECRET
- Prompt to deploy functions
- Show next steps

**Option B: Manual Setup**
```bash
# Set Key ID
firebase functions:secrets:set RAZORPAY_KEY_ID
# Paste: rzp_test_S7hNQVFMSudblg

# Set Key Secret
firebase functions:secrets:set RAZORPAY_KEY_SECRET
# Paste: BbiWuz8TSlez1FUV4E1sz6o4

# Deploy
firebase deploy --only functions
```

### Step 2: Configure Webhook (5 minutes)

1. **Go to Razorpay Dashboard (Test Mode)**
   - https://dashboard.razorpay.com
   - Switch to **Test Mode** (toggle in top-left)

2. **Configure Webhook**
   - Go to **Settings** → **Webhooks**
   - Click **Create New Webhook**
   - URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/razorpayWebhook`
   - Select events:
     - ✅ `payment.captured`
     - ✅ `payment.authorized`
     - ✅ `payment.failed`
     - ✅ `transfer.processed`
     - ✅ `transfer.failed`
   - Click **Create Webhook**

3. **Copy Webhook Secret**
   - After creating, copy the webhook secret
   - Set it in Firebase:
     ```bash
     firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
     # Paste the webhook secret
     ```

### Step 3: Restart Development Server

```bash
# Stop current server (Ctrl+C)
# Then restart
npm start
```

### Step 4: Test Payment Flow (15 minutes)

Follow the testing guide: `RAZORPAY_ROUTE_TESTING.md`

**Quick Test:**

1. **Create Organizer**
   - Login as owner
   - Create test organizer
   - Verify linked account created

2. **Make Test Payment**
   - Create tournament (₹100 entry fee)
   - Register as player
   - Pay with test card: **4111 1111 1111 1111**
   - CVV: 123, Expiry: 12/25

3. **Verify Split**
   - Go to Razorpay Dashboard (Test Mode)
   - Check **Payments** → Should see ₹100 payment
   - Check **Route** → **Transfers** → Should see ₹95 transfer (on hold)
   - Your account balance: +₹5 (instant)

4. **Test Settlement Release**
   - Login as owner
   - Go to tournaments
   - Click "Release Settlement"
   - Verify transfer released in Razorpay Dashboard

---

## 🧪 Test Cards

### ✅ Successful Payment
```
Card Number: 4111 1111 1111 1111
CVV: 123
Expiry: 12/25
Name: Test User
```

### ❌ Failed Payment
```
Card Number: 4000 0000 0000 0002
CVV: 123
Expiry: 12/25
```

### 💳 UPI Test
```
UPI ID: success@razorpay
```

---

## 📊 Your Test Configuration

### Client-Side
- **Key:** `rzp_test_S7hNQVFMSudblg`
- **Location:** `.env` file
- **Status:** ✅ Active

### Server-Side
- **Key ID:** `rzp_test_S7hNQVFMSudblg`
- **Key Secret:** `BbiWuz8TSlez1FUV4E1sz6o4`
- **Location:** Firebase Functions Secrets
- **Status:** ⏳ Needs to be set

### Mode
- **Current:** TEST MODE (No real money)
- **Safe:** ✅ Yes - All transactions are simulated

---

## ✅ Verification Checklist

### Before Testing
- [x] Test key added to `.env`
- [ ] Firebase secrets set (RAZORPAY_KEY_ID)
- [ ] Firebase secrets set (RAZORPAY_KEY_SECRET)
- [ ] Firebase secrets set (RAZORPAY_WEBHOOK_SECRET)
- [ ] Functions deployed
- [ ] Webhook configured in Razorpay Dashboard
- [ ] Development server restarted

### During Testing
- [ ] Payment opens in test mode
- [ ] Test card works (4111 1111 1111 1111)
- [ ] Payment succeeds
- [ ] Split verified (95/5)
- [ ] Transfer shows as "on hold"
- [ ] Settlement release works
- [ ] Webhook events received

---

## 🔍 How to Verify Test Mode

### Check Console Logs
When you make a payment, you should see:
```
🔑 Razorpay Active Key: rzp_test_S...
📦 Creating payment order with Route
✅ Order created: order_xxxxx
💰 Split: ₹95 (held) + ₹5 (instant)
```

### Check Razorpay Dashboard
1. Make sure you're in **Test Mode** (toggle in top-left)
2. All payments will show in test mode only
3. You'll see "Test Mode" badge on payments

---

## 🔄 Switch Back to Live Mode

When you're done testing and ready for production:

### Client-Side
Edit `.env`:
```bash
# Comment test key
# EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_S7hNQVFMSudblg

# Uncomment live key
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_S4UFro656NZEhB
```

### Server-Side
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
# Enter: rzp_live_S4UFro656NZEhB

firebase functions:secrets:set RAZORPAY_KEY_SECRET
# Enter: YOUR_LIVE_KEY_SECRET

firebase deploy --only functions
```

---

## 📚 Documentation

- **Quick Reference:** `TEST_KEYS_QUICK_REF.md`
- **Full Guide:** `RAZORPAY_TEST_KEYS_GUIDE.md`
- **Testing Guide:** `RAZORPAY_ROUTE_TESTING.md`
- **Implementation:** `RAZORPAY_ROUTE_IMPLEMENTATION.md`

---

## 🆘 Troubleshooting

### Issue: Payment still shows live mode
**Solution:**
1. Clear browser cache
2. Restart development server
3. Check `.env` file has test key
4. Verify no cached environment variables

### Issue: Test card not working
**Solution:**
1. Use exactly: 4111 1111 1111 1111
2. Any CVV (e.g., 123)
3. Any future expiry (e.g., 12/25)
4. Verify you're in test mode in Razorpay Dashboard

### Issue: Transfer not created
**Solution:**
1. Check organizer has `linkedAccountId`
2. Verify Route is enabled in Razorpay (even in test mode)
3. Check Cloud Functions logs for errors

---

## 🎯 Quick Test Commands

```bash
# Set Firebase secrets (automated)
.\scripts\set-test-keys.ps1

# Or manually
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET

# Deploy functions
firebase deploy --only functions

# Restart app
npm start

# View logs
firebase functions:log
```

---

## ⚠️ Important Reminders

1. **No Real Money**
   - Test mode doesn't charge real money
   - All transactions are simulated
   - Safe to test unlimited times

2. **Test Data**
   - Test payments won't affect real data
   - Create test organizers and tournaments
   - Use test cards only

3. **Webhook Secret**
   - Don't forget to set RAZORPAY_WEBHOOK_SECRET
   - Get it from Razorpay Dashboard → Webhooks
   - Must be set for webhook events to work

4. **Switch Back**
   - Remember to switch to live keys before production
   - Update both client and server
   - Redeploy functions

---

## 🎊 You're Ready to Test!

Your test keys are configured and ready. Follow these steps:

1. ✅ Run `.\scripts\set-test-keys.ps1`
2. ✅ Configure webhook in Razorpay Dashboard
3. ✅ Restart development server
4. ✅ Make test payment with card: 4111 1111 1111 1111
5. ✅ Verify 95/5 split
6. ✅ Test settlement release

**Happy Testing! 🚀**

---

**Document Version:** 1.0  
**Created:** 2026-01-24  
**Test Key:** rzp_test_S7hNQVFMSudblg  
**Mode:** TEST (Safe - No real money)
