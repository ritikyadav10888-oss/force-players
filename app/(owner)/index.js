import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Image, Pressable, RefreshControl, Alert, Platform } from 'react-native';
import { Button, Title, Text, Surface, useTheme, Avatar, Searchbar, FAB, IconButton, Divider, SegmentedButtons, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, getCountFromServer, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateSettlement, recordSettlement } from '../../src/utils/settlementHelpers';
import { RazorpayService } from '../../src/services/RazorpayService';

export default function OwnerDashboard() {
    const router = useRouter();
    const { logout, userData } = useAuth();
    const theme = useTheme();

    const [organizers, setOrganizers] = useState([]);
    const [activeTournaments, setActiveTournaments] = useState([]);
    const [tournamentCount, setTournamentCount] = useState(0);
    const [playerCount, setPlayerCount] = useState(0);
    const [paidCount, setPaidCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Financials
    const [activeTab, setActiveTab] = useState('overview');
    const [completedTournaments, setCompletedTournaments] = useState([]);
    const [settledTournaments, setSettledTournaments] = useState([]);

    const handleEndTournament = (tournament) => {
        const title = "End Tournament?";
        const message = `Are you sure you want to mark "${tournament.name}" as completed? This will enable fund release processing.`;

        const onConfirm = async () => {
            try {
                const tRef = doc(db, 'tournaments', tournament.id);
                await updateDoc(tRef, { status: 'completed' });
                // Platform-specific success message
                if (Platform.OS === 'web') alert("Tournament ended. You can now release funds in the Financials tab.");
                else Alert.alert("Success", "Tournament ended. You can now release funds in the Financials tab.");
                fetchData();
            } catch (error) {
                console.error(error);
                if (Platform.OS === 'web') alert("Failed to end tournament.");
                else Alert.alert("Error", "Failed to end tournament.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                onConfirm();
            }
        } else {
            Alert.alert(title, message, [
                { text: "Cancel", style: "cancel" },
                { text: "End Tournament", onPress: onConfirm }
            ]);
        }
    };

    const handleReleaseFunds = async (tournament) => {
        try {
            // 1. Get Calculation
            const settlement = await calculateSettlement(tournament.id);

            // 2. Get Organizer Payment ID
            const orgRef = doc(db, 'users', tournament.organizerId);
            const orgSnap = await getDoc(orgRef);
            if (!orgSnap.exists()) { Alert.alert("Error", "Organizer not found"); return; }

            const connectedId = orgSnap.data().paymentDetails?.connectedAccountId;
            if (!connectedId) {
                Alert.alert("Error", "Organizer has not linked a payment account (Razorpay Route ID). Please configure it in details.");
                return;
            }

            const title = "Confirm Payout";
            const message = `Release ₹${settlement.organizerShare} to Organizer?\nPlatform Fee: ₹${settlement.platformFee} (5%)`;

            const onConfirm = async () => {
                try {
                    const transferId = await RazorpayService.initiateTransfer(settlement.organizerShare, connectedId);
                    await recordSettlement(tournament.id, {
                        ...settlement,
                        transferId
                    }, tournament.organizerId);

                    if (Platform.OS === 'web') alert("Funds released successfully.");
                    else Alert.alert("Success", "Funds released successfully.");

                    fetchData();
                } catch (err) {
                    if (Platform.OS === 'web') alert(`Payout Failed: ${err.message}`);
                    else Alert.alert("Payout Failed", err.message);
                }
            };

            if (Platform.OS === 'web') {
                if (window.confirm(`${title}\n\n${message}`)) {
                    onConfirm();
                }
            } else {
                Alert.alert(title, message, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Release Funds", onPress: onConfirm }
                ]);
            }

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Calculation failed.");
        }
    };

    const fetchData = async () => {
        // 1. Tournament Counts & Revenue & Players
        try {
            const tourneyColl = collection(db, 'tournaments');
            const usersColl = collection(db, 'users');

            // Count Tournaments - using getDocs to safely avoid aggregation issues
            const allTournamentsSnap = await getDocs(tourneyColl).catch(err => {
                console.warn("Error reading tournaments:", err);
                return { docs: [], size: 0 };
            });
            setTournamentCount(allTournamentsSnap.size);

            // Filter Active Tournaments (not completed) & Fetch Player Counts
            const activeList = await Promise.all(allTournamentsSnap.docs.map(async (doc) => {
                const data = doc.data();
                if (data.status === 'completed') return null;

                let count = 0;
                try {
                    const pColl = collection(db, 'tournaments', doc.id, 'players');
                    // Optimization: Use getDocs instead of aggregation if getCount is failing
                    const snap = await getDocs(pColl).catch(() => ({ size: 0 }));
                    count = snap.size || 0;
                } catch (e) {
                    console.warn("Count error for " + doc.id, e);
                }

                return { id: doc.id, ...data, playerCount: count };
            }));
            setActiveTournaments(activeList.filter(t => t !== null));

            // Count Players - Fetch from master_players
            const masterPlayersColl = collection(db, 'master_players');
            const playersSnap = await getDocs(masterPlayersColl).catch(err => {
                console.warn("Error reading master players:", err);
                return { size: 0 };
            });
            setPlayerCount(playersSnap.size);

            // Count Players & Revenue across all tournaments
            let totalPlayers = 0;
            let paidPlayers = 0;
            let pendingPlayers = 0;
            let calcRevenue = 0;

            if (allTournamentsSnap.docs.length > 0) {
                await Promise.all(allTournamentsSnap.docs.map(async (tDoc) => {
                    const tData = tDoc.data();
                    const fee = parseInt(tData.entryFee) || 0;

                    const pColl = collection(db, 'tournaments', tDoc.id, 'players');
                    const pSnap = await getDocs(pColl).catch(() => ({ docs: [], size: 0 }));

                    totalPlayers += pSnap.size;

                    pSnap.docs.forEach(pd => {
                        const pData = pd.data();
                        if (pData.paid === true) {
                            paidPlayers++;
                            calcRevenue += fee;
                        } else {
                            pendingPlayers++;
                        }
                    });
                }));
            }
            setPlayerCount(playersSnap.size);
            setPaidCount(paidPlayers);
            setPendingCount(pendingPlayers);
            setTotalRevenue(calcRevenue);

        } catch (error) {
            console.warn("Error in dashboard stats:", error);
        }

        // 2. Fetch Organizers
        try {
            const organizersQuery = query(collection(db, 'users'), where('role', '==', 'organizer'));
            const organizersSnapshot = await getDocs(organizersQuery).catch(err => {
                console.warn("Error fetching organizers:", err);
                return { docs: [] };
            });

            const list = [];
            const tourneyColl = collection(db, 'tournaments');

            // Fetch Pending Settlements
            const completedQ = query(tourneyColl, where('status', '==', 'completed'));
            const cSnap = await getDocs(completedQ);

            const pendingSettlements = [];
            const settledList = [];

            await Promise.all(cSnap.docs.map(async (docSnap) => {
                const data = { id: docSnap.id, ...docSnap.data() };

                // Calculate/Ensure financial stats are present
                if (data.status === 'completed' && (!data.totalCollections || !data.totalPlayers)) {
                    try {
                        const pColl = collection(db, 'tournaments', docSnap.id, 'players');
                        const pSnap = await getDocs(pColl);

                        let revenue = 0;
                        const fee = parseInt(data.entryFee) || 0;
                        pSnap.docs.forEach(p => {
                            if (p.data().paid === true) {
                                revenue += fee;
                            }
                        });

                        // We update the local object for UI display
                        data.totalCollections = revenue;
                        data.totalPlayers = pSnap.size;

                    } catch (calcErr) {
                        console.warn("Failed to calc stats for completed tourney", calcErr);
                    }
                }

                if (data.settlement?.status === 'settled') {
                    settledList.push(data);
                } else {
                    pendingSettlements.push(data);
                }
            }));

            setCompletedTournaments(pendingSettlements);
            setSettledTournaments(settledList);

            for (const doc of organizersSnapshot.docs) {
                const orgData = doc.data();
                // Get count for this specific organizer - using getDocs for safety
                const assignedQuery = query(tourneyColl, where('organizerId', '==', doc.id));
                const snap = await getDocs(assignedQuery).catch(() => ({ size: 0 }));

                list.push({
                    id: doc.id,
                    ...orgData,
                    assignedTournaments: snap.size,
                    isActive: snap.size > 0
                });
            }
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setOrganizers(list);
        } catch (error) {
            console.warn("Error fetching organizers list:", error);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, []);

    const filteredOrganizers = organizers.filter(org =>
        (org.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (org.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F5F7FA' }]}>
            {/* Header */}
            {/* Header */}
            {/* Header */}
            <LinearGradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Surface style={styles.headerAvatar} elevation={8}>
                            <Image
                                source={require('../../assets/logo.png')}
                                style={{ width: 54, height: 54, borderRadius: 27 }}
                            />
                        </Surface>
                        <View>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 1, fontWeight: '600', marginBottom: 2 }}>WELCOME BACK</Text>
                            <Title style={{ fontSize: 26, fontWeight: 'bold', color: 'white' }}>{userData?.name || 'Owner'}</Title>
                        </View>
                    </View>
                    <IconButton
                        icon="logout"
                        iconColor="white"
                        size={24}
                        onPress={() => logout()}
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                    />
                </View>
            </LinearGradient>

            <View style={{
                paddingHorizontal: 20,
                marginBottom: 24,
                marginTop: -30,
                width: '100%',
                maxWidth: 800,
                alignSelf: 'center',
            }}>
                <Surface elevation={4} style={{ borderRadius: 20 }}>
                    <SegmentedButtons
                        value={activeTab}
                        onValueChange={setActiveTab}
                        density="medium"
                        buttons={[
                            { value: 'overview', label: 'Dashboard', icon: 'view-dashboard', style: styles.segmentBtn },
                            { value: 'financials', label: 'Financials', icon: 'finance', style: styles.segmentBtn },
                        ]}
                        style={styles.segmentContainer}
                    />
                </Surface>
            </View>

            {activeTab === 'overview' ? (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Status Grid */}
                    <View style={styles.statusGrid}>
                        <Surface style={styles.statusCard} elevation={3}>
                            <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                                <MaterialCommunityIcons name="account-group" size={26} color="#1565C0" />
                            </View>
                            <Title style={styles.statusValue}>{organizers.length}</Title>
                            <Text style={styles.statusLabel}>Organizers</Text>
                        </Surface>

                        <Surface style={styles.statusCard} elevation={3}>
                            <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                                <MaterialCommunityIcons name="trophy-variant" size={26} color="#E65100" />
                            </View>
                            <Title style={styles.statusValue}>{tournamentCount}</Title>
                            <Text style={styles.statusLabel}>Events</Text>
                        </Surface>

                        <Surface style={styles.statusCard} elevation={3}>
                            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                                <MaterialCommunityIcons name="cash-check" size={26} color="#2E7D32" />
                            </View>
                            <Title style={[styles.statusValue, { color: '#2E7D32' }]}>{paidCount}</Title>
                            <Text style={styles.statusLabel}>Paid</Text>
                        </Surface>

                        <Surface style={styles.statusCard} elevation={3}>
                            <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
                                <MaterialCommunityIcons name="cash-clock" size={26} color="#C62828" />
                            </View>
                            <Title style={[styles.statusValue, { color: '#C62828' }]}>{pendingCount}</Title>
                            <Text style={styles.statusLabel}>Pending</Text>
                        </Surface>

                        <Surface style={styles.statusCard} elevation={3}>
                            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                                <MaterialCommunityIcons name="run" size={26} color="#2E7D32" />
                            </View>
                            <Title style={styles.statusValue}>{playerCount}</Title>
                            <Text style={styles.statusLabel}>Players</Text>
                        </Surface>
                    </View>

                    {/* Revenue Card */}
                    <Surface style={styles.revenueParams} elevation={6}>
                        <LinearGradient
                            colors={['#11998e', '#38ef7d']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.revenueCardGradient}
                        >
                            <View style={styles.revenueLeft}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <MaterialCommunityIcons name="star-four-points" size={16} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
                                    <Text style={styles.revenueLabel}>TOTAL REVENUE</Text>
                                </View>
                                <Title style={styles.revenueValue}>₹ {totalRevenue.toLocaleString()}</Title>
                            </View>
                            <View style={styles.revenueIconContainer}>
                                <MaterialCommunityIcons name="chart-line-variant" size={48} color="white" style={{ opacity: 0.9 }} />
                            </View>
                        </LinearGradient>
                    </Surface>

                    <Title style={styles.sectionTitle}>Active Tournaments</Title>
                    {activeTournaments.length === 0 ? (
                        <View style={[styles.emptyState, { marginBottom: 30 }]}>
                            <Text style={{ color: 'gray' }}>No active tournaments.</Text>
                        </View>
                    ) : (
                        activeTournaments.map((t) => {
                            // Date Check
                            let canEnd = false;
                            if (t.startDate) {
                                const start = new Date(t.startDate);
                                const today = new Date();
                                // Reset time parts to ensure fair date-only comparison
                                start.setHours(0, 0, 0, 0);
                                today.setHours(0, 0, 0, 0);
                                canEnd = today >= start;
                            }

                            return (
                                <Surface key={t.id} style={styles.organizerCard} elevation={1}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t.name}</Text>
                                            <Text style={{ color: 'gray', fontSize: 12 }}>{t.gameName} • {t.entryType}</Text>
                                        </View>
                                        <Chip icon="calendar-clock" compact style={{ backgroundColor: '#E3F2FD' }}>{t.startDate || 'Running'}</Chip>
                                    </View>
                                    <Divider style={{ marginVertical: 10 }} />
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View>
                                            <Text style={{ fontSize: 12, color: 'gray' }}>
                                                <MaterialCommunityIcons name="currency-inr" /> Entry: {t.entryFee}
                                            </Text>
                                            <Pressable onPress={() => router.push(`/(owner)/tournament-players/${t.id}`)}>
                                                <Text style={{ fontSize: 13, color: '#1565C0', marginTop: 4, fontWeight: 'bold', textDecorationLine: 'underline' }}>
                                                    <MaterialCommunityIcons name="account-group" size={14} /> {t.playerCount || 0} Players (View)
                                                </Text>
                                            </Pressable>
                                        </View>
                                        <Button
                                            mode="contained"
                                            compact
                                            color="red"
                                            buttonColor={canEnd ? theme.colors.error : '#ccc'}
                                            icon={canEnd ? "stop-circle-outline" : "clock-outline"}
                                            disabled={!canEnd}
                                            onPress={() => handleEndTournament(t)}
                                        >
                                            {canEnd ? "End Tournament" : "In Progress"}
                                        </Button>
                                    </View>
                                </Surface>
                            );
                        })
                    )}

                    <Title style={styles.sectionTitle}>Manage Organizers</Title>
                    <Searchbar
                        placeholder="Search name or email"
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                        style={styles.searchBar}
                        elevation={0}
                    />

                    {loading ? (
                        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
                    ) : filteredOrganizers.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={{ color: 'gray' }}>No organizers found.</Text>
                        </View>
                    ) : (
                        filteredOrganizers.map((org) => (
                            <Surface key={org.id} style={styles.organizerCard} elevation={1}>
                                <View style={styles.orgHeader}>
                                    {org.profilePic ? (
                                        <Avatar.Image size={40} source={{ uri: org.profilePic }} style={{ backgroundColor: theme.colors.primaryContainer }} />
                                    ) : (
                                        <Avatar.Text size={40} label={org.name?.[0] || 'O'} style={{ backgroundColor: theme.colors.primaryContainer }} />
                                    )}
                                    <View style={{ marginLeft: 12, flex: 1 }}>
                                        <Text style={styles.orgName}>{org.name}</Text>
                                        <Text style={styles.orgEmail}>{org.email}</Text>
                                    </View>
                                    {org.isActive && (
                                        <View style={styles.activeBadge}>
                                            <Text style={styles.activeText}>ACTIVE</Text>
                                        </View>
                                    )}
                                </View>
                                <Divider style={{ marginVertical: 10 }} />
                                <View style={styles.orgFooter}>
                                    <Text style={{ fontSize: 12, color: 'gray' }}>
                                        <MaterialCommunityIcons name="trophy-outline" size={12} /> {org.assignedTournaments} Tournaments
                                    </Text>

                                    <Button
                                        mode="contained-tonal"
                                        compact
                                        icon="eye"
                                        onPress={() => router.push({ pathname: '/(owner)/organizer-details', params: { id: org.id } })}
                                        style={{ marginLeft: 10 }}
                                    >
                                        Details
                                    </Button>
                                </View>
                            </Surface>
                        ))
                    )}
                    <View style={{ height: 80 }} />
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <Title style={styles.sectionTitle}>Pending Payouts</Title>
                    {completedTournaments.length === 0 ? (
                        <View style={[styles.emptyState, { marginBottom: 20 }]}>
                            <MaterialCommunityIcons name="check-circle-outline" size={40} color="#4CAF50" />
                            <Text style={{ color: 'gray', marginTop: 5 }}>All pending payouts cleared.</Text>
                        </View>
                    ) : (
                        completedTournaments.map((t) => (
                            <Surface key={t.id} style={styles.organizerCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t.name}</Text>
                                        <Text style={{ color: 'gray', fontSize: 12 }}>{t.gameName}</Text>
                                    </View>
                                    <Chip icon="account-group" compact>{t.totalPlayers || 0} Players</Chip>
                                </View>
                                <Divider />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                                    <View>
                                        <Text style={{ fontSize: 10, color: 'gray', textTransform: 'uppercase' }}>Total Revenue</Text>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>₹{t.totalCollections || 0}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, color: 'gray', textTransform: 'uppercase' }}>Platform (5%)</Text>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.secondary }}>₹{Math.floor((t.totalCollections || 0) * 0.05)}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, color: 'gray', textTransform: 'uppercase' }}>Organizer (95%)</Text>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.primary }}>₹{Math.floor((t.totalCollections || 0) * 0.95)}</Text>
                                    </View>
                                </View>
                                <Button mode="contained" style={{ marginTop: 20 }} onPress={() => handleReleaseFunds(t)}>Release Funds</Button>
                            </Surface>
                        ))
                    )}

                    <Title style={[styles.sectionTitle, { marginTop: 30 }]}>Settlement Statement</Title>
                    {settledTournaments.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={{ color: 'gray' }}>No settlement history yet.</Text>
                        </View>
                    ) : (
                        settledTournaments.map((t) => (
                            <Surface key={t.id} style={[styles.organizerCard, { borderColor: '#4CAF50', borderLeftWidth: 4 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t.name}</Text>
                                        <Text style={{ color: 'gray', fontSize: 12 }}>Completed & Paid</Text>
                                    </View>
                                    <Chip icon="check-decagram" compact style={{ backgroundColor: '#E8F5E9' }} textStyle={{ color: '#2E7D32' }}>SETTLED</Chip>
                                </View>
                                <View style={{ marginVertical: 10, backgroundColor: '#FAFAFA', padding: 10, borderRadius: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#666' }}>Settled Amount:</Text>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2E7D32' }}>₹{t.settlement?.organizerShare}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                        <Text style={{ fontSize: 12, color: '#666' }}>Platform Fee (5%):</Text>
                                        <Text style={{ fontSize: 12 }}>₹{t.settlement?.platformFee}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                        <Text style={{ fontSize: 12, color: '#666' }}>Settle Date:</Text>
                                        <Text style={{ fontSize: 12 }}>{t.settlement?.settledAt ? new Date(t.settlement.settledAt).toLocaleDateString() : 'N/A'}</Text>
                                    </View>
                                </View>
                                {t.settlement?.transactionId && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 10, color: '#999', flex: 1 }}>TXN ID: {t.settlement.transactionId}</Text>
                                        <MaterialCommunityIcons name="content-copy" size={14} color="#999" />
                                    </View>
                                )}
                            </Surface>
                        ))
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}

            {/* Create Tournament FAB - actually for Organizers in this context or general actions */}
            <FAB
                icon="plus"
                style={styles.fab}
                label="New Organizer"
                onPress={() => router.push('/(owner)/create-organizer')}
                visible={activeTab === 'overview'} // Only show on overview/organizer tab
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 40,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        marginBottom: 10,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
        elevation: 10,
        shadowColor: '#1a237e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12
    },
    headerAvatar: {
        borderRadius: 27,
        marginRight: 16,
        elevation: 8,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    content: {
        padding: 20,
        paddingTop: 10,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%'
    },
    segmentContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        borderColor: 'transparent'
    },
    segmentBtn: {
        borderRadius: 20,
        borderWidth: 0,
        paddingVertical: 4
    },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24
    },
    statusCard: {
        flex: 1,
        minWidth: 100,
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    statusValue: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
    statusLabel: { fontSize: 13, color: '#666', fontWeight: '600', letterSpacing: 0.5 },
    revenueParams: {
        borderRadius: 28,
        marginBottom: 30,
        overflow: 'hidden',
        shadowColor: '#11998e',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12
    },
    revenueCardGradient: {
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 120
    },
    revenueLeft: { flex: 1 },
    revenueLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
    revenueValue: { color: 'white', fontSize: 36, fontWeight: '800', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    revenueIconContainer: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        padding: 12
    },
    sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, marginLeft: 4, letterSpacing: 0.5, color: '#1a1a1a' },
    searchBar: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        height: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5
    },
    organizerCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#f8f9fa'
    },
    orgHeader: { flexDirection: 'row', alignItems: 'center' },
    orgName: { fontSize: 17, fontWeight: '700', color: '#333' },
    orgEmail: { fontSize: 13, color: '#777', marginTop: 2 },
    activeBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#C8E6C9' },
    activeText: { fontSize: 11, color: '#2E7D32', fontWeight: '800', letterSpacing: 0.5 },
    orgFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
    emptyState: { alignItems: 'center', marginTop: 40, opacity: 0.6 },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
// End of file
