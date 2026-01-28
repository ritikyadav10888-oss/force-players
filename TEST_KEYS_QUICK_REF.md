# 🔑 Razorpay Test Keys - Quick Reference

## Get Your Test Keys

1. **Login:** https://dashboard.razorpay.com
2. **Switch to Test Mode** (toggle in top-left)
3. **Go to:** Settings → API Keys
4. **Copy:**
   - Key ID: `rzp_test_xxxxxxxxxxxxxx`
   - Key Secret: `xxxxxxxxxxxxxxxxxxxxxx`

---

## Setup Test Keys

### Client (Frontend)
Edit `.env`:
```bash
# Comment live key, uncomment test key
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
```

### Server (Backend)
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
# Paste: rzp_test_YOUR_TEST_KEY_ID

firebase functions:secrets:set RAZORPAY_KEY_SECRET
# Paste: YOUR_TEST_KEY_SECRET

firebase deploy --only functions
```

---

## Test Cards

### ✅ Success
```
Card: 4111 1111 1111 1111
CVV: 123
Expiry: 12/25
```

### ❌ Failure
```
Card: 4000 0000 0000 0002
CVV: 123
Expiry: 12/25
```

### 💳 UPI
```
UPI ID: success@razorpay
```

---

## Quick Test

1. Create organizer
2. Make payment with test card
3. Verify 95/5 split in Razorpay Dashboard
4. Release settlement
5. Check webhook events

---

## Switch Back to Live

### Client
```bash
# Edit .env
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_S4UFro656NZEhB
```

### Server
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
# Paste: rzp_live_S4UFro656NZEhB

firebase functions:secrets:set RAZORPAY_KEY_SECRET
# Paste: YOUR_LIVE_KEY_SECRET

firebase deploy --only functions
```

---

## Verify Mode

**Check console logs:**
```
🔑 Razorpay Active Key: rzp_test_S... (TEST MODE)
🔑 Razorpay Active Key: rzp_live_S... (LIVE MODE)
```

---

**Full Guide:** `RAZORPAY_TEST_KEYS_GUIDE.md`
