const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const Razorpay = require('razorpay');

/**
 * Razorpay Initialization
 * Secrets must be set: firebase functions:secrets:set RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET
 */
const getRazorpayInstance = (secrets) => {
    // Robust trimming to prevent "Authentication failed" from trailing spaces/newlines
    const keyId = (secrets.RAZORPAY_KEY_ID || "").trim();
    const keySecret = (secrets.RAZORPAY_KEY_SECRET || "").trim();

    if (!keyId) {
        console.error("❌ RAZORPAY_KEY_ID is missing in process.env / secrets");
    }

    if (!keySecret) {
        console.error("❌ RAZORPAY_KEY_SECRET is missing in process.env / secrets");
    }

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
};

/**
 * Create Razorpay Linked Account for Organizer (Route)
 */
const createLinkedAccount = async (organizerData, secrets) => {
    const cleanId = secrets.RAZORPAY_KEY_ID?.trim();
    const cleanSecret = secrets.RAZORPAY_KEY_SECRET?.trim();
    const auth = Buffer.from(`${cleanId}:${cleanSecret}`).toString('base64');

    // Step 1: Create linked account
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
        const error = await accountResponse.json().catch(() => ({}));
        console.error(`❌ Account creation error:`, JSON.stringify(error));
        throw new Error(error.error?.description || 'Failed to create linked account');
    }

    const account = await accountResponse.json();

    // Step 2: Add bank account details
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
        const error = await stakeholderResponse.json().catch(() => ({}));
        console.error(`❌ Bank account addition error:`, JSON.stringify(error));
        throw new Error(error.error?.description || 'Failed to add bank account');
    }

    return account;
};

/**
 * Unified Razorpay Webhook (Payments + Route Transfers)
 */
exports.razorpayWebhook = onRequest(
    { secrets: ["RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
    async (req, res) => {
        const signature = req.headers['x-razorpay-signature'];
        const body = req.rawBody;

        if (!body) {
            return res.status(400).send('Missing body');
        }

        const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Signature Verification
        let isValid = false;
        try {
            if (RAZORPAY_WEBHOOK_SECRET) {
                isValid = Razorpay.validateWebhookSignature(body.toString(), signature, RAZORPAY_WEBHOOK_SECRET);
            }
        } catch (err) {
            console.error('❌ Verification error');
        }

        if (!isValid) {
            console.error('❌ Signature mismatch');
            return res.status(400).send('Invalid Signature');
        }

        const event = req.body.event;
        const payload = req.body.payload;

        // Handle Payment Events
        if (event.startsWith('payment.') || event.startsWith('order.') || event.startsWith('invoice.')) {
            const entity = payload.payment ? payload.payment.entity : (payload.order ? payload.order.entity : (payload.invoice ? payload.invoice.entity : null));
            if (!entity) return res.status(200).send('No entity');

            if (event === 'payment.captured' || event === 'order.paid' || event === 'payment.authorized') {
                const { tournamentId, playerId } = entity.notes || {};
                if (tournamentId && playerId) {
                    try {
                        const tournamentRef = db.collection('tournaments').doc(tournamentId);
                        const playerRef = tournamentRef.collection('players').doc(playerId);

                        await db.runTransaction(async (transaction) => {
                            const playerDoc = await transaction.get(playerRef);
                            const tournamentDoc = await transaction.get(tournamentRef);

                            if (!playerDoc.exists) return;
                            if (!playerDoc.data().paid) {
                                // AUTO-CAPTURE LOGIC: If payment is only authorized, capture it first
                                if (event === 'payment.authorized') {
                                    try {
                                        const rzp = getRazorpayInstance({
                                            RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                                            RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
                                        });
                                        await rzp.payments.capture(entity.id, entity.amount, entity.currency || 'INR');
                                    } catch (captureErr) {
                                        console.error(`❌ Capture Failed`);
                                        if (!captureErr.message?.includes('already been captured')) {
                                            throw new Error("Capture failed, rolling back transaction");
                                        }
                                    }
                                }

                                transaction.update(playerRef, {
                                    paid: true,
                                    paymentId: entity.id,
                                    orderId: entity.order_id || null,
                                    method: entity.method || 'unknown',
                                    paidAmount: (entity.amount || 0) / 100,
                                    paidAt: admin.firestore.FieldValue.serverTimestamp()
                                });

                                transaction.update(tournamentRef, {
                                    totalCollections: admin.firestore.FieldValue.increment((entity.amount || 0) / 100),
                                    paidPlayerCount: admin.firestore.FieldValue.increment(1)
                                });

                                // Calculate split amounts
                                const totalAmount = (entity.amount || 0) / 100;
                                const organizerShare = totalAmount * 0.95;
                                const platformCommission = totalAmount * 0.05;

                                const transactionIdFromNotes = entity.notes.transactionId;
                                const tRef = db.collection('transactions').doc(transactionIdFromNotes || entity.id);
                                transaction.set(tRef, {
                                    id: transactionIdFromNotes || entity.id,
                                    type: 'collection',
                                    ownerId: 'force_owner',
                                    tournamentId,
                                    tournamentName: tournamentDoc.exists ? tournamentDoc.data().name : 'Tournament',
                                    playerId,
                                    playerName: playerDoc.data().playerName || 'Player',
                                    amount: totalAmount,
                                    organizerShare: parseFloat(organizerShare.toFixed(2)),
                                    platformCommission: parseFloat(platformCommission.toFixed(2)),
                                    status: 'SUCCESS',
                                    method: entity.method || 'unknown',
                                    razorpayPaymentId: entity.id,
                                    razorpayOrderId: entity.order_id || null,
                                    settlementHeld: true, // Will be set to false when owner releases
                                    transferStatus: 'on_hold', // on_hold, processing, processed, failed
                                    createdAt: new Date().toISOString(),
                                    webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                }, { merge: true });
                            }
                        });
                    } catch (e) { console.error("Payment Sync Err:", e); }
                }
            } else if (event === 'payment.failed') {
                const { transactionId } = entity.notes || {};
                if (transactionId) {
                    await db.collection('transactions').doc(transactionId).update({
                        status: 'FAILED',
                        failureReason: entity.error_description || 'Unknown',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }

        // Handle Transfer Events (Razorpay Route)
        else if (event.startsWith('transfer.')) {
            const transfer = payload.transfer.entity;
            const { tournamentId, playerId } = transfer.notes || {};

            if (event === 'transfer.processed') {
                // Transfer successfully settled to organizer
                if (tournamentId) {
                    // Find and update transaction
                    const transactionsSnap = await db.collection('transactions')
                        .where('transferId', '==', transfer.id)
                        .limit(1)
                        .get();

                    if (!transactionsSnap.empty) {
                        await transactionsSnap.docs[0].ref.update({
                            transferStatus: 'processed',
                            settlementCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    // Check if all transfers for tournament are processed
                    const allTransfersSnap = await db.collection('transactions')
                        .where('tournamentId', '==', tournamentId)
                        .where('type', '==', 'collection')
                        .get();

                    const allProcessed = allTransfersSnap.docs.every(doc =>
                        doc.data().transferStatus === 'processed'
                    );

                    if (allProcessed) {
                        await db.collection('tournaments').doc(tournamentId).update({
                            settlementStatus: 'completed',
                            settlementCompletedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
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
                            failureReason: transfer.failure_reason || 'Transfer failed',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    await db.collection('tournaments').doc(tournamentId).update({
                        settlementStatus: 'failed',
                        lastTransferError: transfer.failure_reason || 'Transfer failed'
                    });

                    console.error(`❌ Transfer failed`);
                }
            }
        }

        res.status(200).send('ok');
    }
);

/**
 * Cloud Function to create organizer with Razorpay Route Linked Account
 */
exports.createOrganizer = onCall(
    {
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
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

            // Create Razorpay Linked Account (Route)
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
                linkedAccountStatus: linkedAccount.status || 'created', // active, pending, suspended, created
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                uid: userRecord.uid,
                linkedAccountId: linkedAccount.id,
                kycRequired: linkedAccount.status !== 'active',
                message: 'Organizer created. KYC verification required via email.'
            };
        } catch (error) {
            console.error('❌ Create organizer error:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Create Razorpay Order with Route Transfers
 * Called before opening Razorpay checkout
 */
exports.createPaymentWithRoute = onCall(
    {
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        const { tournamentId, playerId, amount, playerName, transactionId } = request.data;

        if (!playerId || playerId === 'null' || playerId === 'undefined' || playerId === 'null' || playerId === 'undefined' || (typeof playerId === 'object' && !playerId)) {
            console.error("❌ CRITICAL: playerId is missing or invalid on server");
            throw new HttpsError('invalid-argument', 'Missing playerId');
        }

        if (!tournamentId || tournamentId === 'null' || tournamentId === 'undefined') {
            console.error("❌ Missing tournamentId");
            throw new HttpsError('invalid-argument', 'Missing tournamentId');
        }
        if (!amount || isNaN(parseFloat(amount))) {
            console.error("❌ Missing or invalid amount");
            throw new HttpsError('invalid-argument', 'Missing or invalid amount');
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
            const linkedAccountId = organizer.linkedAccountId || null;

            if (!linkedAccountId) {
                console.error(`❌ Payment Blocked: Organizer ${tournament.organizerId} has no linked account.`);
                throw new HttpsError('failed-precondition',
                    `This tournament is not ready to accept payments. The organizer must link their Razorpay Route account (acc_...) in the settlement configuration to enable automated 95/5 splitting. Please contact support or the tournament owner.`);
            }

            // Calculate split amounts (in paise)
            // SECURITY: Use entryFee from database, ignore client-provided amount
            const entryFee = Number(tournament.entryFee);

            if (isNaN(entryFee)) {
                throw new HttpsError('failed-precondition', 'Tournament entry fee is not set');
            }

            if (entryFee === 0) {
                throw new HttpsError('failed-precondition', 'Cannot create payment order for a free tournament');
            }

            // Verify client amount matches (optional but good for debugging)
            if (Math.abs(Number(amount) - entryFee) > 1) {
                console.warn(`⚠️ Client amount differs from DB entry fee`);
            }

            const totalAmount = Math.round(entryFee * 100);
            const organizerShare = Math.round(totalAmount * 0.95);
            const platformCommission = totalAmount - organizerShare;

            // Create Razorpay instance
            const rzp = getRazorpayInstance({
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
            });

            // Prepare order options
            const orderOptions = {
                amount: totalAmount,
                currency: 'INR',
                receipt: `rcpt_${Date.now()}`,
                notes: {
                    tournamentId,
                    playerId,
                    playerName: playerName || 'Player',
                    tournamentName: tournament.name,
                    transactionId: transactionId || null
                }
            };

            // Add Route transfers ONLY if linked account exists
            if (linkedAccountId) {
                orderOptions.transfers = [
                    {
                        account: linkedAccountId,
                        amount: organizerShare,
                        currency: 'INR',
                        notes: {
                            type: 'organizer_share',
                            tournamentId,
                            playerId,
                            playerName: playerName || 'Player',
                            tournamentName: tournament.name
                        },
                        linked_account_notes: [
                            'tournamentName',
                            'playerName'
                        ],
                        on_hold: true, // Hold settlement until owner releases
                        on_hold_until: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
                    }
                ];
            }

            const order = await rzp.orders.create(orderOptions);

            return {
                success: true,
                orderId: order.id,
                amount: totalAmount,
                organizerShare: organizerShare / 100,
                platformCommission: platformCommission / 100,
                kycWarning: organizer.linkedAccountStatus !== 'active' ?
                    'Organizer KYC pending. Transfer will be processed after KYC completion.' : null
            };

        } catch (error) {
            console.error('❌ Order creation error details:', error);
            // Razorpay errors often contain a 'description' or 'error' object
            const errorMsg = error.description || (error.error && error.error.description) || error.message || 'Unknown error';
            throw new HttpsError('internal', `Razorpay Error: ${errorMsg}`);
        }
    }
);

/**
 * Release Settlement to Organizer
 * Called by owner when marking tournament complete
 */
exports.releaseSettlement = onCall(
    {
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
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

            if (tournament.settlementStatus === 'released' || tournament.settlementStatus === 'completed') {
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

            const cleanId = process.env.RAZORPAY_KEY_ID?.trim();
            const cleanSecret = process.env.RAZORPAY_KEY_SECRET?.trim();
            const auth = Buffer.from(`${cleanId}:${cleanSecret}`).toString('base64');
            const releasedTransfers = [];
            const failedTransfers = [];
            let totalReleasedAmount = 0;

            // Get transfer IDs from Razorpay orders
            const rzp = getRazorpayInstance({
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
            });

            // Release each transfer
            for (const txnDoc of transactionsSnap.docs) {
                const txn = txnDoc.data();

                try {
                    // Get order details to find transfer ID
                    if (txn.razorpayOrderId) {
                        const order = await rzp.orders.fetch(txn.razorpayOrderId);

                        let transfersToProcess = order.transfers || [];

                        // Fallback: Fetch transfers explicitly if not in order object
                        if (transfersToProcess.length === 0) {
                            const tResult = await rzp.transfers.all({ order_id: txn.razorpayOrderId });
                            transfersToProcess = tResult.items || [];
                        }

                        if (transfersToProcess.length > 0) {
                            const transferId = transfersToProcess[0].id;

                            // Release the transfer
                            const response = await fetch(`https://api.razorpay.com/v1/transfers/${transferId}`, {
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

                                const releaseAmt = txn.organizerShare || (txn.amount * 0.95) || 0;
                                totalReleasedAmount += releaseAmt;

                                // Update transaction
                                await txnDoc.ref.update({
                                    transferId: transfer.id,
                                    settlementHeld: false,
                                    transferStatus: 'processing',
                                    releasedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    releasedBy: request.auth.uid,
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                });
                            } else {
                                const error = await response.json().catch(() => ({}));
                                console.error(`❌ Failed to release transfer ${transferId}:`, error);
                                failedTransfers.push({ transferId, error: error.error?.description || 'Unknown error' });
                            }
                        }
                    }
                } catch (err) {
                    console.error(`❌ Error processing transaction ${txnDoc.id}:`, err.message);
                    failedTransfers.push({ transactionId: txnDoc.id, error: err.message });
                }
            }

            // Update tournament
            const finalStatus = (failedTransfers.length === 0 && releasedTransfers.length > 0) ? 'released' :
                (releasedTransfers.length > 0 ? 'partial_release' : 'failed');

            await tournamentRef.update({
                settlementStatus: finalStatus,
                settlementReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
                settlementReleasedBy: request.auth.uid,
                totalHeldAmount: admin.firestore.FieldValue.increment(-totalReleasedAmount),
                totalReleasedAmount: admin.firestore.FieldValue.increment(totalReleasedAmount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (failedTransfers.length > 0) {
                console.error(`❌ Failed to release ${failedTransfers.length} transfers`);
            }

            return {
                success: true,
                releasedCount: releasedTransfers.length,
                failedCount: failedTransfers.length,
                transferIds: releasedTransfers,
                errors: failedTransfers.length > 0 ? failedTransfers : undefined,
                message: `Released ${releasedTransfers.length} settlements. ${failedTransfers.length > 0 ? `${failedTransfers.length} failed.` : ''}`
            };

        } catch (error) {
            console.error('❌ Settlement release error:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Cloud Function to create Player Payment Transaction (STARTED)
 */
exports.createPlayerPaymentTransaction = onCall(
    {
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        const { tournamentId, amount, playerId, playerName } = request.data;

        if (!playerId || playerId === 'null' || playerId === 'undefined') {
            console.error("❌ Missing playerId in createPlayerPaymentTransaction");
            throw new HttpsError('invalid-argument', 'Missing playerId');
        }

        if (!tournamentId || tournamentId === 'null' || tournamentId === 'undefined') {
            console.error("❌ Missing tournamentId in createPlayerPaymentTransaction");
            throw new HttpsError('invalid-argument', 'Missing tournamentId');
        }

        const transactionRef = db.collection('transactions').doc();
        await transactionRef.set({
            id: transactionRef.id,
            tournamentId,
            playerId,
            playerName,
            amount: parseFloat(amount),
            status: 'STARTED',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, transactionId: transactionRef.id };
    }
);

/**
 * Start a Payout Transaction record (Legacy/Manual)
 */
exports.createPayoutTransaction = onCall(
    {
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        if (!request.auth || (request.auth.token.role !== 'owner' && !request.auth.token.admin)) {
            throw new HttpsError('permission-denied', 'Unauthorized');
        }

        const { tournamentId, organizerId, amount } = request.data;

        try {
            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();
            if (!tournamentDoc.exists) throw new HttpsError('not-found', 'Tournament not found');

            const tournamentData = tournamentDoc.data();
            const transactionRef = db.collection('transactions').doc();

            await transactionRef.set({
                id: transactionRef.id,
                type: 'payout',
                ownerId: 'force_owner',
                tournamentId,
                tournamentName: tournamentData.name || 'Tournament',
                receiver: { id: organizerId || tournamentData.organizerId, name: 'Organizer' },
                amount: parseFloat(amount),
                status: 'STARTED',
                createdAt: new Date().toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, transactionId: transactionRef.id, amount };
        } catch (error) {
            console.error('❌ Error creating payout transaction:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Handle Manual Payout (Simplified - No RazorpayX)
 */
exports.processPayout = onCall(
    {
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        if (!request.auth || (request.auth.token.role !== 'owner' && !request.auth.token.admin)) {
            throw new HttpsError('permission-denied', 'Unauthorized');
        }

        const { transactionId } = request.data;
        const transactionRef = db.collection('transactions').doc(transactionId);
        const tDoc = await transactionRef.get();

        if (!tDoc.exists) throw new HttpsError('not-found', 'Transaction not found');

        try {
            // For Manual Mode: We just mark it as success immediately 
            // as the owner is confirming they did the transfer manually.
            const tData = tDoc.data();

            await transactionRef.update({
                status: 'SUCCESS',
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                method: 'manual_transfer'
            });

            if (tData.tournamentId) {
                await db.collection('tournaments').doc(tData.tournamentId).update({
                    settlementStatus: 'completed',
                    settlementAmount: tData.amount,
                    settlementDate: new Date().toISOString(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            return { success: true, message: 'Manual settlement recorded' };
        } catch (error) {
            console.error('❌ Payout process error:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Sync status for manual payouts
 */
exports.syncPayoutStatus = onCall(
    {
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        const { transactionId } = request.data;
        const transactionRef = db.collection('transactions').doc(transactionId);
        const tDoc = await transactionRef.get();
        if (!tDoc.exists) throw new HttpsError('not-found', 'Transaction not found');

        return { success: true, status: tDoc.data().status };
    }
);

/**
 * Manually Link Razorpay Route Account to Organizer
 */
exports.linkRouteAccount = onCall(
    {
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        if (!request.auth || (request.auth.token.role !== 'owner' && !request.auth.token.admin)) {
            console.error('❌ Permission Denied: User is not owner/admin');
            throw new HttpsError('permission-denied', 'Unauthorized');
        }

        const { organizerId, linkedAccountId } = request.data;
        if (!organizerId || !linkedAccountId) {
            throw new HttpsError('invalid-argument', 'Missing organizerId or linkedAccountId');
        }

        if (!linkedAccountId.startsWith('acc_')) {
            throw new HttpsError('invalid-argument', 'Invalid Account ID format. Must start with acc_');
        }

        try {
            const userRef = db.collection('users').doc(organizerId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.error(`❌ User ${organizerId} not found`);
                throw new HttpsError('not-found', 'Organizer user document not found');
            }

            await userRef.update({
                linkedAccountId: linkedAccountId.trim(),
                linkedAccountStatus: 'active',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                message: 'Account linked successfully',
                linkedAccountId: linkedAccountId.trim()
            };
        } catch (error) {
            console.error('❌ Link account internal error:', error);
            // Don't re-throw HttpsError, but wrap others
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', error.message || 'Database update failed');
        }
    }
);

/**
 * Verify Payment - Server-side signature verification for every payment
 * Called by the client after Razorpay checkout completes
 */
exports.verifyPayment = onCall(
    {
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            tournamentId,
            playerId,
            transactionId
        } = request.data;

        let playerDoc = null;

        // SECURITY: Comprehensive Input Validation
        if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string') {
            throw new HttpsError('invalid-argument', 'Invalid payment ID format');
        }

        if (razorpay_payment_id.length > 50 || !/^pay_[a-zA-Z0-9]+$/.test(razorpay_payment_id)) {
            throw new HttpsError('invalid-argument', 'Invalid payment ID pattern');
        }

        // SECURITY: Check for duplicate verification (prevent replay attacks)
        const existingVerification = await db.collection('payment_verification_logs')
            .where('razorpay_payment_id', '==', razorpay_payment_id)
            .where('status', '==', 'VERIFIED')
            .limit(1)
            .get();

        if (!existingVerification.empty) {
            console.warn(`⚠️ Duplicate verification attempt for ${razorpay_payment_id}`);
            throw new HttpsError('already-exists', 'Payment already verified');
        }

        const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
        if (!rzpKeySecret) {
            console.error('❌ RAZORPAY_KEY_SECRET not configured');
            throw new HttpsError('internal', 'Payment verification not configured');
        }

        try {
            let isSignatureValid = false;

            // Step 1: Verify Signature (if order_id and signature are provided)
            if (razorpay_order_id && razorpay_signature) {
                const payload = razorpay_order_id + "|" + razorpay_payment_id;
                const expectedSignature = crypto
                    .createHmac('sha256', rzpKeySecret)
                    .update(payload)
                    .digest('hex');

                isSignatureValid = expectedSignature === razorpay_signature;

                if (!isSignatureValid) {
                    // Log the failed verification attempt
                    await db.collection('payment_verification_logs').add({
                        razorpay_payment_id,
                        razorpay_order_id,
                        tournamentId,
                        playerId,
                        status: 'SIGNATURE_MISMATCH',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        ip: request.rawRequest?.ip || 'unknown',
                        userId: request.auth?.uid || 'anonymous'
                    });
                    throw new HttpsError('permission-denied', 'Payment signature verification failed');
                }
            }

            // Step 2: Fetch payment details from Razorpay API to double-verify
            const rzp = getRazorpayInstance({
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
            });

            const payment = await rzp.payments.fetch(razorpay_payment_id);

            // Verify payment status is captured
            if (payment.status !== 'captured' && payment.status !== 'authorized') {
                throw new HttpsError('failed-precondition', `Payment not captured. Status: ${payment.status}`);
            }

            // SECURITY: Verify payment amount matches player's expected amount
            const finalTournamentId = tournamentId || payment.notes?.tournamentId;
            let finalPlayerId = playerId || payment.notes?.playerId;

            if (finalTournamentId && finalPlayerId) {
                const playerRef = db.collection('tournaments').doc(finalTournamentId)
                    .collection('players').doc(finalPlayerId);
                playerDoc = await playerRef.get();

                if (playerDoc.exists) {
                    const playerData = playerDoc.data();
                    const expectedAmount = playerData.paidAmount || 0;
                    const paidAmount = payment.amount / 100;

                    if (expectedAmount > 0 && Math.abs(paidAmount - expectedAmount) > 0.01) {
                        console.error(`❌ Amount mismatch`);
                        await db.collection('payment_verification_logs').add({
                            razorpay_payment_id,
                            status: 'AMOUNT_MISMATCH',
                            expectedAmount,
                            paidAmount,
                            tournamentId: finalTournamentId,
                            playerId: finalPlayerId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                        });
                        throw new HttpsError('invalid-argument',
                            `Amount mismatch: expected ₹${expectedAmount}, received ₹${paidAmount}`);
                    }
                }
            }

            // Step 3: Auto-capture if only authorized
            if (payment.status === 'authorized') {
                try {
                    await rzp.payments.capture(razorpay_payment_id, payment.amount, payment.currency);
                } catch (captureErr) {
                    if (!captureErr.message?.includes('already been captured')) {
                        console.error(`❌ Capture failed:`, captureErr.message);
                        throw new HttpsError('internal', 'Failed to capture payment');
                    }
                }
            }

            // Step 4: Extract tournament and player info from payment notes or parameters
            // finalPlayerId already resolved above in Security step

            if (!finalTournamentId || !finalPlayerId) {
                console.warn('⚠️ Missing tournament/player ID in verification');
            }

            // Step 5: Get transfer ID from order
            let transferId = null;
            if (razorpay_order_id) {
                try {
                    const order = await rzp.orders.fetch(razorpay_order_id);
                    if (order.transfers && order.transfers.length > 0) {
                        transferId = order.transfers[0].id;
                    } else {
                        // Fallback: Fetch transfers explicitly for this order
                        const transfersResponse = await rzp.transfers.all({ order_id: razorpay_order_id });
                        if (transfersResponse.items && transfersResponse.items.length > 0) {
                            transferId = transfersResponse.items[0].id;
                        } else {
                            console.warn(`⚠️ No transfers found`);
                        }
                    }
                } catch (err) {
                    console.warn('⚠️ Could not fetch order transfers:', err.message);
                }
            }

            // Step 6: Update Firestore records
            const batch = db.batch();

            // Update player document
            if (finalTournamentId && finalPlayerId) {
                const playerRef = db.collection('tournaments').doc(finalTournamentId)
                    .collection('players').doc(finalPlayerId);

                // Ensure playerDoc is available (fallback if skipped in security step)
                if (!playerDoc) {
                    playerDoc = await playerRef.get();
                }

                if (playerDoc && playerDoc.exists && !playerDoc.data().paid) {
                    batch.update(playerRef, {
                        paid: true,
                        paymentId: razorpay_payment_id,
                        orderId: razorpay_order_id || null,
                        method: payment.method || 'unknown',
                        paidAmount: payment.amount / 100,
                        paidAt: admin.firestore.FieldValue.serverTimestamp(),
                        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                        verificationMethod: 'client_callback'
                    });

                    // Update tournament totals
                    const tournamentRef = db.collection('tournaments').doc(finalTournamentId);
                    const totalAmount = payment.amount / 100;
                    const heldAmount = totalAmount * 0.95;

                    // IF Duo and paidForPartner, increment count by 2
                    const playerData = playerDoc.data();
                    const incrementVal = (playerData.registrationMode === 'Duo' && playerData.paidForPartner) ? 2 : 1;

                    batch.update(tournamentRef, {
                        totalCollections: admin.firestore.FieldValue.increment(totalAmount),
                        paidPlayerCount: admin.firestore.FieldValue.increment(incrementVal),
                        totalHeldAmount: admin.firestore.FieldValue.increment(heldAmount),
                        settlementStatus: 'held'
                    });
                }
            }

            // Update/Create transaction record
            const totalAmount = payment.amount / 100;
            const organizerShare = totalAmount * 0.95;
            const platformCommission = totalAmount * 0.05;

            const txnId = transactionId || payment.notes?.transactionId || razorpay_payment_id;
            const txnRef = db.collection('transactions').doc(txnId);
            batch.set(txnRef, {
                id: txnId,
                type: 'collection',
                ownerId: 'force_owner',
                tournamentId: finalTournamentId,
                playerId: finalPlayerId,
                amount: totalAmount,
                organizerShare: parseFloat(organizerShare.toFixed(2)),
                platformCommission: parseFloat(platformCommission.toFixed(2)),
                status: 'SUCCESS',
                method: payment.method || 'unknown',
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id || null,
                transferId: transferId,
                settlementHeld: true,
                transferStatus: 'on_hold',
                verified: true,
                verificationMethod: 'client_callback',
                verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch.commit();

            // Log successful verification
            await db.collection('payment_verification_logs').add({
                razorpay_payment_id,
                razorpay_order_id,
                tournamentId: finalTournamentId,
                playerId: finalPlayerId,
                transactionId: txnId,
                transferId: transferId,
                amount: totalAmount,
                status: 'VERIFIED',
                method: payment.method,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                verified: true,
                paymentId: razorpay_payment_id,
                amount: totalAmount,
                status: payment.status,
                method: payment.method,
                transferId: transferId
            };

        } catch (error) {
            console.error('❌ Payment verification error:', error);

            // Don't expose internal errors
            if (error instanceof HttpsError) {
                throw error;
            }
            throw new HttpsError('internal', 'Payment verification failed. Contact support.');
        }
    }
);

/**
 * Process Player Refund
 * Refunds 95% of the payment to the player (5% processing fee retained)
 * Can only be initiated by tournament organizers or owners
 */
exports.processPlayerRefund = onCall(
    {
        secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        const {
            tournamentId,
            playerId,
            reason,
            refundPercentage = 95 // Default 95% refund
        } = request.data;

        // Validate inputs
        if (!tournamentId || !playerId) {
            throw new HttpsError('invalid-argument', 'Tournament ID and Player ID are required');
        }

        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        try {
            // Get tournament details
            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();

            if (!tournamentDoc.exists) {
                throw new HttpsError('not-found', 'Tournament not found');
            }

            const tournament = tournamentDoc.data();

            // Check if user is owner or organizer of this tournament
            const userDoc = await db.collection('users').doc(request.auth.uid).get();
            const userRole = userDoc.data()?.role;
            const isOwner = userRole === 'owner' || userRole === 'admin';
            const isOrganizer = userRole === 'organizer' && tournament.organizerId === request.auth.uid;

            if (!isOwner && !isOrganizer) {
                throw new HttpsError('permission-denied', 'Only tournament organizers or owners can process refunds');
            }

            // Get player registration details
            const playerRef = tournamentRef.collection('players').doc(playerId);
            const playerDoc = await playerRef.get();

            if (!playerDoc.exists) {
                throw new HttpsError('not-found', 'Player registration not found');
            }

            const player = playerDoc.data();

            // Check if player has paid
            if (!player.paid) {
                throw new HttpsError('failed-precondition', 'Player has not made any payment');
            }

            // Check if already refunded
            if (player.refunded) {
                throw new HttpsError('already-exists', 'Refund has already been processed for this player');
            }

            const paidAmount = player.paidAmount || player.amount || 0;
            const razorpayPaymentId = player.paymentId;

            if (!razorpayPaymentId) {
                throw new HttpsError('failed-precondition', 'Payment ID not found. Cannot process refund.');
            }

            // Calculate refund amount (95% of paid amount)
            const refundAmount = Math.floor(paidAmount * (refundPercentage / 100) * 100); // Convert to paise
            const processingFee = Math.floor(paidAmount * ((100 - refundPercentage) / 100) * 100);

            // Initialize Razorpay
            const rzp = getRazorpayInstance({
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
            });

            // Process refund via Razorpay API
            const refund = await rzp.payments.refund(razorpayPaymentId, {
                amount: refundAmount,
                speed: 'normal', // or 'optimum'
                notes: {
                    reason: reason || 'Player cancellation',
                    tournamentId: tournamentId,
                    playerId: playerId,
                    refundPercentage: refundPercentage,
                    processingFee: processingFee / 100
                }
            });

            // Update player document
            await playerRef.update({
                refunded: true,
                refundAmount: refundAmount / 100,
                refundId: refund.id,
                refundReason: reason || 'Player cancellation',
                refundProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                refundProcessedBy: request.auth.uid,
                processingFee: processingFee / 100,
                refundPercentage: refundPercentage,
                paid: false, // Mark as unpaid after refund
                status: 'refunded'
            });

            // Update tournament totals
            await tournamentRef.update({
                totalCollections: admin.firestore.FieldValue.increment(-(paidAmount)),
                paidPlayerCount: admin.firestore.FieldValue.increment(-1),
                refundedCount: admin.firestore.FieldValue.increment(1),
                totalRefunded: admin.firestore.FieldValue.increment(refundAmount / 100)
            });

            // Create refund transaction record
            await db.collection('transactions').add({
                type: 'refund',
                tournamentId: tournamentId,
                tournamentName: tournament.name,
                playerId: playerId,
                playerName: player.playerName || player.personal?.name,
                playerEmail: player.email,
                originalAmount: paidAmount,
                refundAmount: refundAmount / 100,
                processingFee: processingFee / 100,
                refundPercentage: refundPercentage,
                razorpayPaymentId: razorpayPaymentId,
                razorpayRefundId: refund.id,
                reason: reason || 'Player cancellation',
                status: 'SUCCESS',
                processedBy: request.auth.uid,
                createdAt: new Date().toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Send refund confirmation email
            await db.collection('mail').add({
                to: player.email,
                template: {
                    name: 'refund-confirmation',
                    data: {
                        playerName: player.playerName || player.personal?.name,
                        tournamentName: tournament.name,
                        originalAmount: paidAmount,
                        refundAmount: refundAmount / 100,
                        processingFee: processingFee / 100,
                        refundPercentage: refundPercentage,
                        refundId: refund.id,
                        reason: reason || 'Player cancellation'
                    }
                }
            });

            return {
                success: true,
                refundId: refund.id,
                refundAmount: refundAmount / 100,
                processingFee: processingFee / 100,
                refundPercentage: refundPercentage,
                message: `Refund of ₹${refundAmount / 100} processed successfully. ₹${processingFee / 100} processing fee deducted.`
            };

        } catch (error) {
            console.error('❌ Refund processing error:', error);

            if (error instanceof HttpsError) {
                throw error;
            }

            // Log failed refund attempt
            await db.collection('refund_logs').add({
                tournamentId,
                playerId,
                error: error.message,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                requestedBy: request.auth.uid
            });

            throw new HttpsError('internal', `Refund failed: ${error.message}`);
        }
    }
);

/**
 * Fetch limited public info about a partner for Duo registration
 * Used by the joining partner to see who they are joining
 */
exports.getPartnerPublicInfo = onCall(
    {
        cors: ["http://localhost:8081", "https://force-player-register-ap-ade3a.web.app", "https://force-player-register-ap-ade3a.firebaseapp.com"]
    },
    async (request) => {
        const { tournamentId, playerId } = request.data;
        if (!tournamentId || !playerId) {
            throw new HttpsError('invalid-argument', 'Missing tournamentId or playerId');
        }

        try {
            const playerDoc = await db.collection('tournaments').doc(tournamentId)
                .collection('players').doc(playerId).get();

            if (!playerDoc.exists) {
                throw new HttpsError('not-found', 'Partner registration not found');
            }

            const data = playerDoc.data();

            // Return only non-sensitive fields
            return {
                success: true,
                playerName: data.playerName,
                teamName: data.teamName,
                paidForPartner: data.paidForPartner || false,
                entryType: data.entryType
            };
        } catch (error) {
            console.error('Error fetching partner info:', error);
            throw new HttpsError('internal', 'Failed to fetch partner info');
        }
    }
);
