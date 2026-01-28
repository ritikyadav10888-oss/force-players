# Security Audit Report - Force Player Register
**Date:** January 20, 2026  
**Auditor:** AI Security Analysis  
**Application:** Tournament Management & Payment System

---

## Executive Summary

Overall Security Rating: **7.5/10** (Good, with improvements needed)

The application has strong security foundations but has several vulnerabilities that need immediate attention, particularly around secret management and access controls.

---

## 🔴 CRITICAL VULNERABILITIES (Fix Immediately)

### 1. **Hardcoded Razorpay API Key in Client Code**
**Severity:** CRITICAL  
**Location:** `src/services/RazorpayService.js:14`

```javascript
const RAZORPAY_KEY_ID = 'rzp_test_S5ikbrvHiapDKJ';
```

**Risk:**
- API key is exposed in client-side code
- Anyone can view source code and extract the key
- Key can be used to create unauthorized payment requests
- Even though it's a test key, it's still a security risk

**Recommendation:**
```javascript
// Use environment variables instead
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
```

**Action Required:**
1. Move key to `.env` file
2. Add `.env` to `.gitignore`
3. Use `EXPO_PUBLIC_` prefix for Expo apps
4. Rotate the API key in Razorpay Dashboard

---

### 2. **Missing Rate Limiting on Payment Verification**
**Severity:** HIGH  
**Location:** `functions/index.js` - `verifyPayment` function

**Risk:**
- Attackers can spam the verification endpoint
- Could lead to excessive API calls to Razorpay
- Potential for DoS attacks
- No protection against brute force attempts

**Recommendation:**
Implement rate limiting using Firebase App Check or custom middleware:

```javascript
exports.verifyPayment = onCall(
    { 
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        enforceAppCheck: true, // Add App Check
        consumeAppCheckToken: true
    },
    async (request) => {
        // Add rate limiting check
        const userId = request.auth?.uid;
        const rateLimitKey = `verify_payment_${userId}`;
        
        // Check if user has exceeded rate limit (e.g., 5 attempts per minute)
        // Implementation needed
        
        // ... rest of code
    }
);
```

---

### 3. **Insufficient Input Validation in Payment Verification**
**Severity:** HIGH  
**Location:** `functions/index.js:604-780`

**Risk:**
- Missing validation for payment amounts
- No check for duplicate verification attempts
- Could allow double-spending attacks

**Current Code:**
```javascript
if (!razorpay_payment_id) {
    throw new HttpsError('invalid-argument', 'Missing payment ID');
}
```

**Recommended Fix:**
```javascript
// Add comprehensive validation
if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid payment ID format');
}

if (razorpay_payment_id.length > 50) {
    throw new HttpsError('invalid-argument', 'Payment ID too long');
}

// Check for duplicate verification
const existingVerification = await db.collection('payment_verification_logs')
    .where('razorpay_payment_id', '==', razorpay_payment_id)
    .where('status', '==', 'VERIFIED')
    .limit(1)
    .get();

if (!existingVerification.empty) {
    throw new HttpsError('already-exists', 'Payment already verified');
}
```

---

## 🟡 HIGH PRIORITY ISSUES

### 4. **Firestore Rules Allow Transaction Creation by Any Signed-In User**
**Severity:** MEDIUM-HIGH  
**Location:** `firestore.rules:124`

```javascript
match /transactions/{transactionId} {
    allow create: if isSignedIn(); // Too permissive
}
```

**Risk:**
- Any authenticated user can create fake transactions
- Could manipulate financial records
- No validation of transaction data

**Recommendation:**
```javascript
match /transactions/{transactionId} {
    // Only allow Cloud Functions to create transactions
    allow create: if false; // Block all client-side creates
    allow read: if isSignedIn() && (
        isOwner() || 
        request.auth.uid == resource.data.organizerId ||
        request.auth.uid == resource.data.playerId
    );
}
```

---

### 5. **Missing Payment Amount Verification**
**Severity:** MEDIUM-HIGH  
**Location:** `functions/index.js:verifyPayment`

**Risk:**
- No verification that payment amount matches expected tournament fee
- Could allow players to pay less than required

**Recommendation:**
```javascript
// After fetching payment from Razorpay
const payment = await rzp.payments.fetch(razorpay_payment_id);

// Verify amount matches tournament fee
if (finalTournamentId) {
    const tournamentDoc = await db.collection('tournaments').doc(finalTournamentId).get();
    const expectedAmount = tournamentDoc.data()?.entryFee || 0;
    const paidAmount = payment.amount / 100;
    
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        throw new HttpsError('invalid-argument', 
            `Amount mismatch: expected ₹${expectedAmount}, got ₹${paidAmount}`);
    }
}
```

---

### 6. **No Protection Against Replay Attacks on Webhooks**
**Severity:** MEDIUM  
**Location:** `functions/index.js:60-93`

**Risk:**
- Same webhook could be processed multiple times
- Could lead to duplicate payment credits

**Recommendation:**
```javascript
// Add webhook deduplication
const webhookId = crypto.createHash('sha256')
    .update(body.toString() + signature)
    .digest('hex');

const existingWebhook = await db.collection('processed_webhooks')
    .doc(webhookId)
    .get();

if (existingWebhook.exists) {
    console.log('⚠️ Duplicate webhook detected, ignoring');
    return res.status(200).send('Already processed');
}

// Mark as processed
await db.collection('processed_webhooks').doc(webhookId).set({
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    event: event
});
```

---

## 🟢 MEDIUM PRIORITY ISSUES

### 7. **Sensitive Data Exposure in Console Logs**
**Severity:** MEDIUM  
**Location:** Multiple files

**Examples:**
```javascript
console.log("Opening Razorpay Checkout with options:", { ...fullOptions, key: '***' });
console.log(`🔐 Verifying payment: ${razorpay_payment_id}`);
```

**Risk:**
- Payment IDs and transaction details logged
- Could be exposed in production logs
- Potential GDPR/PCI compliance issues

**Recommendation:**
- Remove or redact sensitive data in production
- Use structured logging with log levels
- Implement log sanitization

---

### 8. **Missing CORS Configuration for Webhook Endpoint**
**Severity:** MEDIUM  
**Location:** `functions/index.js:60`

**Risk:**
- Webhook endpoint might accept requests from any origin
- Could be exploited for CSRF attacks

**Recommendation:**
```javascript
exports.razorpayWebhook = onRequest(
    { 
        secrets: [...],
        cors: false // Explicitly disable CORS for webhooks
    },
    async (req, res) => {
        // Verify request origin
        const origin = req.headers.origin;
        const allowedOrigins = ['https://api.razorpay.com'];
        
        if (origin && !allowedOrigins.includes(origin)) {
            return res.status(403).send('Forbidden origin');
        }
        // ... rest of code
    }
);
```

---

### 9. **No Timeout Protection on Razorpay API Calls**
**Severity:** MEDIUM  
**Location:** `functions/index.js:razorpayXCall`

**Risk:**
- API calls could hang indefinitely
- Could exhaust Cloud Function resources

**Recommendation:**
```javascript
const response = await Promise.race([
    fetch(`https://api.razorpay.com/v1/${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: data ? JSON.stringify(data) : null
    }),
    new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
    )
]);
```

---

## 🔵 LOW PRIORITY / BEST PRACTICES

### 10. **Missing Email Validation in Registration**
**Severity:** LOW  
**Location:** `app/tournament/[id].js`

**Recommendation:**
Add server-side email validation in Cloud Functions

---

### 11. **No Audit Trail for Administrative Actions**
**Severity:** LOW  

**Recommendation:**
Log all owner/organizer actions (tournament creation, payout initiation, etc.)

---

### 12. **Missing Content Security Policy (CSP)**
**Severity:** LOW  

**Recommendation:**
Implement CSP headers for web deployment

---

## ✅ SECURITY STRENGTHS

1. **✓ Webhook Signature Verification** - Properly implemented
2. **✓ Server-Side Payment Verification** - Good dual-verification approach
3. **✓ Firestore Security Rules** - Generally well-structured
4. **✓ Role-Based Access Control** - Proper owner/organizer/player separation
5. **✓ Auto-Capture Implementation** - Prevents payment authorization loss
6. **✓ Transaction Logging** - Good audit trail for payments
7. **✓ Secret Management** - Using Firebase Secret Manager (backend)

---

## 📋 IMMEDIATE ACTION ITEMS

**Priority 1 (This Week):**
1. Remove hardcoded Razorpay key from client code
2. Implement rate limiting on verifyPayment
3. Add payment amount verification
4. Restrict transaction creation in Firestore rules

**Priority 2 (This Month):**
5. Implement webhook deduplication
6. Add comprehensive input validation
7. Sanitize production logs
8. Add CORS protection

**Priority 3 (Next Quarter):**
9. Implement Firebase App Check
10. Add audit logging for admin actions
11. Conduct penetration testing
12. Implement CSP headers

---

## 🔒 COMPLIANCE NOTES

**PCI DSS:**
- ✓ Not storing card data (handled by Razorpay)
- ⚠️ Need to secure API keys better
- ⚠️ Need to implement proper logging controls

**GDPR:**
- ⚠️ Need data retention policies
- ⚠️ Need user data deletion mechanism
- ⚠️ Need consent management for email collection

---

## 📞 RECOMMENDED SECURITY TOOLS

1. **Firebase App Check** - Protect against abuse
2. **Sentry** - Error tracking and monitoring
3. **OWASP ZAP** - Security testing
4. **npm audit** - Dependency vulnerability scanning
5. **Snyk** - Continuous security monitoring

---

**Report End**
