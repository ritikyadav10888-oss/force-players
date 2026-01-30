import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

/**
 * Export tournament players to Excel (CSV format)
 * @param {Array} players - Array of player objects
 * @param {string} tournamentName - Name of the tournament
 */
export const exportPlayersToExcel = async (players, tournamentName = 'Tournament') => {
    try {
        if (!players || players.length === 0) {
            Alert.alert('No Data', 'There are no players to export.');
            return;
        }

        // Define CSV headers with all requested fields
        const headers = [
            'Registration No',
            'Paid',
            'Player Name',
            'Email',
            'Phone',
            'Age',
            'DOB',
            'Gender',
            'Blood Group',
            'Address',
            'Aadhar No',
            'Emergency Contact',
            'Jersey Name',
            'Jersey Number',
            'Jersey Size',
            'Shorts Size',
            'Trouser Size',
            'Photo URL',
            'Aadhar Photo URL',
            'Registered Date',
            'Payment ID',
            'Amount Paid'
        ];

        // Convert players to CSV rows
        const rows = players.map((player, index) => {
            // Support both direct structure and nested data structure
            const personal = player.personal || player.data?.personal || {};
            const kit = player.kit || player.data?.kit || {};
            const gameProfiles = player.gameProfiles || player.data?.gameProfiles || {};

            // Use root level properties as primary source
            const playerName = player.playerName || personal.name || personal.fullName || 'Unknown';
            const playerPhone = player.phone || personal.phone || '-';
            const playerEmail = player.email || personal.email || '-';

            // Safely parse local date
            const formatDate = (dateInput) => {
                if (!dateInput) return '';
                // Handle Firestore Timestamp
                if (dateInput.seconds) {
                    return new Date(dateInput.seconds * 1000).toLocaleString('en-IN');
                }
                // Handle Date object
                if (dateInput instanceof Date) {
                    return dateInput.toLocaleString('en-IN');
                }
                // Handle string (ISO or other formats)
                const date = new Date(dateInput);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleString('en-IN');
                }
                // Fallback for custom formats if necessary, or return plain string
                return dateInput.toString();
            };

            return [
                player.registrationNumber || (index + 1), // Registration No
                player.paid ? 'YES' : 'NO', // Paid status
                `"${playerName.replace(/"/g, '""')}"`, // Name
                playerEmail,
                playerPhone,
                personal.age || '',
                personal.dob || '',
                personal.gender || '',
                personal.bloodGroup || '',
                `"${(personal.address || '').replace(/"/g, '""')}"`, // Escape quotes in address
                personal.adharId || '',
                personal.emergencyPhone || '',
                kit.jerseyName || '',
                kit.jerseyNumber || '',
                kit.jerseySize || kit.tShirtSize || '',
                kit.shortsSize || kit.shortSize || '',
                kit.trouserSize || '',
                personal.playerImgUrl || '',
                personal.adharImgUrl || '',
                `"${formatDate(player.registeredAt)}"`, // Registered Date
                player.paymentId || '',
                player.paidAmount || player.amount || ''
            ].join(',');
        });

        // Combine headers and rows
        const csvContent = [headers.join(','), ...rows].join('\n');

        // Generate filename
        const sanitizedTournamentName = tournamentName.replace(/[^a-z0-9]/gi, '_');
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${sanitizedTournamentName}_Players_${timestamp}.csv`;

        if (Platform.OS === 'web') {
            // Web: Download as file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Alert.alert('Success', `Exported ${players.length} players to ${filename}`);
        } else {
            // Mobile: Save to file system and share
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                encoding: 'utf8'
            });

            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Export Players Data',
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                Alert.alert('Success', `File saved to ${fileUri}`);
            }
        }

        return true;
    } catch (error) {
        console.error('Export error:', error);
        Alert.alert('Export Failed', error.message || 'Could not export player data');
        return false;
    }
};

/**
 * Export all tournament registrations with detailed information
 * @param {string} tournamentId - Tournament ID
 * @param {Object} db - Firestore database instance
 */
export const exportTournamentPlayers = async (tournamentId, tournamentName, db) => {
    try {
        const { collection, getDocs, query } = await import('firebase/firestore');

        // Fetch all players for this tournament
        const playersRef = collection(db, 'tournaments', tournamentId, 'players');
        const snapshot = await getDocs(query(playersRef));

        const players = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by registration date (newest first)
        players.sort((a, b) => {
            const dateA = a.registeredAt?.seconds || 0;
            const dateB = b.registeredAt?.seconds || 0;
            return dateB - dateA;
        });

        return await exportPlayersToExcel(players, tournamentName);
    } catch (error) {
        console.error('Error fetching tournament players:', error);
        Alert.alert('Error', 'Could not fetch player data');
        return false;
    }
};
