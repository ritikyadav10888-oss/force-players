# VAPT Security Audit Report - Force Player Register

**Date:** January 15, 2026
**Auditor:** Antigravity Cybersecurity Team
**Scope:** Authentication, Role-Based Access Control (RBAC), Payment Verification System.

---

## 1. Executive Summary
The application demonstrates a strong security foundation by utilizing Firebase Authentication and Cloud Firestore Security Rules. Core sensitive operations like organizer creation are delegated to the Admin SDK via Cloud Functions, ensuring proper validation. However, some inconsistencies between frontend implementation and backend rules were identified, along with potential improvements for the payment verification logic.

---

## 2. Detailed Findings

### 2.1 Owner Login & Authorization Check
**Status:** ✅ High Security (with caveats)

*   **Mechanism:** Access to the "Owner" dashboard is protected by `AuthContext` and `firestore.rules`. Authorization checks both Custom Claims (`role: 'owner'`) and a list of authorized emails.
*   **Observations:** 
    *   Hardcoded emails (`ritikyadav10888@gmail.com`, `priyanshu.force@gmail.com`) are present in `firestore.rules`.
    *   No public "Sign Up" route is available in the `(auth)` directory, preventing self-registration by attackers.
*   **Risk:** Low. The hardcoded emails serve as a "master key". 
*   **Recommendation:** Move hardcoded emails to a configuration document in Firestore or stick exclusively to Custom Claims to avoid exposing administrative emails in security rules.

### 2.2 Unauthenticated Tournament/Organizer Creation
**Status:** ✅ Secure

*   **Tournament Creation:** 
    *   Rules: `allow create: if isOwner();` in `firestore.rules`.
    *   Testing: Attempts to write to the `tournaments` collection without an "Owner" claim or email match are rejected by the Firebase server.
*   **Organizer Creation:**
    *   Mechanism: Handled via `createOrganizer` Cloud Function.
    *   Security Check: The function explicitly checks `if (!request.auth)` and verifies the caller's role before proceeding with `admin.auth().createUser()`.
    *   Testing: Anonymous or standard users cannot trigger this function successfully.

### 2.3 Razorpay Payment Verification
**Status:** ⚠️ Medium Risk (Logical Inconsistency)

*   **Finding 1: Client-Side Bypass Attempt:** 
    *   The frontend code in `app/tournament/[id].js` (lines 954-959) attempts to mark a registration as `paid: true` immediately after the Razorpay modal closes.
    *   However, the `firestore.rules` (SEC-01 FIX) correctly blocks this: `request.resource.data.paid == resource.data.paid`.
    *   **Result:** The frontend update will fail for regular players, but the server-side Webhook will still process the payment correctly. This creates a UX "flash" where the frontend thinks it failed to update, but the backend is actually secure.
*   **Finding 2: Webhook Signature Verification:**
    *   The `razorpayWebhook` function uses `JSON.stringify(req.body)` to verify the signature. 
    *   **Risk:** If the request body is transformed by middleware (e.g. key reordering), the signature verification will fail, leading to legitimate payments not being recorded.
    *   **Recommendation:** Use `req.rawBody` (if available in the environment) for HMAC verification as recommended by Razorpay.

### 2.4 Data Privacy (Master Players List)
**Status:** ⚠️ Low Risk

*   **Finding:** The `master_players` collection allows `read` and `create` for any signed-in user (`isSignedIn()`).
*   **Risk:** Since the app automatically signs users in anonymously, a malicious user could potentially iterate through emails to check if players are registered or scrape basic profiles.
*   **Recommendation:** Restrict `read` access on `master_players/{email}` such that `request.auth.token.email == email` or `isOwner()`.

---

## 3. Vulnerability Summary Table

| ID | Vulnerability | Severity | Status | Recommendation |
|:---|:---|:---|:---|:---|
| SEC-V1 | Hardcoded Admin Emails in Rules | Low | Aware | Move to Custom Claims only. |
| SEC-V2 | Client-Side Payment Update Attempt | Medium | Blocked (Rule) | Remove client-side `updateDoc` for `paid` status; rely on Webhook/Transaction. |
| SEC-V3 | Anonymous Read on Master Players | Low | Open | Restrict read access to self or owner. |
| SEC-V4 | Potential Webhook Signature Mismatch | Medium | Logical | Use `req.rawBody` for signature verification. |

---

## 4. Final Conclusion
The "Create Organizer without login" test **Passed** (blocked as intended). The "Create Tournament without login" test **Passed** (blocked as intended). The "Razorpay verification" is **Secure** from bypass due to the Firestore rules, but the frontend code should be cleaned up to reflect the actual security architecture.
