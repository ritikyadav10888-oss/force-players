# Razorpay Route Implementation Plan

## Executive Summary

This document outlines the complete migration from **RazorpayX Payouts** to **Razorpay Route with Settlement Hold**. This architectural change will simplify payment flows while maintaining owner control over organizer settlements.

---

## Current System (RazorpayX Payouts)

### Flow
1. Player pays tournament fee → All money goes to platform account
2. Owner manually marks tournament complete
3. System creates payout request to organizer (95%)
4. Platform keeps 5% commission
5. Organizer receives money after payout processes

### Components
- **Backend Functions:**
  - `razorpayXCall` - Generic RazorpayX API helper
  - `createOrganizer` - Creates Razorpay contacts and fund accounts
  - `createPayoutTransaction` - Initiates payout transaction
  - `processPayout` - Processes payout via RazorpayX
  - `syncPayoutStatus` - Manual status synchronization
  - `syncRazorpayDetails` - Auto-sync organizer bank details
  
- **Webhook Events:**
  - `payout.processed` - Payout successful
  - `payout.reversed` - Payout reversed
  - `payout.failed` - Payout failed

- **Firebase Secrets:**
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_SECRET` (webhook)
  - `RAZORPAYX_WEBHOOK_SECRET` (payout webhook)
  - `RAZORPAYX_ACCOUNT_NUMBER` (platform account)

---

## New System (Razorpay Route with Settlement Hold)

### Flow
1. Player pays tournament fee → Money automatically splits (95/5)
2. 95% transferred to organizer's linked account **but held**
3. 5% stays in platform account (instant)
4. Owner marks tournament complete → Releases the held 95%
5. Organizer receives money only after owner releases it

### Key Benefits
- ✅ Automatic payment splitting at transaction time
- ✅ No manual payout processing required
- ✅ Owner still controls when organizers get paid
- ✅ Simpler architecture with fewer moving parts
- ✅ Reduced API calls and webhook complexity

---

## Prerequisites

### 1. Razorpay Account Setup

#### Enable Route Feature
```
1. Log in to Razorpay Dashboard
2. Go to Settings → API Keys
3. Request Route feature if not visible
4. Contact: support@razorpay.com
5. Provide: Business details, use case, expected volume
6. Timeline: 1-3 business days
```

#### Enable Settlement Hold
```
1. After Route is enabled, contact Razorpay support
2. Request: "Enable Settlement Hold for Route transfers"
3. Explain: "Need to hold organizer payments until tournament completion"
4. Timeline: 1-2 business days
```

### 2. Linked Accounts for Organizers

Each organizer needs a **Razorpay Linked Account** with KYC verification:

**API Flow:**
```javascript
// Step 1: Create Linked Account
POST /v1/accounts
{
  "email": "organizer@example.com",
  "phone": "9876543210",
  "type": "route",
  "legal_business_name": "Organizer Name",
  "business_type": "individual",
  "contact_name": "Organizer Name"
}

// Step 2: Add Bank Account
POST /v1/accounts/{account_id}/stakeholders
{
  "bank_account": {
    "ifsc": "HDFC0000123",
    "account_number": "1234567890",
    "beneficiary_name": "Organizer Name"
  }
}

// Step 3: Organizer completes KYC (via email)
// - PAN card
// - Aadhaar card
// - Bank account proof
// Timeline: 1-2 business days
```

### 3. Firebase Secrets Update

**Keep:**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET` (single webhook for all events)

**Remove:**
- `RAZORPAYX_WEBHOOK_SECRET` ❌
- `RAZORPAYX_ACCOUNT_NUMBER` ❌

---

## Implementation Changes

### Phase 1: Backend Functions

#### 1.1 Remove RazorpayX Code

**File:** `functions/index.js`

**Delete:**
- Lines 28-52: `razorpayXCall` function
- Lines 187-252: Payout webhook event handling
- Lines 324-365: `createPayoutTransaction` function
- Lines 371-453: `processPayout` function
- Lines 458-534: `syncPayoutStatus` function
- Lines 559-597: `syncRazorpayDetails` trigger

**Update:**
- Line 61: Remove `RAZORPAYX_WEBHOOK_SECRET` from webhook secrets
- Lines 70-84: Remove RazorpayX webhook verification logic

#### 1.2 Create New Helper Functions

**Add to `functions/index.js`:**

```javascript
/**
 * Create Razorpay Linked Account for Organizer
 */
const createLinkedAccount = async (organizerData, secrets) => {
    const auth = Buffer.from(`${secrets.RAZORPAY_KEY_ID}:${secrets.RAZORPAY_KEY_SECRET}`).toString('base64');
    
    // Create linked account
    const accountResponse = await fetch('https://api.razorpay.com/v1/accounts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({
            email: organizerData.email,
            phone: organizerData.phone,
            type: 'route',
            legal_business_name: organizerData.name,
            business_type: 'individual',
            contact_name: organizerData.name,
            reference_id: organizerData.uid
        })
    });
    
    if (!accountResponse.ok) {
        const error = await accountResponse.json();
        throw new Error(error.error?.description || 'Failed to create linked account');
    }
    
    const account = await accountResponse.json();
    
    // Add bank account details
    const stakeholderResponse = await fetch(`https://api.razorpay.com/v1/accounts/${account.id}/stakeholders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({
            bank_account: {
                ifsc: organizerData.bankDetails.ifsc.trim().toUpperCase(),
                account_number: String(organizerData.bankDetails.accountNumber).replace(/[^a-zA-Z0-9]/g, ''),
                beneficiary_name: organizerData.name
            }
        })
    });
    
    if (!stakeholderResponse.ok) {
        const error = await stakeholderResponse.json();
        throw new Error(error.error?.description || 'Failed to add bank account');
    }
    
    return account;
};
```

#### 1.3 Update createOrganizer Function

**Replace lines 261-319 with:**

```javascript
exports.createOrganizer = onCall(
    { secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
    async (request) => {
        if (!request.auth || (request.auth.token.role !== 'owner' && !request.auth.token.admin)) {
            throw new HttpsError('permission-denied', 'Unauthorized');
        }

        const { email, password, name, phone, bankDetails } = request.data;

        try {
            // Create Firebase Auth User
            const userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: name,
                phoneNumber: phone
            });

            // Set Custom Claims
            await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'organizer' });

            // Create Razorpay Linked Account
            const linkedAccount = await createLinkedAccount({
                uid: userRecord.uid,
                email,
                name,
                phone,
                bankDetails
            }, {
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
            });

            // Store in Firestore
            await db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email,
                name,
                phone,
                role: 'organizer',
                bankDetails,
                linkedAccountId: linkedAccount.id,
                linkedAccountStatus: linkedAccount.status, // active, pending, suspended
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { 
                success: true, 
                uid: userRecord.uid,
                linkedAccountId: linkedAccount.id,
                kycRequired: linkedAccount.status !== 'active'
            };
        } catch (error) {
            throw new HttpsError('internal', error.message);
        }
    }
);
```

#### 1.4 Create Payment with Route Function

**Add new function:**

```javascript
/**
 * Create Razorpay Order with Route Transfers
 * Called before opening Razorpay checkout
 */
exports.createPaymentWithRoute = onCall(
    { secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
    async (request) => {
        const { tournamentId, playerId, amount } = request.data;
        
        if (!tournamentId || !playerId || !amount) {
            throw new HttpsError('invalid-argument', 'Missing required fields');
        }

        try {
            // Get tournament details
            const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
            if (!tournamentDoc.exists) {
                throw new HttpsError('not-found', 'Tournament not found');
            }
            
            const tournament = tournamentDoc.data();
            
            // Get organizer's linked account
            const organizerDoc = await db.collection('users').doc(tournament.organizerId).get();
            if (!organizerDoc.exists) {
                throw new HttpsError('not-found', 'Organizer not found');
            }
            
            const organizer = organizerDoc.data();
            if (!organizer.linkedAccountId) {
                throw new HttpsError('failed-precondition', 'Organizer has no linked account');
            }
            
            if (organizer.linkedAccountStatus !== 'active') {
                throw new HttpsError('failed-precondition', 'Organizer KYC not completed');
            }
            
            // Calculate split amounts (in paise)
            const totalAmount = Math.round(amount * 100);
            const organizerShare = Math.round(totalAmount * 0.95);
            const platformCommission = totalAmount - organizerShare;
            
            // Create Razorpay instance
            const rzp = getRazorpayInstance({
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
            });
            
            // Create order with Route transfers
            const order = await rzp.orders.create({
                amount: totalAmount,
                currency: 'INR',
                receipt: `tournament_${tournamentId}_${Date.now()}`,
                notes: {
                    tournamentId,
                    playerId,
                    tournamentName: tournament.name
                },
                transfers: [
                    {
                        account: organizer.linkedAccountId,
                        amount: organizerShare,
                        currency: 'INR',
                        notes: {
                            type: 'organizer_share',
                            tournamentId,
                            playerId
                        },
                        linked_account_notes: [
                            `Tournament: ${tournament.name}`,
                            `Player: ${playerId}`
                        ],
                        on_hold: true, // CRITICAL: Hold settlement until owner releases
                        on_hold_until: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days max hold
                    }
                ]
            });
            
            console.log(`✅ Order created with Route: ${order.id}`);
            console.log(`💰 Split: ₹${organizerShare/100} (held) + ₹${platformCommission/100} (instant)`);
            
            return {
                success: true,
                orderId: order.id,
                amount: totalAmount,
                organizerShare: organizerShare / 100,
                platformCommission: platformCommission / 100
            };
            
        } catch (error) {
            console.error('❌ Order creation error:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);
```

#### 1.5 Create Release Settlement Function

**Add new function:**

```javascript
/**
 * Release Settlement to Organizer
 * Called by owner when marking tournament complete
 */
exports.releaseSettlement = onCall(
    { secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
    async (request) => {
        if (!request.auth || (request.auth.token.role !== 'owner' && !request.auth.token.admin)) {
            throw new HttpsError('permission-denied', 'Unauthorized');
        }

        const { tournamentId } = request.data;
        
        if (!tournamentId) {
            throw new HttpsError('invalid-argument', 'Tournament ID required');
        }

        try {
            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();
            
            if (!tournamentDoc.exists) {
                throw new HttpsError('not-found', 'Tournament not found');
            }
            
            const tournament = tournamentDoc.data();
            
            if (tournament.settlementStatus === 'released') {
                throw new HttpsError('already-exists', 'Settlement already released');
            }
            
            // Get all transactions with held transfers
            const transactionsSnap = await db.collection('transactions')
                .where('tournamentId', '==', tournamentId)
                .where('type', '==', 'collection')
                .where('settlementHeld', '==', true)
                .get();
            
            if (transactionsSnap.empty) {
                throw new HttpsError('not-found', 'No held settlements found');
            }
            
            const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
            const releasedTransfers = [];
            
            // Release each transfer
            for (const txnDoc of transactionsSnap.docs) {
                const txn = txnDoc.data();
                
                if (txn.transferId) {
                    // Release the transfer
                    const response = await fetch(`https://api.razorpay.com/v1/transfers/${txn.transferId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Basic ${auth}`
                        },
                        body: JSON.stringify({
                            on_hold: false
                        })
                    });
                    
                    if (response.ok) {
                        const transfer = await response.json();
                        releasedTransfers.push(transfer.id);
                        
                        // Update transaction
                        await txnDoc.ref.update({
                            settlementHeld: false,
                            transferStatus: 'processing',
                            releasedAt: admin.firestore.FieldValue.serverTimestamp(),
                            releasedBy: request.auth.uid
                        });
                    } else {
                        console.error(`Failed to release transfer ${txn.transferId}`);
                    }
                }
            }
            
            // Update tournament
            await tournamentRef.update({
                settlementStatus: 'released',
                settlementReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
                settlementReleasedBy: request.auth.uid
            });
            
            console.log(`✅ Released ${releasedTransfers.length} settlements for tournament ${tournamentId}`);
            
            return {
                success: true,
                releasedCount: releasedTransfers.length,
                transferIds: releasedTransfers
            };
            
        } catch (error) {
            console.error('❌ Settlement release error:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);
```

#### 1.6 Update Webhook Handler

**Update webhook to handle transfer events:**

```javascript
// Add after payment event handling (around line 185)

// Handle Transfer Events (Razorpay Route)
else if (event.startsWith('transfer.')) {
    const transfer = payload.transfer.entity;
    const { tournamentId, playerId } = transfer.notes || {};
    
    if (event === 'transfer.processed') {
        // Transfer successfully settled to organizer
        if (tournamentId) {
            // Update transaction status
            const transactionsSnap = await db.collection('transactions')
                .where('transferId', '==', transfer.id)
                .limit(1)
                .get();
            
            if (!transactionsSnap.empty) {
                await transactionsSnap.docs[0].ref.update({
                    transferStatus: 'processed',
                    settlementCompletedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Update tournament
            await db.collection('tournaments').doc(tournamentId).update({
                settlementStatus: 'completed',
                settlementCompletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ Transfer processed: ${transfer.id}`);
        }
    } else if (event === 'transfer.failed') {
        // Transfer failed
        if (tournamentId) {
            const transactionsSnap = await db.collection('transactions')
                .where('transferId', '==', transfer.id)
                .limit(1)
                .get();
            
            if (!transactionsSnap.empty) {
                await transactionsSnap.docs[0].ref.update({
                    transferStatus: 'failed',
                    failureReason: transfer.failure_reason || 'Transfer failed'
                });
            }
            
            console.error(`❌ Transfer failed: ${transfer.id}`);
        }
    }
}
```

### Phase 2: Database Schema Updates

#### 2.1 Users Collection (Organizers)

**Remove:**
```javascript
{
  razorpayContactId: "removed",
  razorpayFundAccountId: "removed"
}
```

**Add:**
```javascript
{
  linkedAccountId: "acc_xxxxx",
  linkedAccountStatus: "active" // active, pending, suspended
}
```

#### 2.2 Transactions Collection

**Add fields for collection transactions:**
```javascript
{
  transferId: "trf_xxxxx",
  transferStatus: "on_hold", // on_hold, processing, processed, failed, reversed
  organizerShare: 95.00,
  platformCommission: 5.00,
  settlementHeld: true,
  releasedAt: null,
  releasedBy: null
}
```

#### 2.3 Tournaments Collection

**Update fields:**
```javascript
{
  settlementStatus: "held", // held, released, completed
  totalHeldAmount: 950.00,
  settlementReleasedAt: null,
  settlementReleasedBy: null
}
```

### Phase 3: Client-Side Updates

#### 3.1 Update RazorpayService.js

**Modify payment flow:**

```javascript
// Before opening checkout, create order with Route
const createPaymentWithRoute = async (tournamentId, playerId, amount) => {
    const createPaymentWithRoute = httpsCallable(functions, 'createPaymentWithRoute');
    const result = await createPaymentWithRoute({
        tournamentId,
        playerId,
        amount
    });
    return result.data;
};

// Update openCheckout to use order_id
export const RazorpayService = {
    // ... existing code ...
    
    openCheckout: async (options) => {
        // Create order with Route first
        const orderData = await createPaymentWithRoute(
            options.tournamentId,
            options.playerId,
            options.amount
        );
        
        const fullOptions = {
            ...options,
            key: options.key || RAZORPAY_KEY_ID,
            order_id: orderData.orderId, // Use order ID from backend
            amount: orderData.amount.toString(),
            currency: 'INR',
            // ... rest of options
        };
        
        // Open checkout with order
        // ... existing checkout code ...
    }
};
```

#### 3.2 Update Owner Dashboard

**Replace "Process Payout" with "Release Settlement":**

```javascript
// In owner dashboard tournaments view
const handleReleaseSettlement = async (tournamentId) => {
    try {
        const releaseSettlement = httpsCallable(functions, 'releaseSettlement');
        const result = await releaseSettlement({ tournamentId });
        
        if (result.data.success) {
            Alert.alert('Success', `Released ${result.data.releasedCount} settlements`);
        }
    } catch (error) {
        Alert.alert('Error', error.message);
    }
};
```

---

## Migration Steps

### Step 1: Razorpay Setup (1-5 days)
1. ✅ Enable Route feature in Razorpay Dashboard
2. ✅ Enable Settlement Hold feature
3. ✅ Test with sandbox account first

### Step 2: Backend Implementation (1 day)
1. ✅ Add helper functions
2. ✅ Update createOrganizer
3. ✅ Create createPaymentWithRoute
4. ✅ Create releaseSettlement
5. ✅ Update webhook handler
6. ✅ Remove old payout functions

### Step 3: Update Firebase Secrets (10 minutes)
```bash
# Remove old secrets
firebase functions:secrets:destroy RAZORPAYX_WEBHOOK_SECRET
firebase functions:secrets:destroy RAZORPAYX_ACCOUNT_NUMBER

# Verify remaining secrets
firebase functions:secrets:access RAZORPAY_KEY_ID
firebase functions:secrets:access RAZORPAY_KEY_SECRET
firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET
```

### Step 4: Deploy Functions (5 minutes)
```bash
firebase deploy --only functions
```

### Step 5: Client-Side Updates (2 hours)
1. ✅ Update RazorpayService.js
2. ✅ Update owner dashboard
3. ✅ Update organizer dashboard
4. ✅ Update financial reports

### Step 6: Data Migration (1 hour)
1. ✅ Migrate existing organizers to linked accounts
2. ✅ Update existing tournaments
3. ✅ Archive old payout records

### Step 7: Testing (1 day)
1. ✅ Test linked account creation
2. ✅ Test payment with Route
3. ✅ Test settlement hold
4. ✅ Test settlement release
5. ✅ Test webhook events
6. ✅ Test financial reports

---

## Verification Checklist

### Automated Tests
- [ ] No "razorpayx" references in codebase
- [ ] No "payout" references in functions
- [ ] All old functions removed
- [ ] Functions deploy successfully

### Manual Tests
- [ ] Create new organizer → Linked account created
- [ ] Player payment → Splits correctly (95/5)
- [ ] Platform receives 5% instantly
- [ ] Organizer's 95% is held
- [ ] Owner releases settlement → Transfer released
- [ ] Organizer receives money after release
- [ ] Webhook events processed correctly
- [ ] Financial reports accurate

---

## Rollback Plan

If issues arise:

1. **Keep old code in git history**
2. **Revert functions deployment:**
   ```bash
   git revert <commit-hash>
   firebase deploy --only functions
   ```
3. **Restore secrets:**
   ```bash
   firebase functions:secrets:set RAZORPAYX_WEBHOOK_SECRET
   firebase functions:secrets:set RAZORPAYX_ACCOUNT_NUMBER
   ```

---

## Support Contacts

- **Razorpay Support:** support@razorpay.com
- **Razorpay Dashboard:** https://dashboard.razorpay.com
- **Route Documentation:** https://razorpay.com/docs/route/

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Razorpay Setup | 1-5 days | Razorpay approval |
| Backend Implementation | 1 day | - |
| Client Updates | 2 hours | Backend complete |
| Testing | 1 day | All code complete |
| **Total** | **2-7 days** | Razorpay approval time |

---

## Success Criteria

✅ All payments automatically split 95/5  
✅ Organizer funds held until owner releases  
✅ No manual payout processing required  
✅ All webhook events handled correctly  
✅ Financial reports accurate  
✅ Zero downtime during migration  

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-24  
**Status:** Ready for Implementation
