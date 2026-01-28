import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

export default function OrganizerPayoutsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payouts, setPayouts] = useState([]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'payouts'),
            where('organizerId', '==', user.uid),
            orderBy('initiatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPayouts(data);
            setLoading(false);
            setRefreshing(false);
        }, (error) => {
            console.error('Error fetching payouts:', error);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 10 }}>Loading payouts...</Text>
            </View>
        );
    }

    if (payouts.length === 0) {
        return (
            <View style={styles.centered}>
                <Text variant="titleLarge" style={{ color: '#666', marginBottom: 10 }}>
                    No Payouts Yet
                </Text>
                <Text style={{ color: '#999', textAlign: 'center', paddingHorizontal: 40 }}>
                    Your settlement payouts will appear here once tournaments are completed
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3F51B5']} />
            }
        >
            <Text variant="headlineSmall" style={styles.header}>
                Settlement History
            </Text>

            {payouts.map((payout) => (
                <Card key={payout.id} style={styles.card}>
                    <Card.Content>
                        {/* Tournament Name */}
                        <Text variant="titleMedium" style={styles.tournamentName}>
                            {payout.tournamentName}
                        </Text>

                        {/* Status Chip */}
                        <Chip
                            icon={payout.status === 'completed' ? 'check-circle' : 'clock-outline'}
                            mode="flat"
                            style={[
                                styles.statusChip,
                                { backgroundColor: payout.status === 'completed' ? '#4CAF50' : '#FF9800' }
                            ]}
                        >
                            {payout.status.toUpperCase()}
                        </Chip>

                        <Divider style={{ marginVertical: 15 }} />

                        {/* Financial Details */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Total Collected:</Text>
                            <Text style={styles.value}>
                                ₹{Math.round(payout.totalCollected).toLocaleString('en-IN')}
                            </Text>
                        </View>

                        <View style={styles.row}>
                            <Text style={styles.label}>Platform Commission (5%):</Text>
                            <Text style={[styles.value, { color: '#d32f2f' }]}>
                                -₹{Math.round(payout.platformCommission).toLocaleString('en-IN')}
                            </Text>
                        </View>

                        <View style={styles.row}>
                            <Text style={[styles.label, styles.bold]}>Your Share (95%):</Text>
                            <Text style={[styles.value, styles.amountValue]}>
                                ₹{Math.round(payout.organizerShare).toLocaleString('en-IN')}
                            </Text>
                        </View>

                        <Divider style={{ marginVertical: 15 }} />

                        {/* Settlement Details */}
                        {payout.status === 'completed' && (
                            <>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Invoice Number:</Text>
                                    <Text style={styles.value}>{payout.invoiceNumber}</Text>
                                </View>

                                <View style={styles.row}>
                                    <Text style={styles.label}>Transfer ID:</Text>
                                    <Text style={[styles.value, { fontSize: 12 }]}>
                                        {payout.transferId}
                                    </Text>
                                </View>

                                <View style={styles.row}>
                                    <Text style={styles.label}>Settlement Date:</Text>
                                    <Text style={styles.value}>
                                        {new Date(payout.completedAt).toLocaleDateString('en-IN')}
                                    </Text>
                                </View>

                                {/* Bank Details */}
                                <Divider style={{ marginVertical: 15 }} />
                                <Text style={styles.sectionTitle}>Bank Account</Text>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Bank:</Text>
                                    <Text style={styles.value}>{payout.bankDetails.bankName}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Account:</Text>
                                    <Text style={styles.value}>{payout.bankDetails.accountNumber}</Text>
                                </View>
                            </>
                        )}

                        {payout.status === 'failed' && payout.failureReason && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>
                                    ⚠️ {payout.failureReason}
                                </Text>
                            </View>
                        )}
                    </Card.Content>
                </Card>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 15
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    header: {
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#1a237e'
    },
    card: {
        marginBottom: 15,
        borderRadius: 12
    },
    tournamentName: {
        fontWeight: '600',
        color: '#1a237e',
        marginBottom: 10
    },
    statusChip: {
        alignSelf: 'flex-start'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6
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
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 8,
        color: '#1a237e'
    },
    errorBox: {
        backgroundColor: '#ffebee',
        padding: 12,
        borderRadius: 8,
        marginTop: 10
    },
    errorText: {
        color: '#d32f2f',
        fontSize: 13
    }
});
