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
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';

export default function FinancialsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statements, setStatements] = useState([]);
    const [filter, setFilter] = useState('all'); // all, settlement, commission

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            // Query financial statements
            // Note: Removed orderBy to avoid requiring a composite index
            // We'll sort in memory instead
            const q = query(
                collection(db, 'financial_statements'),
                where('organizerId', '==', user.uid)
            );

            const unsubscribe = onSnapshot(q,
                (snapshot) => {
                    const data = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    // Sort by generatedAt in memory (newest first)
                    data.sort((a, b) => {
                        const dateA = a.generatedAt ? new Date(a.generatedAt) : new Date(0);
                        const dateB = b.generatedAt ? new Date(b.generatedAt) : new Date(0);
                        return dateB - dateA;
                    });

                    setStatements(data);
                    setLoading(false);
                    setRefreshing(false);
                },
                (error) => {
                    console.error('Error fetching statements:', error);
                    setStatements([]);
                    setLoading(false);
                    setRefreshing(false);
                }
            );

            return () => unsubscribe();
        } catch (error) {
            console.error('Error setting up financials query:', error);
            setStatements([]);
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
    };

    const filteredStatements = statements.filter(stmt => {
        if (filter === 'all') return true;
        return stmt.type === filter;
    });

    // Calculate totals
    const totalCollected = statements.reduce((sum, stmt) => sum + (stmt.totalCollected || 0), 0);
    const totalCommission = statements.reduce((sum, stmt) => sum + (stmt.platformCommission || 0), 0);
    const totalReceived = statements.reduce((sum, stmt) => sum + (stmt.organizerShare || 0), 0);

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
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3F51B5']} />
            }
        >
            {/* Header */}
            <Text variant="headlineSmall" style={styles.header}>
                Financial Statements
            </Text>

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
                <Card style={styles.summaryCard}>
                    <Card.Content>
                        <Text style={styles.summaryLabel}>Total Tournaments</Text>
                        <Text style={styles.summaryValue}>
                            {statements.length}
                        </Text>
                    </Card.Content>
                </Card>

                <Card style={styles.summaryCard}>
                    <Card.Content>
                        <Text style={styles.summaryLabel}>Total Collected</Text>
                        <Text style={[styles.summaryValue, { color: '#1a237e' }]}>
                            ₹{Math.round(totalCollected).toLocaleString('en-IN')}
                        </Text>
                    </Card.Content>
                </Card>

                <Card style={styles.summaryCard}>
                    <Card.Content>
                        <Text style={styles.summaryLabel}>Total Received</Text>
                        <Text style={[styles.summaryValue, { color: '#2e7d32' }]}>
                            ₹{Math.round(totalReceived).toLocaleString('en-IN')}
                        </Text>
                    </Card.Content>
                </Card>
            </View>

            {/* Filter - Only show if there are statements */}
            {statements.length > 0 && (
                <SegmentedButtons
                    value={filter}
                    onValueChange={setFilter}
                    buttons={[
                        { value: 'all', label: 'All' },
                        { value: 'settlement', label: 'Settlements' }
                    ]}
                    style={styles.filter}
                />
            )}

            {/* Statements List */}
            {filteredStatements.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={{ color: '#666', marginTop: 20 }}>
                        No financial statements yet
                    </Text>
                </View>
            ) : (
                filteredStatements.map((statement) => (
                    <Card key={statement.id} style={styles.card}>
                        <Card.Content>
                            {/* Header */}
                            <View style={styles.cardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleMedium" style={styles.tournamentName}>
                                        {statement.tournamentName || 'Unknown Tournament'}
                                    </Text>
                                    <Text style={styles.date}>
                                        {statement.settlementDate ?
                                            new Date(statement.settlementDate).toLocaleDateString('en-IN', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            }) : 'Date not available'
                                        }
                                    </Text>
                                </View>
                                <Chip mode="flat" style={styles.typeChip}>
                                    {statement.type ? statement.type.toUpperCase() : 'SETTLEMENT'}
                                </Chip>
                            </View>

                            <Divider style={{ marginVertical: 15 }} />

                            {/* Financial Details */}
                            <DataTable>
                                <DataTable.Row>
                                    <DataTable.Cell>Total Collected</DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        ₹{Math.round(statement.totalCollected || 0).toLocaleString('en-IN')}
                                    </DataTable.Cell>
                                </DataTable.Row>

                                <DataTable.Row>
                                    <DataTable.Cell>Registrations</DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        {statement.totalRegistrations || 0} players
                                    </DataTable.Cell>
                                </DataTable.Row>

                                <DataTable.Row>
                                    <DataTable.Cell>Entry Fee</DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        ₹{(statement.entryFeePerPlayer || 0).toLocaleString('en-IN')}
                                    </DataTable.Cell>
                                </DataTable.Row>

                                <Divider />

                                <DataTable.Row>
                                    <DataTable.Cell>
                                        <Text style={{ fontWeight: '600' }}>
                                            Platform Commission ({statement.platformCommissionPercent || 0}%)
                                        </Text>
                                    </DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        <Text style={{ color: '#d32f2f', fontWeight: '600' }}>
                                            -₹{Math.round(statement.platformCommission || 0).toLocaleString('en-IN')}
                                        </Text>
                                    </DataTable.Cell>
                                </DataTable.Row>

                                <DataTable.Row>
                                    <DataTable.Cell>
                                        <Text style={{ fontWeight: 'bold' }}>
                                            Your Share ({statement.organizerSharePercent || 0}%)
                                        </Text>
                                    </DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        <Text style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 16 }}>
                                            ₹{Math.round(statement.organizerShare || 0).toLocaleString('en-IN')}
                                        </Text>
                                    </DataTable.Cell>
                                </DataTable.Row>
                            </DataTable>

                            <Divider style={{ marginVertical: 15 }} />

                            {/* Additional Info */}
                            <View style={styles.infoSection}>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Invoice Number:</Text>
                                    <Text style={styles.value}>{statement.invoiceNumber || 'N/A'}</Text>
                                </View>

                                <View style={styles.row}>
                                    <Text style={styles.label}>Transfer ID:</Text>
                                    <Text style={[styles.value, { fontSize: 12 }]}>
                                        {statement.transferId || 'N/A'}
                                    </Text>
                                </View>

                                {statement.transferStatus && (
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Status:</Text>
                                        <Chip
                                            icon="check-circle"
                                            mode="flat"
                                            style={{ backgroundColor: '#4CAF50' }}
                                        >
                                            {statement.transferStatus.toUpperCase()}
                                        </Chip>
                                    </View>
                                )}
                            </View>
                        </Card.Content>
                    </Card>
                ))
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
