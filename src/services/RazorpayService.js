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

// Get from Env or Fallback
const RAZORPAY_KEY_ID = Constants.expoConfig?.extra?.razorpayKeyId || 'rzp_test_S45Wn70zYz9AOr';

export const RazorpayService = {
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
     * Opens the Razorpay Checkout
     * @param {Object} options - { description, image, currency, key, amount, name, prefill: { email, contact, name }, theme: { color } }
     * @returns {Promise} - Resolves with payment ID on success
     */
    openCheckout: async (options) => {
        const fullOptions = {
            ...options,
            key: options.key || RAZORPAY_KEY_ID,
            amount: (options.amount * 100).toString(), // Convert to paisa
            currency: options.currency || 'INR',
            name: options.name || 'Tournament Entry',
            prefill: {
                ...options.prefill || {}
            },
            // Optional: Restrict to ONLY UPI (uncomment if strict restriction needed)
            // config: {
            //     display: {
            //         blocks: {
            //             upi: { name: "Pay with UPI", instruments: [{ method: "upi" }] }
            //         },
            //         sequence: ["block.upi"],
            //         preferences: { show_default_blocks: false }
            //     }
            // },
            theme: options.theme || { color: '#1a237e' }
        };

        if (Platform.OS === 'web') {
            const loaded = await RazorpayService.loadWebSDK();
            if (!loaded) {
                Alert.alert('Error', 'Razorpay SDK failed to load');
                return Promise.reject(new Error('Razorpay SDK failed to load'));
            }

            return new Promise((resolve, reject) => {
                try {
                    const rzp1 = new window.Razorpay({
                        ...fullOptions,
                        handler: (response) => {
                            resolve(response.razorpay_payment_id);
                        },
                        modal: {
                            ondismiss: () => {
                                reject(new Error('Payment Cancelled by User'));
                            }
                        }
                    });
                    rzp1.open();
                } catch (err) {
                    console.error("Razorpay Open Error:", err);
                    reject(new Error("Failed to open payment gateway: " + err.message));
                }
            });
        } else {
            // Native Implementation using react-native-razorpay
            try {
                const data = await RazorpayCheckout.open(fullOptions);
                return data.razorpay_payment_id;
            } catch (error) {
                // Razorpay native SDK returns errors in a specific format
                // Ensure we return an Error object
                const errMsg = error.description || error.reason || error.message || 'Payment Failed';
                return Promise.reject(new Error(errMsg));
            }
        }
    },

    /**
     * Mock function to simulate Payout/Transfer to Connected Account
     * In a real app, this MUST be done on a secure backend (Cloud Function / Node server)
     * using the Razorpay Routes API ( Transfers ).
     * 
     * @param {number} amount - Amount in Rupees
     * @param {string} accountId - The connected account ID (e.g., acc_Hz...)
     */
    initiateTransfer: async (amount, accountId) => {
        console.log(`[MOCK] Transferring ₹${amount} to account ${accountId}`);

        // Simulating API lag
        await new Promise(r => setTimeout(r, 1500));

        if (!accountId) {
            throw new Error("Invalid Connected Account ID");
        }

        // Return a mock transfer ID
        return `trf_${Date.now()}`;
    }
};