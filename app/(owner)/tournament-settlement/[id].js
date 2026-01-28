import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import {
    Text,
    Card,
    Button,
    Portal,
    Dialog,
    Divider,
    ActivityIndicator,
    Chip,
    Surface,
    ProgressBar,
    Snackbar,
    TextInput
} from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { TransactionService } from '../../../src/services/TransactionService';
import { useAuth } from '../../../src/context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function TournamentSettlementScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [tournament, setTournament] = useState(null);
    const [organizer, setOrganizer] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [linkDialogVisible, setLinkDialogVisible] = useState(false);
    const [accountId, setAccountId] = useState('acc_S6vj0Zpww44Wys'); // Pre-fill with requested ID

    // Transaction State
    const [transactionId, setTransactionId] = useState(null);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [unsubscribe, setUnsubscribe] = useState(null);
    const [settlementHistory, setSettlementHistory] = useState([]);
    const [snackbar, setSnackbar] = useState({ visible: false, message: '', color: '#333' });
    const [syncing, setSyncing] = useState(false);
    const [playerTransactions, setPlayerTransactions] = useState([]);

    // Keep accountId in sync with fetched organizer data
    useEffect(() => {
        if (organizer?.linkedAccountId) {
            setAccountId(organizer.linkedAccountId);
        }
    }, [organizer]);

    const showMessage = (message, color = '#333') => setSnackbar({ visible: true, message, color });

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        try {
            const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) { return 'Invalid Date'; }
    };

    useEffect(() => {
        if (id) {
            fetchData();
        }

        // Cleanup subscription on unmount
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [id]);

    const fetchData = async () => {
        if (!id) {
            Alert.alert('Error', 'Tournament ID is missing');
            return;
        }

        try {
            setLoading(true);

            // Fetch tournament
            const tournamentDoc = await getDoc(doc(db, 'tournaments', id));
            if (!tournamentDoc.exists()) {
                Alert.alert('Error', 'Tournament not found');
                router.back();
                return;
            }

            const tournamentData = { id: tournamentDoc.id, ...tournamentDoc.data() };
            setTournament(tournamentData);

            // Fetch organizer
            if (tournamentData.organizerId) {
                const organizerDoc = await getDoc(doc(db, 'users', tournamentData.organizerId));
                if (organizerDoc.exists()) {
                    setOrganizer(organizerDoc.data());
                }
            }

            // Calculate financials
            const playersQuery = query(
                collection(db, 'tournaments', id, 'players'),
                where('paid', '==', true)
            );
            const playersSnap = await getDocs(playersQuery);

            const totalCollected = playersSnap.size * (tournamentData.entryFee || 0);
            const platformCommission = totalCollected * 0.05;
            const organizerShare = totalCollected - platformCommission;

            setFinancials({
                totalRegistrations: playersSnap.size,
                totalCollected,
                platformCommission,
                organizerShare,
                totalHeldAmount: tournamentData.totalHeldAmount || 0,
                totalReleasedAmount: tournamentData.totalReleasedAmount || 0
            });

            // 🔍 SEARCH FOR EXISTING TRANSACTION
            const txQuery = query(
                collection(db, 'transactions'),
                where('tournamentId', '==', id),
                where('type', '==', 'payout')
            );
            const txSnap = await getDocs(txQuery);
            const history = [];

            if (!txSnap.empty) {
                const docs = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort by creation date descending
                const sortedDocs = docs.sort((a, b) => b.createdAt?.localeCompare(a.createdAt));

                setSettlementHistory(sortedDocs);

                // Set latest as active if it's not success yet
                const latestTx = sortedDocs[0];
                setTransactionId(latestTx.id);

                // Set up listener for this existing transaction
                if (unsubscribe) unsubscribe();
                const unsub = TransactionService.subscribeToTransaction(latestTx.id, (txnData) => {
                    setTransactionStatus(txnData);
                });
                setUnsubscribe(() => unsub);
            }

            // 🔎 FETCH PLAYER TRANSACTIONS
            const pTxQuery = query(
                collection(db, 'transactions'),
                where('tournamentId', '==', id),
                where('type', '==', 'collection')
            );
            const pTxSnap = await getDocs(pTxQuery);
            const pTxList = pTxSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
            setPlayerTransactions(pTxList);

        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load settlement data');
        } finally {
            setLoading(false);
        }
    };

    const handleInitiatePayout = () => {
        if (!organizer || !organizer.bankDetails) {
            Alert.alert('Error', 'Organizer bank details not found');
            return;
        }

        if (tournament.settlementStatus === 'completed') {
            Alert.alert('Already Paid', 'Settlement has already been completed for this tournament');
            return;
        }

        if (financials.totalCollected === 0) {
            Alert.alert('No Funds', 'No payments collected for this tournament');
            return;
        }

        setDialogVisible(true);
    };

    const handleSyncStatus = async () => {
        console.log('🔄 Syncing status for:', transactionId);
        if (!transactionId) {
            Toast.show({
                type: 'info',
                text1: 'ℹ️ No Transaction',
                text2: 'No active transaction to sync',
                visibilityTime: 3000,
            });
            return;
        }

        setProcessing(true);
        Toast.show({
            type: 'info',
            text1: '🔄 Syncing Status...',
            text2: 'Checking with payment gateway',
            visibilityTime: 2000,
        });

        try {
            const result = await TransactionService.syncPayoutStatus(transactionId);
            console.log('📊 Sync Result:', result);

            if (result.status === 'SUCCESS') {
                Toast.show({
                    type: 'success',
                    text1: '✅ Settlement Complete!',
                    text2: 'Funds successfully transferred',
                    visibilityTime: 5000,
                });
                fetchData();
            } else if (result.status === 'REVERSED') {
                Toast.show({
                    type: 'error',
                    text1: '⚠️ Settlement Reversed',
                    text2: 'Funds have been returned',
                    visibilityTime: 5000,
                });
                fetchData();
            } else if (result.status === 'FAILED') {
                Toast.show({
                    type: 'error',
                    text1: '❌ Settlement Failed',
                    text2: 'Please check bank details and retry',
                    visibilityTime: 6000,
                });
                fetchData();
            } else {
                Toast.show({
                    type: 'info',
                    text1: '⏳ Still Processing',
                    text2: `Status: ${result.gatewayStatus || 'Pending'}`,
                    visibilityTime: 4000,
                });
            }
        } catch (error) {
            console.error('❌ Sync Error:', error);
            Toast.show({
                type: 'error',
                text1: '❌ Sync Failed',
                text2: error.message || 'Please try again',
                visibilityTime: 5000,
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleLinkAccount = async () => {
        if (!accountId.startsWith('acc_')) {
            Alert.alert('Invalid ID', 'Razorpay Account ID must start with acc_');
            return;
        }

        if (!tournament?.organizerId) {
            Alert.alert('Error', 'Organizer ID not found for this tournament.');
            return;
        }

        setProcessing(true);
        try {
            console.log('🔗 Linking account:', { organizerId: tournament.organizerId, accountId });
            const result = await TransactionService.linkRouteAccount({
                organizerId: tournament.organizerId,
                linkedAccountId: accountId.trim()
            });

            if (result.success) {
                setLinkDialogVisible(false);
                showMessage('Account linked successfully!', '#2e7d32');
                fetchData();
            }
        } catch (error) {
            console.error('Link account error:', error);
            const errorMsg = error.message || 'Failed to link account';
            Alert.alert('Configuration Error',
                `${errorMsg}\n\nNote: Ensure you have "owner" permissions and the organizer ID is valid.`);
        } finally {
            setProcessing(false);
        }
    };

    const confirmPayout = async () => {
        setDialogVisible(false);
        setProcessing(true);

        try {
            // Clean up old unsub if exists
            if (unsubscribe) unsubscribe();

            // Step 1: Create Transaction Entry
            const result = await TransactionService.createTransaction({
                tournamentId: id,
                organizerId: tournament.organizerId
            });

            const txnId = result.transactionId;
            setTransactionId(txnId);

            // Step 2: Setup Real-time Polling
            let hasAutoSynced = false;
            const unsub = TransactionService.subscribeToTransaction(txnId, (txnData) => {
                console.log('Transaction Status Update:', txnData.status);
                setTransactionStatus(txnData);

                if ((txnData.status === 'SUCCESS' || txnData.status === 'PROCESSED') && !hasAutoSynced) {
                    hasAutoSynced = true;
                    setProcessing(false);

                    console.log("🔄 Triggering proactive sync...");
                    TransactionService.syncPayoutStatus(txnId).catch(err => {
                        console.warn("Sync error (non-critical):", err);
                    });

                    Toast.show({
                        type: 'success',
                        text1: '✅ Settlement Successful!',
                        text2: `₹${Math.round(financials.organizerShare).toLocaleString('en-IN')} transferred`,
                        visibilityTime: 6000,
                    });

                    fetchData();
                } else if (txnData.status === 'FAILED') {
                    setProcessing(false);
                    Toast.show({
                        type: 'error',
                        text1: '❌ Settlement Failed',
                        text2: txnData.failureReason || 'Please check bank details',
                        visibilityTime: 6000,
                    });
                } else if (txnData.status === 'REVERSED') {
                    setProcessing(false);
                    Toast.show({
                        type: 'error',
                        text1: '⚠️ Settlement Reversed',
                        text2: 'Funds have been returned to account',
                        visibilityTime: 5000,
                    });
                }
            });

            setUnsubscribe(() => unsub);

            // Step 3: Process Payout
            await TransactionService.processPayout(txnId);

        } catch (error) {
            console.error('Payout error:', error);
            setProcessing(false);
            Alert.alert('Error', error.message || 'Failed to initiate payout');
        }
    };

    const releaseRouteSettlement = async () => {
        setProcessing(true);
        try {
            const result = await TransactionService.releaseSettlement(id);
            if (result.success) {
                Alert.alert('Success', result.message || 'Settlements released successfully');
                fetchData();
            } else {
                Alert.alert('Partial Success', result.message || 'Some transfers failed to release');
            }
        } catch (error) {
            console.error('Release error:', error);
            Alert.alert('Error', error.message || 'Failed to release settlements');
        } finally {
            setProcessing(true);
            setTimeout(() => setProcessing(false), 2000); // Prevent double-tap
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 10 }}>Loading settlement data...</Text>
            </View>
        );
    }

    if (!tournament || !financials) {
        return (
            <View style={styles.centered}>
                <Text>No data available</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="headlineSmall" style={styles.tournamentName}>
                        {tournament.name}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: '#666', marginTop: 5 }}>
                        {tournament.gameName}
                    </Text>
                    {tournament.settlementStatus === 'completed' && (
                        <Chip
                            icon="check-circle"
                            mode="flat"
                            style={styles.paidChip}
                        >
                            Settlement Completed
                        </Chip>
                    )}
                </Card.Content>
            </Card>

            {/* Financial Summary */}
            <Surface style={styles.card} elevation={2}>
                <Text variant="titleLarge" style={styles.sectionTitle}>
                    Financial Summary
                </Text>

                <View style={styles.row}>
                    <Text style={styles.label}>Total Registrations:</Text>
                    <Text style={styles.value}>{financials.totalRegistrations}</Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Entry Fee per Player:</Text>
                    <Text style={styles.value}>₹{tournament.entryFee?.toLocaleString('en-IN')}</Text>
                </View>

                <Divider style={{ marginVertical: 15 }} />

                <View style={styles.row}>
                    <Text style={styles.label}>Total Collected:</Text>
                    <Text style={[styles.value, styles.amount]}>
                        ₹{financials.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Platform Commission (5%):</Text>
                    <Text style={[styles.value, styles.commission]}>
                        -₹{financials.platformCommission.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </Text>
                </View>

                <Divider style={{ marginVertical: 15 }} />

                <View style={styles.row}>
                    <Text style={[styles.label, styles.bold]}>Organizer Share (95%):</Text>
                    <Text style={[styles.value, styles.total, { color: '#1a237e' }]}>
                        ₹{financials.organizerShare.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </Text>
                </View>

                {financials.totalHeldAmount > 0 && (
                    <View style={[styles.row, { marginTop: 10, padding: 10, backgroundColor: '#e8f5e9', borderRadius: 8 }]}>
                        <MaterialCommunityIcons name="clock-outline" size={18} color="#2e7d32" />
                        <Text style={[styles.label, { color: '#2e7d32', marginLeft: 5, fontWeight: 'bold' }]}>Held in Route:</Text>
                        <Text style={[styles.value, { color: '#2e7d32', fontWeight: 'bold' }]}>
                            ₹{financials.totalHeldAmount.toLocaleString('en-IN')}
                        </Text>
                    </View>
                )}
            </Surface>

            {/* Player Registration History */}
            {playerTransactions.length > 0 && (
                <View style={styles.section}>
                    <Text variant="titleLarge" style={styles.sectionTitle}>
                        Player Registration History
                    </Text>
                    {playerTransactions.map((tx) => (
                        <Card key={tx.id} style={styles.historyCard}>
                            <Card.Content style={styles.historyContent}>
                                <View style={styles.historyHeader}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold' }}>{tx.playerName || 'Anonymous Player'}</Text>
                                        <Text style={{ fontSize: 11, color: '#666' }}>
                                            {formatDate(tx.createdAt || tx.webhookReceivedAt || tx.updatedAt)}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontWeight: 'bold', color: '#2e7d32' }}>₹{tx.amount}</Text>
                                        <Chip
                                            compact
                                            textStyle={{ fontSize: 10 }}
                                            style={{
                                                backgroundColor: tx.status === 'SUCCESS' ? '#e8f5e9' : '#ffebee',
                                                height: 20
                                            }}
                                        >
                                            {tx.status} {tx.settlementHeld ? '(Held)' : ''}
                                        </Chip>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    ))}
                </View>
            )}

            {/* Organizer Details */}
            {organizer && (
                <Surface style={styles.card} elevation={2}>
                    <Text variant="titleLarge" style={styles.sectionTitle}>
                        Organizer Details
                    </Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Organizer ID:</Text>
                        <Text style={[styles.value, { fontSize: 12, color: '#888' }]}>{organizer.uid || tournament.organizerId}</Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Name:</Text>
                        <Text style={styles.value}>{organizer.name}</Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Email:</Text>
                        <Text style={styles.value}>{organizer.email}</Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Phone:</Text>
                        <Text style={styles.value}>{organizer.phone}</Text>
                    </View>

                    <Divider style={{ marginVertical: 15 }} />

                    <Text variant="titleMedium" style={{ marginBottom: 10, fontWeight: '600' }}>
                        Bank Account Details
                    </Text>

                    {organizer.bankDetails ? (
                        <>
                            <View style={styles.row}>
                                <Text style={styles.label}>Bank Name:</Text>
                                <Text style={styles.value}>{organizer.bankDetails.bankName}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Account Number:</Text>
                                <Text style={styles.value}>{organizer.bankDetails.accountNumber}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>IFSC Code:</Text>
                                <Text style={styles.value}>{organizer.bankDetails.ifsc}</Text>
                            </View>
                        </>
                    ) : (
                        <Text style={{ color: '#d32f2f' }}>Bank details not available</Text>
                    )}

                    <Divider style={{ marginVertical: 15 }} />

                    <Text variant="titleMedium" style={{ marginBottom: 10, fontWeight: '600', color: '#1a237e' }}>
                        Razorpay Route Configuration
                    </Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Linked Account ID:</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: organizer.linkedAccountId ? '#2e7d32' : '#d32f2f' }]}>
                            {organizer.linkedAccountId || 'Not Linked'}
                        </Text>
                    </View>

                    <Button
                        mode="outlined"
                        onPress={() => {
                            if (organizer.linkedAccountId) setAccountId(organizer.linkedAccountId);
                            setLinkDialogVisible(true);
                        }}
                        style={{ marginTop: 10 }}
                        icon="link-variant"
                    >
                        {organizer.linkedAccountId ? 'Update Route Account' : 'Link Route Account'}
                    </Button>
                </Surface>
            )}

            {/* Action Button */}
            <View style={styles.buttonContainer}>
                {tournament.settlementStatus === 'completed' ? (
                    <Card style={[styles.completedBox, { marginHorizontal: 16 }]}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <MaterialCommunityIcons name="check-decagram" size={28} color="#2e7d32" />
                                <Text style={[styles.completedText, { marginLeft: 10 }]}>
                                    Settlement Completed
                                </Text>
                            </View>
                            <Divider style={{ marginVertical: 10 }} />
                            <View style={styles.row}>
                                <Text style={styles.label}>Settled On:</Text>
                                <Text style={styles.value}>{new Date(tournament.settlementDate).toLocaleDateString('en-IN')}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Amount Paid:</Text>
                                <Text style={[styles.value, { color: '#2e7d32', fontWeight: 'bold' }]}>₹{tournament.settlementAmount?.toLocaleString('en-IN')}</Text>
                            </View>
                        </Card.Content>
                    </Card>
                ) : (
                    <>
                        {/* Transaction Status Display */}
                        {transactionStatus && (
                            <Card style={styles.statusCard}>
                                <Card.Content>
                                    <View style={styles.statusHeader}>
                                        <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                                            Transaction Status
                                        </Text>
                                        <Chip
                                            mode="flat"
                                            style={[
                                                styles.statusChip,
                                                {
                                                    backgroundColor:
                                                        transactionStatus.status === 'SUCCESS' ? '#4CAF50' :
                                                            transactionStatus.status === 'FAILED' ? '#f44336' :
                                                                transactionStatus.status === 'REVERSED' ? '#FF9800' :
                                                                    '#2196F3'
                                                }
                                            ]}
                                        >
                                            {transactionStatus.status}
                                        </Chip>
                                    </View>

                                    {(transactionStatus.status === 'STARTED' || transactionStatus.status === 'PROCESSING') && (
                                        <>
                                            <ProgressBar indeterminate color="#1a237e" style={{ marginTop: 15 }} />
                                            <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
                                                {transactionStatus.status === 'STARTED'
                                                    ? 'Initializing transfer...'
                                                    : 'Processing payout via Razorpay...'}
                                            </Text>

                                            {transactionStatus.status === 'PROCESSING' && (
                                                <Button
                                                    mode="outlined"
                                                    onPress={handleSyncStatus}
                                                    loading={processing}
                                                    style={{ marginTop: 15 }}
                                                    icon="sync"
                                                >
                                                    Refresh Status
                                                </Button>
                                            )}
                                        </>
                                    )}

                                    <Divider style={{ marginVertical: 15 }} />

                                    <View style={styles.row}>
                                        <Text style={styles.label}>Transaction ID:</Text>
                                        <Text style={[styles.value, { fontSize: 11, fontFamily: 'monospace' }]}>
                                            {transactionId}
                                        </Text>
                                    </View>

                                    {transactionStatus.gatewayRefId && (
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Razorpay Payout ID:</Text>
                                            <Text style={[styles.value, { fontSize: 11, fontFamily: 'monospace' }]}>
                                                {transactionStatus.gatewayRefId}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.row}>
                                        <Text style={styles.label}>Amount:</Text>
                                        <Text style={[styles.value, { fontWeight: 'bold', color: '#2e7d32' }]}>
                                            ₹{transactionStatus.amount?.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                        </Text>
                                    </View>

                                    <View style={styles.row}>
                                        <Text style={styles.label}>Initiated At:</Text>
                                        <Text style={styles.value}>
                                            {new Date(transactionStatus.createdAt).toLocaleString('en-IN')}
                                        </Text>
                                    </View>

                                    {transactionStatus.webhookReceivedAt && (
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Confirmed At:</Text>
                                            <Text style={styles.value}>
                                                {new Date(transactionStatus.webhookReceivedAt).toLocaleString('en-IN')}
                                            </Text>
                                        </View>
                                    )}

                                    {(transactionStatus.status === 'FAILED' || transactionStatus.status === 'REVERSED') && transactionStatus.failureReason && (
                                        <View style={[styles.row, { marginTop: 10, backgroundColor: transactionStatus.status === 'REVERSED' ? '#fff3e0' : '#ffebee', padding: 10, borderRadius: 8 }]}>
                                            <MaterialCommunityIcons name="alert-circle" size={16} color={transactionStatus.status === 'REVERSED' ? '#FF9800' : '#d32f2f'} />
                                            <Text style={[styles.value, { color: transactionStatus.status === 'REVERSED' ? '#E65100' : '#d32f2f', textAlign: 'left', fontWeight: 'bold' }]}>
                                                Reason: {transactionStatus.failureReason}
                                            </Text>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        )}

                        {/* Conditional Button based on Route vs Payout */}
                        {tournament.settlementStatus === 'held' || (playerTransactions.some(tx => tx.settlementHeld)) ? (
                            <Button
                                mode="contained"
                                onPress={releaseRouteSettlement}
                                disabled={processing || !organizer?.linkedAccountId}
                                loading={processing}
                                style={[styles.button, { backgroundColor: '#1a237e' }]}
                                contentStyle={{ paddingVertical: 8 }}
                                icon="bank-transfer-out"
                            >
                                Release Route Settlements (95/5)
                            </Button>
                        ) : (
                            <Button
                                mode="contained"
                                onPress={handleInitiatePayout}
                                disabled={processing || !organizer?.bankDetails || (transactionStatus && !['FAILED', 'REVERSED'].includes(transactionStatus.status))}
                                loading={processing && !transactionId}
                                style={[
                                    styles.button,
                                    (transactionStatus?.status === 'FAILED' || transactionStatus?.status === 'REVERSED') && { backgroundColor: transactionStatus?.status === 'REVERSED' ? '#FF9800' : '#d32f2f' }
                                ]}
                                contentStyle={{ paddingVertical: 8 }}
                            >
                                {processing && !transactionId ? 'Processing Transfer...' :
                                    (transactionStatus?.status === 'FAILED' || transactionStatus?.status === 'REVERSED') ? 'Retry Transfer' :
                                        transactionStatus ? 'Transfer In Progress' :
                                            'Manual Transfer to Organizer'}
                            </Button>
                        )}

                        {(transactionStatus?.status === 'STARTED' || transactionStatus?.status === 'PROCESSING') && (
                            <View style={{ marginTop: 10 }}>
                                <Button
                                    mode="outlined"
                                    onPress={handleSyncStatus}
                                    loading={processing && !!transactionId}
                                    style={styles.button}
                                    icon="sync"
                                >
                                    Check Final Status
                                </Button>
                                <Text style={{ textAlign: 'center', color: '#666', fontSize: 12, marginTop: 10 }}>
                                    ⏱️ Waiting for payment gateway confirmation...
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* Settlement History */}
            {settlementHistory.length > 0 && (
                <View style={[styles.section, { marginBottom: 30 }]}>
                    <Text variant="titleLarge" style={styles.sectionTitle}>
                        Settlement History
                    </Text>
                    {settlementHistory.map((item, index) => (
                        <Card key={item.id} style={styles.historyCard}>
                            <Card.Content style={styles.historyContent}>
                                <View style={styles.historyHeader}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>₹{item.amount?.toLocaleString('en-IN')}</Text>
                                        <Text style={{ fontSize: 12, color: '#666' }}>{new Date(item.createdAt).toLocaleString('en-IN')}</Text>
                                    </View>
                                    <Chip
                                        compact
                                        style={[
                                            styles.historyChip,
                                            {
                                                backgroundColor:
                                                    item.status === 'SUCCESS' ? '#e8f5e9' :
                                                        item.status === 'FAILED' ? '#ffebee' :
                                                            item.status === 'REVERSED' ? '#fff3e0' :
                                                                '#e3f2fd'
                                            }
                                        ]}
                                        textStyle={{
                                            color:
                                                item.status === 'SUCCESS' ? '#2e7d32' :
                                                    item.status === 'FAILED' ? '#d32f2f' :
                                                        item.status === 'REVERSED' ? '#E65100' :
                                                            '#1976d2',
                                            fontSize: 11
                                        }}
                                    >
                                        {item.status}
                                    </Chip>
                                </View>
                                <Text style={{ fontSize: 11, color: '#999', marginTop: 5, fontFamily: 'monospace' }}>
                                    ID: {item.id}
                                </Text>
                            </Card.Content>
                        </Card>
                    ))}
                </View>
            )}

            {/* Link Account Dialog */}
            <Portal>
                <Dialog visible={linkDialogVisible} onDismiss={() => setLinkDialogVisible(false)}>
                    <Dialog.Title>Link Razorpay Route Account</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={{ marginBottom: 15 }}>
                            Enter the Razorpay Route Account ID (acc_...) for this organizer.
                            This enables automated 95/5 payment splitting.
                        </Text>
                        <TextInput
                            label="Account ID"
                            value={accountId}
                            onChangeText={setAccountId}
                            placeholder="acc_..."
                            mode="outlined"
                            autoCapitalize="none"
                        />
                        <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
                            Example: acc_S6vj0Zpww44Wys
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setLinkDialogVisible(false)}>Cancel</Button>
                        <Button
                            onPress={handleLinkAccount}
                            mode="contained"
                            loading={processing}
                            disabled={!accountId || !accountId.startsWith('acc_')}
                        >
                            Link Account
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Confirmation Dialog */}
            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>Confirm Settlement</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyLarge" style={{ marginBottom: 15 }}>
                            Transfer ₹{Math.round(financials?.organizerShare || 0).toLocaleString('en-IN')} to {organizer?.name}?
                        </Text>

                        <Surface style={{ backgroundColor: '#f5f5f5', padding: 15, borderRadius: 8 }}>
                            <Text style={{ fontWeight: '600', marginBottom: 5 }}>Bank Details:</Text>
                            <Text>Bank: {organizer?.bankDetails?.bankName}</Text>
                            <Text>Account: {organizer?.bankDetails?.accountNumber}</Text>
                            <Text>IFSC: {organizer?.bankDetails?.ifsc}</Text>
                        </Surface>

                        <Text style={{ marginTop: 15, color: '#666', fontSize: 12 }}>
                            An invoice will be automatically sent to the organizer's email.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
                        <Button onPress={confirmPayout} mode="contained">
                            Confirm Transfer
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Snackbar
                visible={snackbar.visible}
                onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
                duration={4000}
                style={{ backgroundColor: snackbar.color }}
                action={{
                    label: 'OK',
                    onPress: () => setSnackbar({ ...snackbar, visible: false }),
                }}
            >
                {snackbar.message}
            </Snackbar>
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
        alignItems: 'center'
    },
    card: {
        marginBottom: 15,
        padding: 20,
        borderRadius: 12
    },
    tournamentName: {
        fontWeight: 'bold',
        color: '#1a237e'
    },
    paidChip: {
        backgroundColor: '#4CAF50',
        marginTop: 10,
        alignSelf: 'flex-start'
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 15,
        color: '#1a237e'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8
    },
    label: {
        color: '#666',
        fontSize: 15
    },
    value: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'right',
        flex: 1,
        marginLeft: 10
    },
    amount: {
        fontSize: 16,
        color: '#333'
    },
    commission: {
        color: '#d32f2f'
    },
    total: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2e7d32'
    },
    bold: {
        fontWeight: '600'
    },
    buttonContainer: {
        marginVertical: 20
    },
    button: {
        borderRadius: 8
    },
    completedBox: {
        backgroundColor: '#e8f5e9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c8e6c9',
        elevation: 0
    },
    completedText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2e7d32'
    },
    statusCard: {
        marginBottom: 15,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#2196F3'
    },
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    statusChip: {
        paddingHorizontal: 8
    },
    // History Styles
    section: {
        paddingHorizontal: 16,
        paddingTop: 10
    },
    historyCard: {
        marginBottom: 10,
        borderRadius: 8,
        elevation: 1,
        backgroundColor: '#fff'
    },
    historyContent: {
        paddingVertical: 12,
        paddingHorizontal: 16
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    historyChip: {
        height: 24,
        alignItems: 'center',
        justifyContent: 'center'
    }
});
