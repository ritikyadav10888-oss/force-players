# 🔗 Razorpay Webhook Secret Setup

## ⚠️ Current Issue

The deployment failed because `RAZORPAY_WEBHOOK_SECRET` is not set.

**Error:**
```
Secret [projects/1099168561002/secrets/RAZORPAY_WEBHOOK_SECRET] not found or has no versions.
```

---

## 🔧 How to Fix (5 minutes)

### Step 1: Get Webhook Secret from Razorpay

1. **Go to Razorpay Dashboard**
   - URL: https://dashboard.razorpay.com
   - **IMPORTANT:** Switch to **Test Mode** (toggle in top-left corner)

2. **Navigate to Webhooks**
   - Click **Settings** (gear icon)
   - Click **Webhooks** in the left menu

3. **Create or View Webhook**
   
   **If you already have a webhook:**
   - Click on the existing webhook
   - Copy the **Webhook Secret** (looks like: `whsec_xxxxxxxxxxxxx`)
   
   **If you need to create a new webhook:**
   - Click **Create New Webhook**
   - **Webhook URL:** `https://us-central1-force-player-register-ap-ade3a.cloudfunctions.net/razorpayWebhook`
   - **Alert Email:** Your email
   - **Active Events:** Select these:
     - ✅ `payment.authorized`
     - ✅ `payment.captured`
     - ✅ `payment.failed`
     - ✅ `transfer.processed`
     - ✅ `transfer.failed`
   - Click **Create Webhook**
   - Copy the **Webhook Secret** shown

### Step 2: Set the Secret in Firebase

The command is already running. When prompted:

```bash
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
# Paste the webhook secret you copied from Razorpay Dashboard
```

**Example webhook secret format:**
```
whsec_abcdefghijklmnopqrstuvwxyz123456
```

### Step 3: Deploy Functions

After setting the webhook secret:

```bash
firebase deploy --only functions
```

---

## 📋 Complete Webhook Configuration

### Your Webhook URL
```
https://us-central1-force-player-register-ap-ade3a.cloudfunctions.net/razorpayWebhook
```

### Events to Enable

**Payment Events:**
- ✅ `payment.authorized` - Payment authorized but not captured
- ✅ `payment.captured` - Payment successfully captured
- ✅ `payment.failed` - Payment failed

**Transfer Events (Razorpay Route):**
- ✅ `transfer.processed` - Transfer completed to organizer
- ✅ `transfer.failed` - Transfer failed

**DO NOT enable these (old RazorpayX events):**
- ❌ `payout.processed`
- ❌ `payout.reversed`
- ❌ `payout.failed`

---

## 🔍 How to Find Your Webhook Secret

### Visual Guide

1. **Razorpay Dashboard → Settings → Webhooks**
   ```
   ┌─────────────────────────────────────┐
   │ Webhooks                            │
   ├─────────────────────────────────────┤
   │ ┌─────────────────────────────────┐ │
   │ │ Webhook URL                     │ │
   │ │ https://...razorpayWebhook      │ │
   │ │                                 │ │
   │ │ Webhook Secret                  │ │
   │ │ whsec_xxxxxxxxxxxxx  [Copy]     │ │
   │ │                                 │ │
   │ │ Active Events                   │ │
   │ │ ☑ payment.captured              │ │
   │ │ ☑ transfer.processed            │ │
   │ └─────────────────────────────────┘ │
   └─────────────────────────────────────┘
   ```

2. **Click the Copy button** next to Webhook Secret

3. **Paste it** when Firebase prompts for the secret

---

## ✅ Verification

After setting the webhook secret and deploying:

### Check Secret is Set
```bash
firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET
# Should show: whsec_xxxxxxxxxxxxx
```

### Check All Secrets
```bash
# Should all be set with test values
firebase functions:secrets:access RAZORPAY_KEY_ID
# Shows: rzp_test_S7hNQVFMSudblg

firebase functions:secrets:access RAZORPAY_KEY_SECRET
# Shows: BbiWuz8TSlez1FUV4E1sz6o4

firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET
# Shows: whsec_xxxxxxxxxxxxx
```

### Test Webhook
1. Go to Razorpay Dashboard → Webhooks
2. Click on your webhook
3. Click **Send Test Webhook**
4. Select event: `payment.captured`
5. Check Cloud Functions logs:
   ```bash
   firebase functions:log --only razorpayWebhook
   ```

---

## 🚨 Common Issues

### Issue: Can't find webhook secret
**Solution:**
- Make sure you're in **Test Mode** in Razorpay Dashboard
- Look for the webhook you created
- The secret is shown when you create or view the webhook

### Issue: Webhook secret starts with "rzp_"
**Solution:**
- That's the API key, not the webhook secret
- Webhook secret starts with "whsec_"
- Go to Settings → Webhooks (not API Keys)

### Issue: Multiple webhooks exist
**Solution:**
- Use the webhook for your Cloud Functions URL
- Delete old/unused webhooks
- Each webhook has its own secret

---

## 📝 Quick Commands

```bash
# Set webhook secret (run this now)
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET

# Deploy functions
firebase deploy --only functions

# Verify all secrets
firebase functions:secrets:access RAZORPAY_KEY_ID
firebase functions:secrets:access RAZORPAY_KEY_SECRET
firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET

# View logs
firebase functions:log
```

---

## 🎯 Next Steps After Setting Webhook Secret

1. ✅ Set `RAZORPAY_WEBHOOK_SECRET`
2. ✅ Deploy functions: `firebase deploy --only functions`
3. ✅ Restart development server
4. ✅ Test payment with card: 4111 1111 1111 1111
5. ✅ Verify webhook events in Razorpay Dashboard

---

## 📞 Need Help?

### Razorpay Dashboard
- **URL:** https://dashboard.razorpay.com
- **Mode:** Test (toggle in top-left)
- **Section:** Settings → Webhooks

### Documentation
- **Razorpay Webhooks:** https://razorpay.com/docs/webhooks/
- **Testing Guide:** `RAZORPAY_ROUTE_TESTING.md`

---

**Current Status:**
- ✅ RAZORPAY_KEY_ID set
- ✅ RAZORPAY_KEY_SECRET set
- ⏳ RAZORPAY_WEBHOOK_SECRET - **Set this now!**

**After setting webhook secret, run:**
```bash
firebase deploy --only functions
```

---

**Document Version:** 1.0  
**Created:** 2026-01-24  
**Purpose:** Guide to set up Razorpay webhook secret
