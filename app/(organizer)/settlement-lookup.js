import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
    Text,
    Card,
    TextInput,
    Button,
    ActivityIndicator,
    Chip,
    Divider,
    Surface
} from 'react-native-paper';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

export default function SettlementLookupScreen() {
    const [tournamentId, setTournamentId] = useState('');
    const [loading, setLoading] = useState(false);
    const [settlement, setSettlement] = useState(null);
    const [error, setError] = useState('');

    const lookupSettlement = async () => {
        if (!tournamentId.trim()) {
            setError('Please enter a tournament ID');
            return;
        }

        setLoading(true);
        setError('');
        setSettlement(null);

        try {
            // Fetch tournament
            const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId.trim()));

            if (!tournamentDoc.exists()) {
                setError('Tournament not found');
                return;
            }

            const tournament = tournamentDoc.data();

            // Fetch settlement/payout
            const payoutQuery = query(
                collection(db, 'payouts'),
                where('tournamentId', '==', tournamentId.trim())
            );
            const payoutSnap = await getDocs(payoutQuery);

            if (payoutSnap.empty) {
                setError('No settlement found for this tournament');
                return;
            }

            const payout = payoutSnap.docs[0].data();

            // Fetch organizer details
            const organizerDoc = await getDoc(doc(db, 'users', payout.organizerId));
            const organizer = organizerDoc.data();

            setSettlement({
                tournament,
                payout,
                organizer
            });

        } catch (err) {
            console.error('Lookup error:', err);
            setError('Error fetching settlement details');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.searchCard}>
                <Card.Content>
                    <Text variant="titleLarge" style={styles.title}>
                        Settlement Lookup
                    </Text>
                    <Text style={styles.subtitle}>
                        Enter tournament ID to view settlement details
                    </Text>

                    <TextInput
                        label="Tournament ID"
                        value={tournamentId}
                        onChangeText={setTournamentId}
                        mode="outlined"
                        style={styles.input}
                        placeholder="Enter tournament ID"
                    />

                    <Button
                        mode="contained"
                        onPress={lookupSettlement}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        Search
                    </Button>

                    {error && (
                        <Text style={styles.error}>{error}</Text>
                    )}
                </Card.Content>
            </Card>

            {settlement && (
                <Card style={styles.resultCard}>
                    <Card.Content>
                        {/* Tournament Info */}
                        <Text variant="headlineSmall" style={styles.tournamentName}>
                            {settlement.tournament.name}
                        </Text>
                        <Text style={{ color: '#666', marginBottom: 15 }}>
                            {settlement.tournament.gameName}
                        </Text>

                        <Divider />

                        {/* Organizer Info */}
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                Organizer
                            </Text>
                            <View style={styles.row}>
                                <Text style={styles.label}>Name:</Text>
                                <Text style={styles.value}>{settlement.organizer.name}</Text>
                            </View>
                        </View>

                        <Divider />

                        {/* Financial Summary */}
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                Financial Summary
                            </Text>

                            <View style={styles.row}>
                                <Text style={styles.label}>Total Collected:</Text>
                                <Text style={styles.value}>
                                    ₹{Math.round(settlement.payout.totalCollected).toLocaleString('en-IN')}
                                </Text>
                            </View>

                            <View style={styles.row}>
                                <Text style={styles.label}>Platform Commission (5%):</Text>
                                <Text style={[styles.value, { color: '#d32f2f' }]}>
                                    -₹{Math.round(settlement.payout.platformCommission).toLocaleString('en-IN')}
                                </Text>
                            </View>

                            <View style={styles.row}>
                                <Text style={[styles.label, styles.bold]}>Organizer Share (95%):</Text>
                                <Text style={[styles.value, styles.amountValue]}>
                                    ₹{Math.round(settlement.payout.organizerShare).toLocaleString('en-IN')}
                                </Text>
                            </View>
                        </View>

                        <Divider />

                        {/* Status */}
                        <View style={styles.section}>
                            <View style={styles.row}>
                                <Text style={styles.label}>Status:</Text>
                                <Chip
                                    mode="flat"
                                    style={{
                                        backgroundColor: settlement.payout.status === 'completed' ? '#4CAF50' : '#FF9800'
                                    }}
                                >
                                    {settlement.payout.status.toUpperCase()}
                                </Chip>
                            </View>

                            {settlement.payout.status === 'completed' && (
                                <>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Settlement Date:</Text>
                                        <Text style={styles.value}>
                                            {new Date(settlement.payout.completedAt).toLocaleDateString('en-IN')}
                                        </Text>
                                    </View>

                                    <View style={styles.row}>
                                        <Text style={styles.label}>Transfer ID:</Text>
                                        <Text style={[styles.value, { fontSize: 12 }]}>
                                            {settlement.payout.transferId}
                                        </Text>
                                    </View>

                                    {settlement.payout.invoiceNumber && (
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Invoice Number:</Text>
                                            <Text style={styles.value}>
                                                {settlement.payout.invoiceNumber}
                                            </Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>

                        <Divider />

                        {/* Bank Details */}
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                Bank Details
                            </Text>
                            <View style={styles.row}>
                                <Text style={styles.label}>Bank Name:</Text>
                                <Text style={styles.value}>
                                    {settlement.payout.bankDetails.bankName}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Account Number:</Text>
                                <Text style={styles.value}>
                                    {settlement.payout.bankDetails.accountNumber}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>IFSC Code:</Text>
                                <Text style={styles.value}>
                                    {settlement.payout.bankDetails.ifsc}
                                </Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 15
    },
    searchCard: {
        marginBottom: 15,
        borderRadius: 12
    },
    title: {
        fontWeight: 'bold',
        color: '#1a237e',
        marginBottom: 5
    },
    subtitle: {
        color: '#666',
        marginBottom: 20
    },
    input: {
        marginBottom: 15
    },
    button: {
        borderRadius: 8
    },
    error: {
        color: '#d32f2f',
        marginTop: 10,
        textAlign: 'center'
    },
    resultCard: {
        borderRadius: 12
    },
    tournamentName: {
        fontWeight: '600',
        color: '#1a237e'
    },
    section: {
        paddingVertical: 15
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 10,
        color: '#1a237e'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        alignItems: 'center'
    },
    label: {
        color: '#666',
        fontSize: 14
    },
    value: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'right',
        flex: 1,
        marginLeft: 10
    },
    bold: {
        fontWeight: '600'
    },
    amountValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2e7d32'
    }
});
