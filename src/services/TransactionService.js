import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const TransactionService = {
    /**
     * Step 1: Create a Payout Transaction Entry
     * @param {Object} data - { tournamentId, organizerId, amount, receiverType, receiverName }
     * @returns {Promise<string>} transactionId
     */
    createTransaction: async (data) => {
        try {
            const createFn = httpsCallable(functions, 'createPayoutTransaction');
            const result = await createFn(data);
            return result.data; // Return full object { transactionId, amount, ... }
        } catch (error) {
            console.error("Error creating transaction:", error);
            throw error;
        }
    },

    /**
     * Step 1b: Create a Player Payment Transaction Entry
     * @param {Object} data - { tournamentId, amount, playerName, playerId, source }
     * @returns {Promise<string>} transactionId
     */
    initiatePlayerPayment: async (data) => {
        try {
            const createFn = httpsCallable(functions, 'createPlayerPaymentTransaction');
            const result = await createFn(data);
            return result.data.transactionId;
        } catch (error) {
            console.error("Error initiating player payment:", error);
            throw error;
        }
    },

    /**
     * Step 2: Process the Payout
     * @param {string} transactionId 
     * @param {Object} bankDetails - Optional { accountNumber, ifsc }
     * @param {string} beneficiaryName - Optional
     */
    processPayout: async (transactionId, bankDetails = null, beneficiaryName = null) => {
        try {
            const processFn = httpsCallable(functions, 'processPayout');
            const result = await processFn({ transactionId, bankDetails, beneficiaryName });
            return result.data;
        } catch (error) {
            console.error("Error processing payout:", error);
            throw error;
        }
    },

    /**
     * Step 3: Poll for Status Updates
     * @param {string} transactionId 
     * @param {Function} onUpdate - Callback(transactionData)
     * @returns {Function} unsubscribe
     */
    subscribeToTransaction: (transactionId, onUpdate) => {
        if (!transactionId) return () => { };
        const docRef = doc(db, 'transactions', transactionId);
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                onUpdate(docSnap.data());
            }
        });
    },

    /**
     * Manual Sync for Payout Status (Bypasses webhooks)
     * @param {string} transactionId 
     */
    syncPayoutStatus: async (transactionId) => {
        try {
            const syncFn = httpsCallable(functions, 'syncPayoutStatus');
            const result = await syncFn({ transactionId });
            return result.data;
        } catch (error) {
            console.error("Error syncing payout status:", error);
            throw error;
        }
    },

    /**
     * Verify Payment - Server-side signature verification
     * Call this after Razorpay checkout completes to verify the payment authenticity
     * @param {Object} data - { razorpay_payment_id, razorpay_order_id, razorpay_signature, tournamentId, playerId, transactionId }
     * @returns {Promise<Object>} - { success, verified, paymentId, amount, status, method }
     */
    verifyPayment: async (data) => {
        try {
            const verifyFn = httpsCallable(functions, 'verifyPayment');
            const result = await verifyFn(data);
            return result.data;
        } catch (error) {
            console.error("❌ Payment verification failed:", error);
            throw error;
        }
    },

    /**
     * Link Route Account to Organizer
     * @param {Object} data - { organizerId, linkedAccountId }
     */
    linkRouteAccount: async (data) => {
        try {
            const linkFn = httpsCallable(functions, 'linkRouteAccount');
            const result = await linkFn(data);
            return result.data;
        } catch (error) {
            console.error("Error linking account:", error);
            throw error;
        }
    },

    /**
     * Release Settlement (Razorpay Route 95/5)
     * @param {string} tournamentId 
     */
    releaseSettlement: async (tournamentId) => {
        try {
            const releaseFn = httpsCallable(functions, 'releaseSettlement');
            const result = await releaseFn({ tournamentId });
            return result.data;
        } catch (error) {
            console.error("Error releasing settlement:", error);
            throw error;
        }
    }
};
