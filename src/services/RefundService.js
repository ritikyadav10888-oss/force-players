import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export const RefundService = {
    /**
     * Process player refund (95% refund, 5% processing fee)
     * @param {Object} data - { tournamentId, playerId, reason, refundPercentage }
     * @returns {Promise<Object>} - Refund result
     */
    processPlayerRefund: async (data) => {
        try {
            const refundFn = httpsCallable(functions, 'processPlayerRefund');
            const result = await refundFn(data);
            return result.data;
        } catch (error) {
            console.error("❌ Refund failed:", error);
            throw error;
        }
    }
};
