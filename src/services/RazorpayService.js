import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

let RazorpayCheckout = null;
if (Platform.OS !== 'web') {
    try {
        RazorpayCheckout = require('react-native-razorpay').default;
    } catch (e) {
        console.warn("Razorpay native module not found");
    }
}

// Get Razorpay Key from Environment Variables (Secure)
// PRIORITY: Logged behavior shows process.env has the LIVE key, while Constants has the TEST key (cached).
// So we switch to favor process.env.
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID;

if (!RAZORPAY_KEY_ID) {
    console.error('⚠️ RAZORPAY_KEY_ID not configured. Payment will fail.');
}

export const RazorpayService = {
    /**
     * Set to true to restrict payments to UPI only.
     * Setting to false to allow fallback methods (Card, Netbanking) if UPI is not configured.
     */
    restrictToUPI: true,

    /**
     * loads the Razorpay checkout script for Web
     */
    loadWebSDK: () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    },

    /**
     * Create payment order with Razorpay Route (automatic 95/5 split)
     * @param {Object} paymentData - { tournamentId, playerId, amount, playerName }
     * @returns {Promise} - Resolves with order details
     */
    createPaymentWithRoute: async (paymentData) => {
        try {
            // Import Firebase functions dynamically to avoid circular dependencies
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const createPaymentWithRoute = httpsCallable(functions, 'createPaymentWithRoute');

            const result = await createPaymentWithRoute({
                ...paymentData,
                transactionId: paymentData.transactionId || null
            });

            if (result.data.success) {
                console.log('✅ Order created:', result.data.orderId);

                if (result.data.kycWarning) {
                    console.warn('⚠️', result.data.kycWarning);
                }

                return result.data;
            } else {
                throw new Error('Failed to create payment order');
            }
        } catch (error) {
            console.error('❌ Create payment order error:', error);
            throw error;
        }
    },

    /**
     * Opens the Razorpay Checkout with Route-based payment splitting
     * @param {Object} options - { tournamentId, playerId, amount, playerName, description, prefill: { email, contact, name }, theme: { color } }
     * @returns {Promise} - Resolves with payment ID on success
     */
    openCheckout: async (options) => {
        const VERSION = "1.0.3-HARDENED";
        console.log(`🚀 [RazorpayService v${VERSION}] Opening Checkout...`);
        const amount = parseFloat(options.amount);

        if (isNaN(amount) || amount <= 0) {
            console.error("Invalid amount for Razorpay:", options.amount);
            Alert.alert("Error", "Invalid payment amount");
            return Promise.reject(new Error("Invalid amount"));
        }

        // Step 1: Create order with Route (automatic 95/5 split with hold)
        let orderData;
        try {
            const cleanTourneyId = options.tournamentId && options.tournamentId !== 'null' && options.tournamentId !== 'undefined' ? String(options.tournamentId) : null;
            const cleanPlayerId = options.playerId && options.playerId !== 'null' && options.playerId !== 'undefined' ? String(options.playerId) : null;

            if (!cleanTourneyId || !cleanPlayerId || !amount) {
                console.error("❌ Missing required fields in openCheckout options:", {
                    tournamentId: cleanTourneyId,
                    playerId: cleanPlayerId,
                    amount: amount
                });
                throw new Error("Missing required payment information (ID or Amount)");
            }

            orderData = await RazorpayService.createPaymentWithRoute({
                tournamentId: cleanTourneyId,
                playerId: cleanPlayerId,
                amount: Number(amount),
                playerName: String(options.playerName || options.prefill?.name || 'Player'),
                transactionId: options.transactionId ? String(options.transactionId) : null
            });
        } catch (error) {
            console.error("Failed to create payment order:", error);
            Alert.alert("Error", "Failed to initialize payment. Please try again.");
            return Promise.reject(error);
        }

        // Step 2: Open Razorpay checkout with order ID
        const fullOptions = {
            ...options,
            key: options.key || RAZORPAY_KEY_ID,
            order_id: orderData.orderId, // Use order ID from Route
            amount: orderData.amount.toString(), // Amount in paise from backend
            currency: 'INR',
            name: options.name || 'Tournament Entry',
            description: options.description || `Entry fee for tournament`,
            prefill: {
                ...options.prefill || {}
            },
            theme: options.theme || { color: '#1a237e' },
            payment_capture: 1 // Auto-capture the payment immediately after authorization
        };

        // Apply UPI-only restriction if enabled
        if (RazorpayService.restrictToUPI) {
            fullOptions.config = {
                display: {
                    blocks: {
                        upi: {
                            name: "Pay with UPI",
                            instruments: [{ method: "upi" }]
                        }
                    },
                    sequence: ["block.upi"],
                    preferences: { show_default_blocks: false }
                }
            };
        }

        if (Platform.OS === 'web') {
            const loaded = await RazorpayService.loadWebSDK();
            if (!loaded) {
                Alert.alert('Error', 'Razorpay SDK failed to load');
                return Promise.reject(new Error('Razorpay SDK failed to load'));
            }

            return new Promise((resolve, reject) => {
                try {
                    if (!window.Razorpay) {
                        throw new Error("Razorpay Web SDK not loaded. Please refresh.");
                    }

                    const rzp1 = new window.Razorpay({
                        ...fullOptions,
                        handler: (response) => {
                            // Return full response object for server-side verification
                            resolve({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id || null,
                                razorpay_signature: response.razorpay_signature || null
                            });
                        },
                        modal: {
                            ondismiss: () => {
                                console.log("Razorpay Payment Modal Dismissed");
                                reject(new Error('Payment Cancelled by User'));
                            }
                        }
                    });
                    rzp1.open();
                } catch (err) {
                    console.error("Razorpay Web Error:", err);
                    reject(new Error("Failed to open payment gateway: " + err.message));
                }
            });
        } else {
            // Native Implementation using react-native-razorpay
            try {
                if (!RazorpayCheckout) throw new Error("Razorpay module not available");
                const data = await RazorpayCheckout.open(fullOptions);
                // Return full response object for server-side verification
                return {
                    razorpay_payment_id: data.razorpay_payment_id,
                    razorpay_order_id: data.razorpay_order_id || null,
                    razorpay_signature: data.razorpay_signature || null
                };
            } catch (error) {
                const errMsg = error.description || error.reason || error.message || 'Payment Failed';
                return Promise.reject(new Error(errMsg));
            }
        }
    },

    /**
     * Release settlement to organizer (called by owner)
     * @param {string} tournamentId - Tournament ID
     * @returns {Promise} - Resolves with release result
     */
    releaseSettlement: async (tournamentId) => {
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const releaseSettlement = httpsCallable(functions, 'releaseSettlement');

            console.log('🔓 Releasing settlement for tournament:', tournamentId);
            const result = await releaseSettlement({ tournamentId });

            if (result.data.success) {
                console.log(`✅ Released ${result.data.releasedCount} settlements`);
                return result.data;
            } else {
                throw new Error('Failed to release settlement');
            }
        } catch (error) {
            console.error('❌ Release settlement error:', error);
            throw error;
        }
    }
};