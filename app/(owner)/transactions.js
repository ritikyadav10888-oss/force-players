import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import {
    Text,
    Card,
    ActivityIndicator,
    Chip,
    Divider,
    SegmentedButtons,
    DataTable,
    Searchbar,
    IconButton,
    Surface
} from 'react-native-paper';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

export default function TransactionsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [filter, setFilter] = useState('grouped'); // all, payments, payouts, grouped
    const [statusFilter, setStatusFilter] = useState('all'); // all, success, failed, processing
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTournaments, setExpandedTournaments] = useState({}); // { tournamentId: boolean }

    const toggleTournament = (tId) => {
        setExpandedTournaments(prev => ({
            ...prev,
            [tId]: !prev[tId]
        }));
    };

    useEffect(() => {
        if (!user) return;

        // Query all transactions (both payments and payouts)
        const q = query(
            collection(db, 'transactions'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTransactions(data);
            setLoading(false);
            setRefreshing(false);
        }, (error) => {
            console.error('Error fetching transactions:', error);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
    };

    const filteredTransactions = transactions.filter(txn => {
        // Filter by type (only if not grouped)
        if (filter === 'payments' && txn.type !== 'collection') return false;
        if (filter === 'payouts' && txn.type !== 'payout') return false;

        // Filter by status
        if (statusFilter !== 'all') {
            if (statusFilter === 'success' && txn.status !== 'SUCCESS') return false;
            if (statusFilter === 'failed' && txn.status !== 'FAILED') return false;
            if (statusFilter === 'processing' && !['STARTED', 'PROCESSING', 'PROCESSED'].includes(txn.status)) return false;
        }

        // Search filter
        if (searchQuery) {
            const search = searchQuery.toLowerCase();
            return (
                txn.id.toLowerCase().includes(search) ||
                txn.tournamentName?.toLowerCase().includes(search) ||
                txn.tournamentId?.toLowerCase().includes(search) ||
                txn.playerName?.toLowerCase().includes(search) ||
                txn.playerId?.toLowerCase().includes(search) ||
                txn.receiver?.name?.toLowerCase().includes(search) ||
                txn.gatewayRefId?.toLowerCase().includes(search)
            );
        }

        return true;
    });

    // Grouping logic
    const groupedTransactions = filteredTransactions.reduce((acc, txn) => {
        const tId = txn.tournamentId || 'miscellaneous';
        if (!acc[tId]) {
            acc[tId] = {
                id: tId,
                name: txn.tournamentName || (tId !== 'miscellaneous' ? `ID: ${tId.slice(0, 8)}` : 'Miscellaneous/Internal'),
                txns: []
            };
        }
        // If the current transaction has a name but the group fallback is still active, update the group name
        if (txn.tournamentName && (acc[tId].name === 'Miscellaneous/Internal' || acc[tId].name.startsWith('ID:'))) {
            acc[tId].name = txn.tournamentName;
        }
        acc[tId].txns.push(txn);
        return acc;
    }, {});

    const groupedArray = Object.values(groupedTransactions)
        .filter(group => group.name !== 'Miscellaneous/Internal' && !group.name.startsWith('ID:'))
        .sort((a, b) => {
            // Helper to get time safely
            const getTime = (txn) => {
                const date = txn.createdAt?.toDate ? txn.createdAt.toDate() : new Date(txn.createdAt || 0);
                return date.getTime() || 0;
            };

            // Sort groups by the latest transaction in each group
            const latestA = Math.max(...a.txns.map(getTime));
            const latestB = Math.max(...b.txns.map(getTime));
            return latestB - latestA;
        });

    // Calculate statistics
    const stats = {
        totalPayments: transactions.filter(t => t.type === 'collection').length,
        totalPayouts: transactions.filter(t => t.type === 'payout').length,
        successfulPayments: transactions.filter(t => t.type === 'collection' && t.status === 'SUCCESS').length,
        successfulPayouts: transactions.filter(t => t.type === 'payout' && t.status === 'SUCCESS').length,
        totalPaymentsAmount: transactions
            .filter(t => t.type === 'collection' && t.status === 'SUCCESS')
            .reduce((sum, t) => sum + (t.amount || 0), 0),
        totalPayoutsAmount: transactions
            .filter(t => t.type === 'payout' && t.status === 'SUCCESS')
            .reduce((sum, t) => sum + (t.amount || 0), 0)
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SUCCESS': return '#4CAF50';
            case 'FAILED': return '#f44336';
            case 'REVERSED': return '#FF9800';
            case 'PROCESSING': return '#2196F3';
            case 'STARTED': return '#9C27B0';
            default: return '#757575';
        }
    };

    const getSourceLabel = (type) => {
        return type === 'collection' ? 'Player Payment' : 'Organizer Payout';
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 10 }}>Loading transactions...</Text>
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
            {/* Header */}
            <Text variant="headlineSmall" style={styles.header}>
                All Transactions
            </Text>

            {/* Statistics Cards */}
            <View style={styles.statsContainer}>
                <Card style={styles.statCard}>
                    <Card.Content>
                        <Text style={styles.statLabel}>Total Payments</Text>
                        <Text style={styles.statValue}>{stats.totalPayments}</Text>
                        <Text style={styles.statSubtext}>
                            ₹{stats.totalPaymentsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                    </Card.Content>
                </Card>

                <Card style={styles.statCard}>
                    <Card.Content>
                        <Text style={styles.statLabel}>Total Payouts</Text>
                        <Text style={styles.statValue}>{stats.totalPayouts}</Text>
                        <Text style={styles.statSubtext}>
                            ₹{stats.totalPayoutsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                    </Card.Content>
                </Card>

                <Card style={styles.statCard}>
                    <Card.Content>
                        <Text style={styles.statLabel}>Platform Revenue (5%)</Text>
                        <Text style={[styles.statValue, { color: '#2e7d32' }]}>
                            ₹{(stats.totalPaymentsAmount * 0.05).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.statSubtext}>
                            {stats.successfulPayments} successful
                        </Text>
                    </Card.Content>
                </Card>
            </View>

            {/* Search */}
            <Searchbar
                placeholder="Search by ID, Tournament, Player..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchbar}
            />

            {/* Filters */}
            <SegmentedButtons
                value={filter}
                onValueChange={setFilter}
                buttons={[
                    { value: 'grouped', label: 'By Tournament' },
                    { value: 'all', label: 'Flat View' },
                    { value: 'payments', label: 'Payments' },
                    { value: 'payouts', label: 'Payouts' }
                ]}
                style={styles.filter}
            />

            <SegmentedButtons
                value={statusFilter}
                onValueChange={setStatusFilter}
                buttons={[
                    { value: 'all', label: 'All Status' },
                    { value: 'success', label: 'Success' },
                    { value: 'processing', label: 'Processing' },
                    { value: 'failed', label: 'Failed' }
                ]}
                style={styles.filter}
            />

            {/* Transactions List */}
            {filteredTransactions.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={{ color: '#666', marginTop: 20 }}>
                        No transactions found
                    </Text>
                </View>
            ) : filter === 'grouped' ? (
                groupedArray.map((group) => {
                    const isExpanded = expandedTournaments[group.id];
                    const groupStats = group.txns.reduce((acc, t) => {
                        // Total Collected: Sum of all successful collection transactions
                        if (t.type === 'collection' && t.status === 'SUCCESS') {
                            acc.collected += (t.amount || 0);
                        }

                        // Total Settled (Paid to Organizer):
                        // 1. Direct 'payout' transactions (Manual Payouts)
                        if (t.type === 'payout' && t.status === 'SUCCESS') {
                            acc.paid += (t.amount || 0);
                        }
                        // 2. Released Route Settlements (embedded in collections)
                        // If a collection transaction is marked as 'settlementHeld: false' or has a 'transferId', it means it has been released to the organizer account.
                        // We count 95% of this amount as "Settled" (since 5% is platform fee).
                        else if (t.type === 'collection' && t.status === 'SUCCESS' && (t.settlementHeld === false || t.transferId)) {
                            // Route settlements are typically 95% of the collected amount
                            acc.paid += ((t.amount || 0) * 0.95);
                        }

                        return acc;
                    }, { collected: 0, paid: 0 });

                    return (
                        <View key={group.id} style={{ marginBottom: 15 }}>
                            <Surface elevation={1} style={styles.groupCard}>
                                <View style={styles.groupCardInner}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.groupHeaderText}>{group.name}</Text>
                                        <View style={styles.groupPreview}>
                                            <Text style={styles.previewText}>
                                                Collected: <Text style={{ color: '#2e7d32', fontWeight: 'bold' }}>₹{groupStats.collected.toLocaleString('en-IN')}</Text>
                                            </Text>
                                            <Text style={styles.previewText}>
                                                • Settled: <Text style={{ color: '#1a237e', fontWeight: 'bold' }}>₹{groupStats.paid.toLocaleString('en-IN')}</Text>
                                            </Text>
                                        </View>
                                    </View>
                                    <IconButton
                                        icon={isExpanded ? "chevron-up" : "chevron-down"}
                                        onPress={() => toggleTournament(group.id)}
                                        size={24}
                                    />
                                </View>

                                {isExpanded && (
                                    <View style={styles.expandedContent}>
                                        <Divider style={{ marginBottom: 15 }} />
                                        {group.txns.sort((a, b) => {
                                            if (a.type !== b.type) return a.type === 'collection' ? -1 : 1;
                                            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                                            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                                            return dateB - dateA; // Show newest first within group too
                                        }).map((txn) => (
                                            <TransactionCard key={txn.id} txn={txn} groupName={group.name} />
                                        ))}
                                    </View>
                                )}
                            </Surface>
                        </View>
                    );
                })
            ) : (
                filteredTransactions.map((txn) => (
                    <TransactionCard key={txn.id} txn={txn} />
                ))
            )}
        </ScrollView>
    );
}

const TransactionCard = ({ txn, groupName }) => {
    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        try {
            // Handle Firestore Timestamp or ISO String
            const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SUCCESS': return '#4CAF50';
            case 'FAILED': return '#f44336';
            case 'REVERSED': return '#FF9800';
            case 'PROCESSING':
            case 'PROCESSED': return '#2196F3';
            case 'STARTED': return '#9C27B0';
            default: return '#757575';
        }
    };

    const getSourceLabel = (type) => {
        return type === 'collection' ? 'Player Payment' : 'Organizer Payout';
    };

    return (
        <Card style={styles.card}>
            <Card.Content>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Chip
                            mode="flat"
                            style={[styles.typeChip, {
                                backgroundColor: txn.type === 'collection' ? '#e3f2fd' : '#fff3e0'
                            }]}
                        >
                            {getSourceLabel(txn.type)}
                        </Chip>
                        <Text variant="bodySmall" style={styles.date}>
                            {formatDate(txn.createdAt || txn.webhookReceivedAt || txn.updatedAt)}
                        </Text>
                    </View>
                    <Chip
                        mode="flat"
                        style={[styles.statusChip, { backgroundColor: getStatusColor(txn.status) }]}
                        textStyle={{ color: 'white', fontWeight: 'bold' }}
                    >
                        {txn.status}
                    </Chip>
                </View>

                <Divider style={{ marginVertical: 15 }} />

                <DataTable>
                    {(txn.tournamentName || groupName) && (
                        <DataTable.Row>
                            <DataTable.Cell>Tournament</DataTable.Cell>
                            <DataTable.Cell numeric>
                                <Text style={{ fontWeight: 'bold', color: '#1565c0' }}>{txn.tournamentName || groupName}</Text>
                            </DataTable.Cell>
                        </DataTable.Row>
                    )}

                    {txn.playerName && (
                        <DataTable.Row>
                            <DataTable.Cell>Player</DataTable.Cell>
                            <DataTable.Cell numeric>
                                {txn.playerName}
                            </DataTable.Cell>
                        </DataTable.Row>
                    )}

                    {txn.receiver && (
                        <DataTable.Row>
                            <DataTable.Cell>Organizer</DataTable.Cell>
                            <DataTable.Cell numeric>
                                {txn.receiver.name}
                            </DataTable.Cell>
                        </DataTable.Row>
                    )}

                    <DataTable.Row>
                        <DataTable.Cell>
                            <Text style={{ fontWeight: 'bold' }}>Amount</Text>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                            <Text style={{
                                fontWeight: 'bold',
                                fontSize: 16,
                                color: txn.type === 'collection' ? '#2e7d32' : '#d32f2f'
                            }}>
                                {txn.type === 'collection' ? '+' : '-'}₹{txn.amount?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                            </Text>
                        </DataTable.Cell>
                    </DataTable.Row>

                    <DataTable.Row>
                        <DataTable.Cell>Status</DataTable.Cell>
                        <DataTable.Cell numeric>
                            <Text style={{ color: getStatusColor(txn.status), fontWeight: 'bold' }}>
                                {txn.status}
                                {txn.failureReason ? ` (${txn.failureReason})` : ''}
                            </Text>
                        </DataTable.Cell>
                    </DataTable.Row>

                    {/* Razorpay Payment ID for Refunds */}
                    {txn.razorpayPaymentId && (
                        <DataTable.Row>
                            <DataTable.Cell>
                                <Text style={{ fontSize: 11, color: '#666' }}>Payment ID</Text>
                            </DataTable.Cell>
                            <DataTable.Cell numeric>
                                <Text
                                    style={{ fontSize: 10, fontFamily: 'monospace', color: '#1565c0' }}
                                    selectable={true}
                                >
                                    {txn.razorpayPaymentId}
                                </Text>
                            </DataTable.Cell>
                        </DataTable.Row>
                    )}
                </DataTable>
            </Card.Content>
        </Card>
    );
};

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
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 15,
        gap: 10
    },
    statCard: {
        flex: 1,
        minWidth: 150,
        borderRadius: 12
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 5
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a237e'
    },
    statSubtext: {
        fontSize: 12,
        color: '#999',
        marginTop: 5
    },
    searchbar: {
        marginBottom: 15,
        elevation: 2
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
    typeChip: {
        alignSelf: 'flex-start',
        marginBottom: 5
    },
    date: {
        fontSize: 12,
        color: '#666',
        marginTop: 5
    },
    statusChip: {
        paddingHorizontal: 8
    },
    groupHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a237e',
        marginBottom: 10,
        marginLeft: 5,
        borderLeftWidth: 4,
        borderLeftColor: '#1a237e',
        paddingLeft: 10
    },
    groupCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
    },
    groupCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    groupHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a237e',
        marginBottom: 4
    },
    groupPreview: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewText: {
        fontSize: 12,
        color: '#666',
    },
    expandedContent: {
        paddingHorizontal: 12,
        paddingBottom: 16,
        backgroundColor: '#f8f9fa'
    }
});
