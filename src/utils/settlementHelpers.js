import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const calculateSettlement = async (tournamentId) => {
    try {
        const tRef = doc(db, 'tournaments', tournamentId);
        const tSnap = await getDoc(tRef);

        if (!tSnap.exists()) throw new Error("Tournament not found");

        const tournament = tSnap.data();

        // 1. Determine Total Revenue
        let totalRevenue = tournament.totalCollections || 0;

        // Fallback: Calculate from players collection if totalCollections is missing/zero
        // This ensures the payout button works even if stats weren't synced
        if (!totalRevenue || totalRevenue === 0) {
            const playersRef = collection(db, 'tournaments', tournamentId, 'players');
            // We use getDocs to aggregate client-side for safety in this robust helper
            const pSnap = await import('firebase/firestore').then(mod => mod.getDocs(playersRef));

            let calcRevenue = 0;
            const fee = parseInt(tournament.entryFee) || 0;

            pSnap.docs.forEach(doc => {
                const pData = doc.data();
                if (pData.paid === true) {
                    calcRevenue += fee;
                }
            });
            totalRevenue = calcRevenue;
        }

        const PLATFORM_FEE_PERCENT = 0.05; // 5%
        const ORGANIZER_SHARE_PERCENT = 0.95; // 95%

        const platformFee = Math.floor(totalRevenue * PLATFORM_FEE_PERCENT);
        const organizerShare = Math.floor(totalRevenue * ORGANIZER_SHARE_PERCENT);

        return {
            totalRevenue,
            platformFee,
            organizerShare,
            currency: 'INR'
        };

    } catch (error) {
        console.error("Error calculating settlement:", error);
        throw error;
    }
};

export const recordSettlement = async (tournamentId, settlementData, organizerId) => {
    try {
        // 1. Update Tournament Document
        const tRef = doc(db, 'tournaments', tournamentId);
        await updateDoc(tRef, {
            settlement: {
                status: 'settled',
                platformFee: settlementData.platformFee,
                organizerShare: settlementData.organizerShare,
                settledAt: new Date().toISOString(),
                transactionId: settlementData.transferId // The Mock Transfer ID
            }
        });

        // 2. Update Organizer's Total Earnings (Optional but good for quick stats)
        // We can't do atomic increment easily without a transaction, but simple update is fine for this demo
        if (organizerId) {
            const orgRef = doc(db, 'users', organizerId);
            const orgSnap = await getDoc(orgRef);
            if (orgSnap.exists()) {
                const currentEarnings = orgSnap.data().totalEarnings || 0;
                await updateDoc(orgRef, {
                    totalEarnings: currentEarnings + settlementData.organizerShare
                });
            }
        }

        return true;
    } catch (error) {
        console.error("Error recording settlement:", error);
        throw error;
    }
};
