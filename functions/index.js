const functions = require('firebase-functions');
const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
        const body = JSON.stringify(req.body);
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
        if (event === 'payment.captured' || event === 'order.paid') {
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
exports.createOrganizer = onCall({ secrets: ["GMAIL_EMAIL", "GMAIL_PASSWORD"] }, async (request) => {
    // 1. Verify Authentication & Role
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Check if the caller is an owner (Fallback for missing role in doc)
    const callerUid = request.auth.uid;
    const callerEmail = request.auth.token.email;
    const OWNER_EMAILS = ['ritikyadav10888@gmail.com', 'priyanshu.force@gmail.com'];

    const callerDoc = await db.collection('users').doc(callerUid).get();
    const isLocalOwner = callerDoc.exists && callerDoc.data().role === 'owner';
    const isEmailOwner = OWNER_EMAILS.includes(callerEmail);
    const hasOwnerClaim = request.auth.token.role === 'owner';

    if (!isLocalOwner && !isEmailOwner && !hasOwnerClaim) {
        throw new HttpsError('permission-denied', 'Only owners can create organizers.');
    }

    const { email, password, name, phone, address, aadharNumber, profilePic, aadharPhoto, bankDetails, accessExpiryDate } = request.data;

    // 2. Validate Data
    if (!email || !password || !name) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
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
            phone,
            role: 'organizer',
            address,
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

        // 6. Send Email Notification (Nodemailer)
        const gmailEmail = process.env.GMAIL_EMAIL;
        const gmailPassword = process.env.GMAIL_PASSWORD;

        if (gmailEmail && gmailPassword) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: gmailEmail,
                    pass: gmailPassword
                }
            });

            const mailOptions = {
                from: `"Force Player Register" <${gmailEmail}>`,
                to: email,
                subject: 'Organizer Account Access',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Welcome, ${name}!</h2>
                        <p>Your organizer account has been created successfully.</p>
                        <p><strong>Login Details:</strong></p>
                        <ul>
                            <li><strong>Email:</strong> ${email}</li>
                            <li><strong>Password:</strong> ${password}</li>
                        </ul>
                        <p>Please login and change your password immediately.</p>
                        <hr/>
                        <p style="font-size: 12px; color: #777;">This is an automated message from Force Player Register.</p>
                    </div>
                `
            };

            try {
                const info = await transporter.sendMail(mailOptions);
                console.log("✅ Email sent successfully to:", email, "MessageId:", info.messageId);
            } catch (emailError) {
                console.error("❌ Nodemailer Error for:", email, "Error:", emailError.message);
                // We don't throw here to avoid rollback if only email failed
            }
        } else {
            console.error("❌ GMAIL_EMAIL or GMAIL_PASSWORD secret is empty in environment.");
        }

        return { success: true, uid: userRecord.uid };

    } catch (error) {
        console.error("Error creating organizer:", error);
        throw new HttpsError('internal', error.message);
    }
});
