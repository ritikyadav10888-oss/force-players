import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import {
    Text,
    Card,
    ActivityIndicator,
    Chip,
    Divider,
    SegmentedButtons,
    DataTable
} from 'react-native-paper';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

export default function FinancialsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statements, setStatements] = useState([]);
    const [filter, setFilter] = useState('all');
    const [transactions, setTransactions] = useState([]);
    const [totalCollected, setTotalCollected] = useState(0);
    const [totalOrganizerShare, setTotalOrganizerShare] = useState(0);

    const [unsubs, setUnsubs] = useState([]);

    const fetchData = () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Cleanup old listeners if any
        unsubs.forEach(u => u());

        try {
            // Query business transactions (Incoming Registrations)
            // Removed orderBy to avoid composite index requirement
            const qTx = query(
                collection(db, 'transactions'),
                where('ownerId', '==', 'force_owner')
            );

            const unsubTx = onSnapshot(qTx,
                (snap) => {
                    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Sort by updatedAt in memory (newest first)
                    list.sort((a, b) => {
                        const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
                        const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
                        return dateB - dateA;
                    });

                    setTransactions(list);

                    // Calculate total incoming collections (SUCCESS only)
                    const collections = list.filter(t => t.type === 'collection' && t.status === 'SUCCESS');
                    const total = collections.reduce((acc, current) => acc + (Number(current.amount) || 0), 0);
                    setTotalCollected(total);
                },
                (error) => {
                    console.error('Error fetching transactions:', error);
                    setTransactions([]);
                    setTotalCollected(0);
                }
            );

            // Query Settlement History (Financial Statements)
            // Removed orderBy to avoid composite index requirement
            const qSt = query(
                collection(db, 'financial_statements'),
                where('ownerId', '==', 'force_owner')
            );

            const unsubSt = onSnapshot(qSt,
                (snap) => {
                    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Sort by generatedAt in memory (newest first)
                    list.sort((a, b) => {
                        const dateA = a.generatedAt?.toDate ? a.generatedAt.toDate() : new Date(a.generatedAt || 0);
                        const dateB = b.generatedAt?.toDate ? b.generatedAt.toDate() : new Date(b.generatedAt || 0);
                        return dateB - dateA;
                    });

                    setStatements(list);

                    // Calculate total settled funds
                    const settled = list.reduce((acc, current) => acc + (Number(current.organizerShare) || 0), 0);
                    setTotalOrganizerShare(settled);
                    setLoading(false);
                    setRefreshing(false);
                },
                (error) => {
                    console.error('Error fetching statements:', error);
                    setStatements([]);
                    setTotalOrganizerShare(0);
                    setLoading(false);
                    setRefreshing(false);
                }
            );

            setUnsubs([unsubTx, unsubSt]);
        } catch (error) {
            console.error('Error setting up owner financials queries:', error);
            setTransactions([]);
            setStatements([]);
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        return () => unsubs.forEach(u => u());
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const filteredStatements = statements.filter(s => {
        if (filter === 'all') return true;
        if (filter === 'settlement') return true;
        return false;
    });

    const filteredTransactions = transactions.filter(t => {
        if (filter === 'all') return true;
        if (filter === 'collection') return t.type === 'collection';
        if (filter === 'settlement') return t.type === 'payout';
        return false;
    });

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 10 }}>Loading financials...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3F51B5']} />}
        >
            <Text variant="headlineSmall" style={styles.header}>Business Financials</Text>

            {/* Combined Ledger Metrics */}
            <View style={styles.summaryContainer}>
                <Card style={styles.summaryCard}>
                    <Card.Content>
                        <Text style={styles.summaryLabel}>Gross Collections</Text>
                        <Text style={styles.summaryValue}>₹{Math.round(totalCollected).toLocaleString()}</Text>
                    </Card.Content>
                </Card>
                <Card style={styles.summaryCard}>
                    <Card.Content>
                        <Text style={styles.summaryLabel}>Total Settled</Text>
                        <Text style={[styles.summaryValue, { color: '#2e7d32' }]}>₹{Math.round(totalOrganizerShare).toLocaleString()}</Text>
                    </Card.Content>
                </Card>
            </View>

            {/* Filter - Only show if there's data */}
            {(transactions.length > 0 || statements.length > 0) && (
                <SegmentedButtons
                    value={filter}
                    onValueChange={setFilter}
                    buttons={[
                        { value: 'all', label: 'All' },
                        { value: 'collection', label: 'Incoming' },
                        { value: 'settlement', label: 'Settlements' }
                    ]}
                    style={styles.filter}
                />
            )}

            {/* Transactions List */}
            {(filter === 'all' || filter === 'collection') && filteredTransactions.map((t) => (
                <Card key={t.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: t.status === 'SUCCESS' ? '#4CAF50' : '#f44336' }]}>
                    <Card.Content>
                        <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: 'bold' }}>{t.playerName || 'Anonymous Player'}</Text>
                                <Text style={styles.date}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Date not available'}</Text>
                            </View>
                            <Chip
                                mode="flat"
                                style={{ backgroundColor: t.status === 'SUCCESS' ? '#E8F5E9' : '#FFEBEE' }}
                                textStyle={{ color: t.status === 'SUCCESS' ? '#2E7D32' : '#C62828', fontSize: 10 }}
                            >
                                {t.status}
                            </Chip>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                            <Text style={{ color: '#666' }}>Amount:</Text>
                            <Text style={{ fontWeight: 'bold' }}>₹{t.amount?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</Text>
                        </View>
                        {t.type === 'collection' && t.status === 'SUCCESS' && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                    <Text style={{ color: '#999', fontSize: 12 }}>Platform Fee (5%):</Text>
                                    <Text style={{ color: '#d32f2f', fontSize: 12 }}>-₹{Math.round(t.amount * 0.05)}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                    <Text style={{ color: '#1a237e', fontWeight: '500', fontSize: 13 }}>Net Revenue:</Text>
                                    <Text style={{ color: '#1a237e', fontWeight: 'bold', fontSize: 13 }}>₹{Math.round(t.amount * 0.95)}</Text>
                                </View>
                            </>
                        )}
                        <Text style={{ fontSize: 10, color: '#999', marginTop: 8 }}>Tournament: {t.tournamentName}</Text>
                    </Card.Content>
                </Card>
            ))}

            {/* Statements List */}
            {(filter === 'all' || filter === 'settlement') && (
                filteredStatements.length === 0 ? (
                    filter === 'settlement' && (
                        <View style={styles.centered}>
                            <Text style={{ color: '#666', marginTop: 20 }}>No settlement history found</Text>
                        </View>
                    )
                ) : (
                    filteredStatements.map((statement) => (
                        <Card key={statement.id} style={styles.card}>
                            {/* ... existing statement card content ... */}
                            <Card.Content>
                                {/* Header */}
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleMedium" style={styles.tournamentName}>
                                            {statement.tournamentName || 'Unknown Tournament'}
                                        </Text>
                                        <Text style={styles.date}>
                                            {statement.settlementDate ? new Date(statement.settlementDate).toLocaleDateString() : 'Date not available'}
                                        </Text>
                                    </View>
                                    <Chip mode="flat" style={styles.typeChip}>
                                        SETTLED
                                    </Chip>
                                </View>

                                <Divider style={{ marginVertical: 15 }} />

                                <View style={styles.row}>
                                    <Text style={styles.label}>Total Collected:</Text>
                                    <Text style={styles.value}>₹{statement.totalCollected?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Platform Fee (5%):</Text>
                                    <Text style={[styles.value, { color: '#d32f2f' }]}>-₹{statement.platformCommission?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</Text>
                                </View>
                                <View style={[styles.row, { marginTop: 10 }]}>
                                    <Text style={{ fontWeight: 'bold', color: '#1a237e' }}>Organizer Share:</Text>
                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2e7d32' }}>₹{statement.organizerShare?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</Text>
                                </View>

                                <Divider style={{ marginVertical: 15 }} />

                                <View style={styles.infoSection}>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Organizer:</Text>
                                        <Text style={styles.value}>{statement.organizerName}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Invoice:</Text>
                                        <Text style={styles.value}>{statement.invoiceNumber}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Ref:</Text>
                                        <Text style={[styles.value, { fontSize: 10 }]}>{statement.payoutId || statement.transferId || 'N/A'}</Text>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    ))
                )
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
    summaryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 15,
        gap: 10
    },
    summaryCard: {
        flex: 1,
        minWidth: 150,
        borderRadius: 12
    },
    summaryLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 5
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a237e'
    },
    filter: {
        marginBottom: 15
    },
    card: {
        marginBottom: 15,
        borderRadius: 12
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    tournamentName: {
        fontWeight: '600',
        color: '#1a237e',
        marginBottom: 5
    },
    date: {
        fontSize: 12,
        color: '#666'
    },
    typeChip: {
        backgroundColor: '#e3f2fd'
    },
    infoSection: {
        gap: 8
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
    },
    label: {
        color: '#666',
        fontSize: 13
    },
    value: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'right',
        flex: 1,
        marginLeft: 10
    }
});
