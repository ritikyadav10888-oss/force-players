const functions = require('firebase-functions');
const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();

// 💡 Secret from your Razorpay Dashboard > Settings > Webhooks
// Set it via CLI: firebase functions:secrets:set RAZORPAY_SECRET


exports.razorpayWebhook = functions.https.onRequest(
    { secrets: ["RAZORPAY_SECRET"] },
    async (req, res) => {
        const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_SECRET;


        // Only allow POST requests

        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const signature = req.headers['x-razorpay-signature'];

        // 1. Verify Signature (Security Check)
        // CRITICAL: Use req.rawBody instead of JSON.stringify(req.body) to avoid payload mismatch
        const body = req.rawBody;

        if (!body) {
            console.error('❌ Missing request body');
            return res.status(400).send('Missing body');
        }

        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('❌ Invalid Razorpay Signature');
            return res.status(400).send('Invalid Signature');
        }

        const event = req.body.event;
        const payload = req.body.payload.payment.entity;

        console.log(`🔔 Received event: ${event}`);

        // 2. Handle successful payment
        if (event === 'payment.captured' || event === 'order.paid' || event === 'payment.authorized') {
            // We pass these in 'notes' from the frontend
            const { tournamentId, playerId } = payload.notes || {};

            if (tournamentId && playerId) {
                try {
                    // 3. Update Firestore securely
                    const tournamentRef = db.collection('tournaments').doc(tournamentId);
                    const playerRef = tournamentRef.collection('players').doc(playerId);

                    await db.runTransaction(async (transaction) => {
                        const playerDoc = await transaction.get(playerRef);
                        if (!playerDoc.exists) return;

                        if (!playerDoc.data().paid) {
                            transaction.update(playerRef, {
                                paid: true,
                                paymentId: payload.id,
                                orderId: payload.order_id,
                                method: payload.method,
                                paidAmount: payload.amount / 100, // Save precise amount
                                paidAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            // Increment total collections
                            transaction.update(tournamentRef, {
                                totalCollections: admin.firestore.FieldValue.increment(payload.amount / 100)
                            });
                        }
                    });

                    console.log(`✅ Payment verified & updated for player ${playerId} in tournament ${tournamentId}`);

                    // 4. Send Payment Confirmation Email via Firebase Extension
                    try {
                        const playerDoc = await playerRef.get();
                        const tournamentDoc = await tournamentRef.get();

                        if (playerDoc.exists && tournamentDoc.exists) {
                            const playerData = playerDoc.data();
                            const tournamentData = tournamentDoc.data();

                            // Prepare email data for Firebase Extension
                            const emailData = {
                                to: playerData.email,
                                message: {
                                    subject: `Payment Confirmation - ${tournamentData.name}`,
                                    html: `
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <meta charset="UTF-8">
                                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        </head>
                                        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
                                                <tr>
                                                    <td align="center">
                                                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                                            <!-- Header -->
                                                            <tr>
                                                                <td style="background: linear-gradient(135deg, #00C853 0%, #00E676 100%); padding: 40px 30px; text-align: center;">
                                                                    <div style="width: 80px; height: 80px; background-color: white; border-radius: 50%; margin: 0 auto 20px; display: inline-flex; align-items: center; justify-content: center;">
                                                                        <span style="font-size: 40px;">💳</span>
                                                                    </div>
                                                                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Payment Received!</h1>
                                                                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Thank you for your payment</p>
                                                                </td>
                                                            </tr>
                                                            <!-- Content -->
                                                            <tr>
                                                                <td style="padding: 40px 30px;">
                                                                    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                                                        Hello <strong>${playerData.name || 'Player'}</strong>,
                                                                    </p>
                                                                    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                                                        We've successfully received your payment for <strong>${tournamentData.name}</strong>. Your spot is now confirmed!
                                                                    </p>
                                                                    <!-- Payment Receipt Box -->
                                                                    <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%); border-radius: 12px; padding: 25px; margin: 30px 0; border: 2px solid #00C853;">
                                                                        <h3 style="color: #1a237e; margin: 0 0 20px 0; font-size: 18px; text-align: center;">🧾 Payment Receipt</h3>
                                                                        <table width="100%" cellpadding="10" cellspacing="0">
                                                                            <tr>
                                                                                <td style="color: #666; font-size: 14px; font-weight: 600; width: 50%;">Transaction ID:</td>
                                                                                <td style="color: #333; font-size: 14px; font-family: 'Courier New', monospace; text-align: right;">${payload.id}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="color: #666; font-size: 14px; font-weight: 600;">Payment Method:</td>
                                                                                <td style="color: #333; font-size: 14px; text-align: right;">${payload.method.toUpperCase()}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="color: #666; font-size: 14px; font-weight: 600;">Date & Time:</td>
                                                                                <td style="color: #333; font-size: 14px; text-align: right;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                                                                            </tr>
                                                                            <tr style="border-top: 2px solid #e0e0e0;">
                                                                                <td style="color: #1a237e; font-size: 16px; font-weight: 700; padding-top: 15px;">Amount Paid:</td>
                                                                                <td style="color: #00C853; font-size: 18px; font-weight: 700; text-align: right; padding-top: 15px;">₹${(payload.amount / 100).toFixed(2)}</td>
                                                                            </tr>
                                                                        </table>
                                                                    </div>
                                                                    <!-- Success Message -->
                                                                    <div style="background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                                                        <p style="color: #2e7d32; font-size: 14px; margin: 0; line-height: 1.6;">
                                                                            <strong>✅ Status:</strong> Payment Confirmed<br>
                                                                            Your registration is now complete and your spot is secured!
                                                                        </p>
                                                                    </div>
                                                                    <!-- Tournament Info -->
                                                                    <h3 style="color: #1a237e; margin: 30px 0 15px 0; font-size: 18px;">🎮 Tournament Information</h3>
                                                                    <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #f9f9f9; border-radius: 8px;">
                                                                        <tr>
                                                                            <td style="color: #666; font-size: 14px; padding: 10px;">📋 Tournament:</td>
                                                                            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournamentData.name}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="color: #666; font-size: 14px; padding: 10px;">🎮 Game:</td>
                                                                            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournamentData.gameName || 'TBA'}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="color: #666; font-size: 14px; padding: 10px;">📅 Date:</td>
                                                                            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournamentData.startDate || 'TBA'}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="color: #666; font-size: 14px; padding: 10px;">📍 Venue:</td>
                                                                            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournamentData.venue || 'TBA'}</td>
                                                                        </tr>
                                                                    </table>
                                                                    <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center; font-style: italic;">
                                                                        Keep this email for your records. You may need to show this receipt at the tournament venue.
                                                                    </p>
                                                                    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 10px 0;">
                                                                        See you at the tournament!
                                                                    </p>
                                                                    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                                                                        <strong>Force Player Register Team</strong>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <!-- Footer -->
                                                            <tr>
                                                                <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                                                                    <p style="color: #666; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Force Player Register</p>
                                                                    <p style="color: #999; font-size: 12px; margin: 0 0 15px 0;">Tournament Management System</p>
                                                                    <p style="color: #999; font-size: 11px; margin: 0; line-height: 1.5;">© 2026 Force Player Register. All rights reserved.</p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </body>
                                        </html>
                                    `
                                }
                            };

                            // Write to mail collection to trigger email
                            await db.collection('mail').add(emailData);
                            console.log(`✅ Payment confirmation email queued for ${playerData.email}`);
                        }
                    } catch (emailError) {
                        console.error('❌ Failed to queue payment confirmation email:', emailError);
                    }

                } catch (error) {
                    console.error('❌ Firestore Update Error:', error);
                }
            } else {
                console.warn('⚠️ Missing tournamentId or playerId in payment notes');
            }
        }

        res.status(200).send({ status: 'ok' });
    });

// Securely create an organizer account (Admin SDK)
// Using Gen 2 onCall with Secrets
exports.createOrganizer = onCall(async (request) => {
    // 1. Verify Authentication & Role
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const callerUid = request.auth.uid;

    const callerDoc = await db.collection('users').doc(callerUid).get();
    const isLocalOwner = callerDoc.exists && callerDoc.data().role === 'owner';
    const hasOwnerClaim = request.auth.token.role === 'owner';

    if (!isLocalOwner && !hasOwnerClaim) {
        throw new HttpsError('permission-denied', 'Only owners can create organizers.');
    }

    const { email, password, name, phone, address, aadharNumber, panNumber, profilePic, aadharPhoto, panPhoto, bankDetails, accessExpiryDate } = request.data;

    console.log("Creating organizer with data:", { email, name, phone, address }); // Debug Log

    // 2. Validate Data
    const requiredFields = [
        { key: 'email', val: email, label: 'Email' },
        { key: 'password', val: password, label: 'Password' },
        { key: 'name', val: name, label: 'Name' },
        { key: 'phone', val: phone, label: 'Phone' },
        { key: 'address', val: address, label: 'Address' },
        { key: 'aadharNumber', val: aadharNumber, label: 'Aadhar Number' },
        { key: 'panNumber', val: panNumber, label: 'PAN Number' },
        { key: 'bankDetails', val: bankDetails, label: 'Bank Details' }
    ];

    const missing = requiredFields.filter(f => !f.val);
    if (missing.length > 0) {
        throw new HttpsError('invalid-argument', `Missing required fields: ${missing.map(m => m.label).join(', ')}`);
    }

    if (!bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.bankName) {
        throw new HttpsError('invalid-argument', 'Incomplete bank details.');
    }

    try {
        // 3. Create User in Authentication
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: name,
                disabled: false,
            });
        } catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                throw new HttpsError('already-exists', 'This email is already registered as an organizer or player.');
            }
            throw authError;
        }

        // 4. Create User Document in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            name,
            email,
            phone: phone || null,  // Prevent undefined
            role: 'organizer',
            address: address || null, // Prevent undefined
            aadharNumber,
            panNumber: panNumber || null,
            profilePic: profilePic || null,
            aadharPhoto: aadharPhoto || null,
            panPhoto: panPhoto || null,
            bankDetails: bankDetails || {},
            accessExpiryDate: accessExpiryDate,
            createdBy: callerUid,
            createdAt: new Date().toISOString(),
            isVerified: true
        });

        // 5. Set Custom Claims (Optional but recommended for faster rule checks)
        await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'organizer' });

        // 6. Send Email Notification via Extension
        await db.collection('mail').add({
            to: email,
            message: {
                subject: 'Welcome to Force Player Register Family',
            },
            template: {
                name: 'organizer-welcome',
                data: {
                    ORGANIZER_NAME: name,
                    ORGANIZER_EMAIL: email,
                    ORGANIZER_PHONE: phone || null,
                    ORGANIZER_ADDRESS: address || null,
                    ORGANIZER_PASSWORD: password,
                    APP_NAME: 'Force Player Register',
                    LINK: 'https://force-player-register-ap-ade3a.web.app/login'
                }
            }
        });

        return { success: true, uid: userRecord.uid };

    } catch (error) {
        console.error("Error creating organizer:", error);
        throw new HttpsError('internal', error.message);
    }
});

// Temporary function to upload templates
exports.setupTemplates = functions.https.onRequest(async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, 'email-templates');
        if (!fs.existsSync(templatesDir)) {
            return res.status(404).send('Templates dir not found in ' + templatesDir);
        }

        const files = fs.readdirSync(templatesDir);
        const batch = db.batch();
        let count = 0;

        for (const file of files) {
            if (path.extname(file) === '.html') {
                const name = path.basename(file, '.html');
                const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
                // Extension expects template to be a document with fields
                // We put the CONTENT in 'html' field (or 'subject' etc)
                const ref = db.collection('email_templates').doc(name);
                batch.set(ref, {
                    html: content, // The actual HTML content
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                count++;
            }
        }
        await batch.commit();
        res.send(`Successfully uploaded ${count} templates to Firestore 'email_templates' collection.`);
    } catch (error) {
        console.error("Template Upload Error:", error);
        res.status(500).send(error.message);
    }
});

// Temporary function to check mail status
exports.checkMailStatus = functions.https.onRequest(async (req, res) => {
    try {
        const snapshot = await db.collection('mail')
            .orderBy('delivery.startTime', 'desc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            // Fallback: Just get last 5 added
            const fallback = await db.collection('mail').limit(5).get();
            if (fallback.empty) return res.send("No documents found in 'mail' collection.");

            const results = fallback.docs.map(doc => ({
                id: doc.id,
                data: doc.data()
            }));
            return res.json(results);
        }

        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            delivery: doc.data().delivery,
            to: doc.data().to,
            error: doc.data().delivery?.error || null,
            state: doc.data().delivery?.state || 'UNKNOWN'
        }));

        res.json(results);
    } catch (error) {
        res.status(500).send(error.message);
    }
});
