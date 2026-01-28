/**
 * Process Player Refund
 * Refunds 95% of the payment to the player (5% processing fee retained)
 * Can only be initiated by tournament organizers or owners
 */
exports.processPlayerRefund = onCall(
    { secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
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

            console.log(`💰 Processing refund: ₹${paidAmount} → ₹${refundAmount / 100} (${refundPercentage}%)`);

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

            console.log(`✅ Refund created: ${refund.id}`);

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
