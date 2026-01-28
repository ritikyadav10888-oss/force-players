# Razorpay Test Keys Setup Guide

## 🔑 Getting Your Test Keys

### Step 1: Login to Razorpay Dashboard
1. Go to https://dashboard.razorpay.com
2. Login with your credentials

### Step 2: Switch to Test Mode
1. Look for the mode toggle in the top-left corner
2. Click to switch from **Live** to **Test** mode
3. The dashboard will reload in test mode

### Step 3: Get Test API Keys
1. Go to **Settings** → **API Keys**
2. In Test Mode, you'll see:
   - **Key ID**: `rzp_test_xxxxxxxxxxxxxx`
   - **Key Secret**: `xxxxxxxxxxxxxxxxxxxxxx`
3. Click **Generate Test Key** if you don't have one
4. Copy both the Key ID and Key Secret

---

## 📝 Configure Test Keys

### Client-Side (Frontend)

**Option 1: Using .env file (Recommended)**

Edit `.env` file:
```bash
# Comment out live key
# EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_S4UFro656NZEhB

# Uncomment test key
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
```

**Option 2: Direct in app.config.js**

Edit `app.config.js`:
```javascript
extra: {
    EXPO_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_YOUR_TEST_KEY_ID"
}
```

### Server-Side (Firebase Functions)

Set Firebase secrets with test keys:

```bash
# Set test Key ID
firebase functions:secrets:set RAZORPAY_KEY_ID
# When prompted, paste: rzp_test_YOUR_TEST_KEY_ID

# Set test Key Secret
firebase functions:secrets:set RAZORPAY_KEY_SECRET
# When prompted, paste: YOUR_TEST_KEY_SECRET

# Set webhook secret (get from Razorpay Dashboard → Webhooks)
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
# When prompted, paste: YOUR_TEST_WEBHOOK_SECRET
```

### Webhook Configuration

1. Go to Razorpay Dashboard (Test Mode) → **Settings** → **Webhooks**
2. Add webhook URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/razorpayWebhook`
3. Select events:
   - `payment.captured`
   - `payment.authorized`
   - `payment.failed`
   - `transfer.processed`
   - `transfer.failed`
4. Copy the **Webhook Secret**
5. Set it in Firebase:
   ```bash
   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
   ```

---

## 🧪 Testing with Test Keys

### Test Cards (No Real Money)

Razorpay provides test cards that simulate different scenarios:

#### Successful Payment
```
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date
Name: Any name
```

#### Failed Payment
```
Card Number: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
```

#### UPI Test
```
UPI ID: success@razorpay
```

### Test Payment Flow

1. **Create Organizer** (with test linked account)
   - Will create test linked account in Razorpay
   - KYC not required in test mode

2. **Make Test Payment**
   - Use test card: `4111 1111 1111 1111`
   - Payment will succeed immediately
   - Check Razorpay Dashboard → Payments (Test Mode)

3. **Verify Split**
   - Go to Razorpay Dashboard → Route → Transfers
   - You should see the 95% transfer (on hold)
   - Platform commission (5%) in your test account

4. **Release Settlement**
   - Use owner dashboard
   - Click "Release Settlement"
   - Transfer will be released

5. **Check Webhook**
   - Go to Razorpay Dashboard → Webhooks
   - Check webhook logs
   - Verify `transfer.processed` event sent

---

## 🔄 Switching Between Test and Live

### To Test Mode

**Client:**
```bash
# Edit .env
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
```

**Server:**
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
# Enter: rzp_test_YOUR_TEST_KEY_ID

firebase functions:secrets:set RAZORPAY_KEY_SECRET
# Enter: YOUR_TEST_KEY_SECRET
```

**Deploy:**
```bash
firebase deploy --only functions
```

### To Live Mode

**Client:**
```bash
# Edit .env
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_S4UFro656NZEhB
```

**Server:**
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
# Enter: rzp_live_S4UFro656NZEhB

firebase functions:secrets:set RAZORPAY_KEY_SECRET
# Enter: YOUR_LIVE_KEY_SECRET
```

**Deploy:**
```bash
firebase deploy --only functions
```

---

## ✅ Verification Checklist

### Client-Side
- [ ] Test key in `.env` file
- [ ] App restarted after changing key
- [ ] Console shows test key (first 10 chars)
- [ ] Payment opens in test mode

### Server-Side
- [ ] Test keys set in Firebase secrets
- [ ] Functions deployed
- [ ] Webhook configured in test mode
- [ ] Webhook secret matches

### Testing
- [ ] Test payment succeeds
- [ ] Payment splits correctly (95/5)
- [ ] Transfer shows in Razorpay Dashboard
- [ ] Transfer is on hold
- [ ] Settlement release works
- [ ] Webhook events received

---

## 🎯 Test Scenarios

### Scenario 1: Successful Payment
```
1. Use card: 4111 1111 1111 1111
2. Payment succeeds
3. Verify split in Razorpay Dashboard
4. Check Firestore transaction record
```

### Scenario 2: Failed Payment
```
1. Use card: 4000 0000 0000 0002
2. Payment fails
3. Verify error handling
4. Check webhook event
```

### Scenario 3: Settlement Release
```
1. Make successful payment
2. Verify transfer on hold
3. Release settlement
4. Verify transfer released
5. Check webhook event
```

---

## 🔍 Debugging

### Check Current Mode

**Client-Side:**
```javascript
// In your app, check console logs
console.log('Razorpay Key:', RAZORPAY_KEY_ID.substring(0, 10));
// Should show: rzp_test_S for test mode
// Should show: rzp_live_S for live mode
```

**Server-Side:**
```bash
# Check Firebase secrets
firebase functions:secrets:access RAZORPAY_KEY_ID
# Should show: rzp_test_* for test mode
```

### Common Issues

**Issue: Payment shows "Test Mode" but using live key**
- Clear app cache
- Restart development server
- Check `.env` file is correct

**Issue: Webhook not received**
- Verify webhook URL is correct
- Check webhook secret matches
- Test webhook in Razorpay Dashboard

**Issue: Transfer not created**
- Verify Route is enabled (even in test mode)
- Check organizer has linkedAccountId
- View Cloud Functions logs

---

## 📊 Test Data

### Test Amounts
- Use any amount (no real money charged)
- Recommended: ₹100, ₹500, ₹1000

### Test Organizers
- Create with any bank details
- KYC not required in test mode
- Linked accounts created instantly

### Test Tournaments
- Create with any entry fee
- No player limits in test mode
- Can test multiple scenarios

---

## 🚀 Quick Test Commands

```bash
# Switch to test mode
# 1. Edit .env
code .env
# Change to: EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY

# 2. Set Firebase secrets
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET

# 3. Deploy
firebase deploy --only functions

# 4. Restart app
# Press Ctrl+C in terminal, then:
npm start

# 5. Test payment
# Use card: 4111 1111 1111 1111
```

---

## 📝 Test Checklist

### Before Testing
- [ ] Test keys obtained from Razorpay Dashboard
- [ ] Client-side key updated in `.env`
- [ ] Server-side keys set in Firebase secrets
- [ ] Functions deployed
- [ ] Webhook configured
- [ ] App restarted

### During Testing
- [ ] Payment opens in test mode
- [ ] Test card works
- [ ] Payment succeeds
- [ ] Split verified (95/5)
- [ ] Transfer on hold
- [ ] Settlement release works
- [ ] Webhook events received

### After Testing
- [ ] All tests passed
- [ ] Ready to switch to live mode
- [ ] Documentation updated

---

## 🎓 Best Practices

1. **Always test in test mode first**
   - Never test with live keys
   - Use test cards only

2. **Keep test and live keys separate**
   - Use environment variables
   - Never commit keys to git

3. **Test all scenarios**
   - Successful payments
   - Failed payments
   - Settlement releases
   - Webhook events

4. **Monitor logs**
   - Check Cloud Functions logs
   - Check Razorpay Dashboard
   - Verify webhook delivery

5. **Document test results**
   - Keep track of what works
   - Note any issues
   - Share with team

---

## 📞 Support

### Razorpay Test Mode
- **Dashboard:** https://dashboard.razorpay.com (switch to Test)
- **Docs:** https://razorpay.com/docs/payments/payments/test-card-details/
- **Support:** support@razorpay.com

### Internal Docs
- **Testing Guide:** `RAZORPAY_ROUTE_TESTING.md`
- **Implementation:** `RAZORPAY_ROUTE_IMPLEMENTATION.md`

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-24  
**Purpose:** Guide for setting up and using Razorpay test keys
