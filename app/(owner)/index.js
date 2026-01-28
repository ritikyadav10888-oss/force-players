import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Image, Pressable, RefreshControl, Alert, Platform } from 'react-native';
import { Button, Title, Text, Surface, useTheme, Avatar, Searchbar, IconButton, Divider, SegmentedButtons, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../src/config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateSettlement, recordSettlement } from '../../src/utils/settlementHelpers';
import { RazorpayService } from '../../src/services/RazorpayService';
import Toast from 'react-native-toast-message';

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
    const [pendingRevenue, setPendingRevenue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Financials
    const [activeTab, setActiveTab] = useState('overview');
    const [completedTournaments, setCompletedTournaments] = useState([]);
    const [needsEndingTournaments, setNeedsEndingTournaments] = useState([]);
    const [settledTournaments, setSettledTournaments] = useState([]);
    const [statements, setStatements] = useState([]);
    const [financialLoading, setFinancialLoading] = useState(false);

    // Helper function to determine tournament status
    const getTournamentStatus = (tournament) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Respect manual completion
        if (tournament.status === 'completed') return 'completed';

        // Parse start date (DD-MM-YYYY format)
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            const [day, month, year] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        };

        const startDate = parseDate(tournament.startDate);
        const endDate = parseDate(tournament.endDate);

        if (!startDate) return 'upcoming';

        if (endDate && today > endDate) {
            return 'completed';
        } else if (today >= startDate && (!endDate || today <= endDate)) {
            return 'ongoing';
        }
        return 'upcoming';
    };

    const handleEndTournament = (tournament) => {
        const title = "End Tournament?";
        const message = `Are you sure you want to mark "${tournament.name}" as completed? This will enable fund release processing.`;

        const onConfirm = async () => {
            try {
                const tRef = doc(db, 'tournaments', tournament.id);
                await updateDoc(tRef, { status: 'completed' });

                Toast.show({
                    type: 'success',
                    text1: '✅ Tournament Ended',
                    text2: `${tournament.name} is now ready for settlement`,
                    visibilityTime: 4000,
                });

                fetchData();
            } catch (error) {
                console.error(error);
                Toast.show({
                    type: 'error',
                    text1: '❌ Failed to End Tournament',
                    text2: error.message || 'Please try again',
                    visibilityTime: 5000,
                });
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
                    Toast.show({
                        type: 'info',
                        text1: '⏳ Processing Settlement...',
                        text2: 'Please wait while we release the funds',
                        visibilityTime: 3000,
                    });

                    const initiateOrganizerPayout = httpsCallable(functions, 'initiateOrganizerPayout');

                    const result = await initiateOrganizerPayout({
                        tournamentId: tournament.id,
                        organizerId: tournament.organizerId,
                        amount: settlement.organizerShare,
                        notes: `Settlement for ${tournament.name}`
                    });

                    Toast.show({
                        type: 'success',
                        text1: '💰 Funds Released Successfully!',
                        text2: `₹${settlement.organizerShare} transferred`,
                        visibilityTime: 5000,
                    });

                    fetchData();
                } catch (err) {
                    Toast.show({
                        type: 'error',
                        text1: '❌ Settlement Failed',
                        text2: err.message || 'Please try again or contact support',
                        visibilityTime: 6000,
                    });
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

            // Filter Active Tournaments & Recently Completed
            const activeList = [];
            const needsClosing = [];

            allTournamentsSnap.docs.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                const computed = getTournamentStatus(data);

                if (data.status === 'completed') {
                    // Manually closed, handled below
                } else if (computed === 'completed') {
                    // Ended by date but not manually closed
                    needsClosing.push(data);
                } else {
                    activeList.push(data);
                }
            });

            // Fetch player counts for lists
            const [activeWithCounts, needsClosingWithCounts] = await Promise.all([
                Promise.all(activeList.map(async (t) => {
                    const pColl = collection(db, 'tournaments', t.id, 'players');
                    const snap = await getDocs(pColl).catch(() => ({ size: 0 }));
                    return { ...t, playerCount: snap.size || 0 };
                })),
                Promise.all(needsClosing.map(async (t) => {
                    const pColl = collection(db, 'tournaments', t.id, 'players');
                    const snap = await getDocs(pColl).catch(() => ({ size: 0 }));
                    return { ...t, playerCount: snap.size || 0 };
                }))
            ]);

            setActiveTournaments(activeWithCounts);
            setNeedsEndingTournaments(needsClosingWithCounts);

            // Count Players - Fetch from master_players
            const masterPlayersColl = collection(db, 'master_players');
            const playersSnap = await getDocs(masterPlayersColl).catch(err => {
                console.warn("Error reading master players:", err);
                return { size: 0 };
            });
            setPlayerCount(playersSnap.size);

            // Count Players & Revenue across all tournaments
            let totalPlayersCount = 0;
            let paidPlayers = 0;
            let pendingPlayersCount = 0;
            let calcRevenue = 0;
            let calcPendingRevenue = 0;

            if (allTournamentsSnap.docs.length > 0) {
                await Promise.all(allTournamentsSnap.docs.map(async (tDoc) => {
                    const tData = tDoc.data();
                    const fee = parseInt(tData.entryFee) || 0;

                    // Priority 1: Use pre-calculated totals if they exist
                    if (tData.totalCollections !== undefined && tData.playerCount !== undefined) {
                        totalPlayersCount += tData.playerCount || 0;
                        calcRevenue += tData.totalCollections || 0;

                        // We still need paid/pending breakdown if not stored
                        // For now, if we have totalCollections and playerCount, we can estimate or do a quick check
                        // Better: If they exist, we assume the tournament doc is the source of truth
                    } else {
                        // Fallback: Manual count (Only for older data or if missing)
                        const pColl = collection(db, 'tournaments', tDoc.id, 'players');
                        const pSnap = await getDocs(pColl).catch(() => ({ docs: [], size: 0 }));

                        totalPlayersCount += pSnap.size;
                        pSnap.docs.forEach(pd => {
                            const pData = pd.data();
                            if (pData.paid === true) {
                                paidPlayers++;
                                calcRevenue += (pData.paidAmount || fee);
                            } else {
                                pendingPlayersCount++;
                                calcPendingRevenue += fee;
                            }
                        });
                    }
                }));
            }

            // If we didn't do a manual count for some, these might be off, but totalRevenue and totalPlayers are prioritized
            setPaidCount(paidPlayers || allTournamentsSnap.docs.reduce((sum, d) => sum + (d.data().paidPlayerCount || 0), 0));
            setPendingCount(pendingPlayersCount);
            setTotalRevenue(calcRevenue);
            setPlayerCount(totalPlayersCount); // Stats card for total participants
            setPendingRevenue(calcPendingRevenue);

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

                if (data.settlementStatus === 'completed') {
                    settledList.push(data);
                } else {
                    pendingSettlements.push(data);
                }
            }));

            // Sync: Add any 'settled' tournaments to the statements list if they are missing
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

            // 3. Fetch Financial Statements
            if (userData?.uid) {
                const q = query(
                    collection(db, 'financial_statements'),
                    where('ownerId', '==', 'force_owner'),
                    orderBy('generatedAt', 'desc')
                );
                const sSnap = await getDocs(q).catch(err => {
                    console.warn("Error fetching financial statements:", err);
                    return { docs: [] };
                });
                setStatements(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        } catch (error) {
            console.warn("Error fetching organizers or statements:", error);
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

        Toast.show({
            type: 'success',
            text1: '🔄 Dashboard Refreshed',
            text2: 'All data is up to date',
            visibilityTime: 2000,
        });
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

                    {/* Revenue Section */}
                    <Title style={styles.sectionTitle}>Revenue Stats</Title>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                        {/* Paid Revenue Card */}
                        <Surface style={[styles.revenueCard, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]} elevation={2}>
                            <View style={[styles.revenueIconBox, { backgroundColor: '#2E7D32' }]}>
                                <MaterialCommunityIcons name="cash-check" size={20} color="white" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.revenueMiniLabel}>ACTUAL PAID</Text>
                                <Title style={[styles.revenueValueSmall, { color: '#2E7D32' }]}>₹{totalRevenue.toLocaleString()}</Title>
                                <Text style={styles.revenueSubtext}>{paidCount} Paid Players</Text>
                            </View>
                        </Surface>

                        {/* Pending Revenue Card */}
                        <Surface style={[styles.revenueCard, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]} elevation={2}>
                            <View style={[styles.revenueIconBox, { backgroundColor: '#E65100' }]}>
                                <MaterialCommunityIcons name="cash-clock" size={20} color="white" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.revenueMiniLabel}>PENDING</Text>
                                <Title style={[styles.revenueValueSmall, { color: '#E65100' }]}>₹{pendingRevenue.toLocaleString()}</Title>
                                <Text style={styles.revenueSubtext}>{pendingCount} Awaiting</Text>
                            </View>
                        </Surface>
                    </View>

                    {/* Needs Closure Section */}
                    {needsEndingTournaments.length > 0 && (
                        <View style={{ marginBottom: 25 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                <View style={{ width: 4, height: 20, backgroundColor: '#EF5350', borderRadius: 2, marginRight: 10 }} />
                                <Title style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' }}>Ended - Needs Closure</Title>
                                <Badge style={{ marginLeft: 10, backgroundColor: '#EF5350' }}>{needsEndingTournaments.length}</Badge>
                            </View>
                            {needsEndingTournaments.map((t) => (
                                <Surface key={t.id} style={[styles.organizerCard, { borderLeftWidth: 4, borderLeftColor: '#EF5350' }]} elevation={2}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t.name}</Text>
                                            <Text style={{ color: 'gray', fontSize: 12 }}>{t.gameName} • {t.entryType}</Text>
                                        </View>
                                        <Button
                                            mode="contained"
                                            buttonColor="#EF5350"
                                            onPress={() => handleEndTournament(t)}
                                            labelStyle={{ fontSize: 10, fontWeight: 'bold' }}
                                            style={{ borderRadius: 8 }}
                                            compact
                                        >
                                            CLOSE & SETTLE
                                        </Button>
                                    </View>
                                    <View style={{ flexDirection: 'row', marginTop: 10, gap: 15 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <MaterialCommunityIcons name="account-group" size={14} color="#666" />
                                            <Text style={{ fontSize: 12, color: '#666', marginLeft: 4 }}>{t.playerCount || 0} Players</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
                                            <Text style={{ fontSize: 12, color: '#666', marginLeft: 4 }}>Ended on {t.endDate}</Text>
                                        </View>
                                    </View>
                                </Surface>
                            ))}
                        </View>
                    )}

                    {/* Recently Completed Section */}
                    {completedTournaments.length > 0 && (
                        <>
                            <Title style={[styles.sectionTitle, { color: '#E65100' }]}>
                                <MaterialCommunityIcons name="clock-alert-outline" /> Ready for Settlement
                            </Title>
                            {completedTournaments.map((t) => (
                                <Surface key={t.id} style={[styles.organizerCard, { borderLeftWidth: 4, borderLeftColor: '#E65100' }]} elevation={2}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t.name}</Text>
                                            <Text style={{ color: 'gray', fontSize: 12 }}>{t.gameName} • Ended</Text>
                                        </View>
                                        <Button
                                            mode="contained"
                                            onPress={() => setActiveTab('financials')}
                                            compact
                                            buttonColor="#E65100"
                                            style={{ borderRadius: 8 }}
                                        >
                                            Release ₹
                                        </Button>
                                    </View>
                                </Surface>
                            ))}
                            <Divider style={{ marginVertical: 20 }} />
                        </>
                    )}

                    <Title style={styles.sectionTitle}>Active Tournaments</Title>
                    {activeTournaments.length === 0 ? (
                        <View style={[styles.emptyState, { marginBottom: 30 }]}>
                            <Text style={{ color: 'gray' }}>No active tournaments.</Text>
                        </View>
                    ) : (
                        activeTournaments.map((t) => {
                            // Allow Owner to end tournament anytime
                            const canEnd = true;

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
                                            <View style={{ gap: 5, marginTop: 4 }}>
                                                <Pressable onPress={() => router.push(`/(owner)/tournament-players/${t.id}`)}>
                                                    <Text style={{ fontSize: 13, color: '#1565C0', fontWeight: 'bold', textDecorationLine: 'underline' }}>
                                                        <MaterialCommunityIcons name="account-group" size={14} /> {t.playerCount || 0} Players (View)
                                                    </Text>
                                                </Pressable>
                                                <Pressable onPress={() => router.push(`/(owner)/tournament-details/${t.id}`)}>
                                                    <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: 'bold', textDecorationLine: 'underline' }}>
                                                        <MaterialCommunityIcons name="information-outline" size={14} /> Details
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                        <Button
                                            mode="contained"
                                            compact
                                            color="red"
                                            buttonColor={theme.colors.error}
                                            icon="stop-circle-outline"
                                            onPress={() => handleEndTournament(t)}
                                        >
                                            End Tournament
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
                    <View style={{ height: 120 }} />
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3F51B5']} />}
                >
                    {/* Financial Summary */}
                    <Title style={styles.sectionTitle}>Financial Summary</Title>
                    <View style={styles.summaryGrid}>
                        <Surface style={styles.summaryBox} elevation={2}>
                            <Text style={styles.summaryLabel}>Total Collected</Text>
                            <Text style={[styles.summaryValueSmall, { color: '#1a237e' }]}>
                                ₹{Math.round(statements.reduce((sum, s) => sum + (s.totalCollected || 0), 0)).toLocaleString('en-IN')}
                            </Text>
                        </Surface>
                        <Surface style={styles.summaryBox} elevation={2}>
                            <Text style={styles.summaryLabel}>Commission (5%)</Text>
                            <Text style={[styles.summaryValueSmall, { color: '#1a237e' }]}>
                                ₹{Math.round(statements.reduce((sum, s) => sum + (s.platformCommission || 0), 0)).toLocaleString('en-IN')}
                            </Text>
                        </Surface>
                        <Surface style={styles.summaryBox} elevation={2}>
                            <Text style={styles.summaryLabel}>Paid to Org</Text>
                            <Text style={[styles.summaryValueSmall, { color: '#2e7d32' }]}>
                                ₹{Math.round(statements.reduce((sum, s) => sum + (s.organizerShare || 0), 0)).toLocaleString('en-IN')}
                            </Text>
                        </Surface>
                    </View>

                    <Title style={[styles.sectionTitle, { marginTop: 20 }]}>Pending Payouts</Title>
                    {completedTournaments.length === 0 ? (
                        <View style={[styles.emptyState, { marginBottom: 20 }]}>
                            <MaterialCommunityIcons name="check-circle-outline" size={40} color="#4CAF50" />
                            <Text style={{ color: 'gray', marginTop: 5 }}>All pending payouts cleared.</Text>
                        </View>
                    ) : (
                        completedTournaments.map((t) => (
                            <Surface key={t.id} style={styles.organizerCard} elevation={1}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{t.name}</Text>
                                        <Text style={{ color: 'gray', fontSize: 12 }}>{t.gameName}</Text>
                                    </View>
                                    <Chip icon="account-group" compact style={{ backgroundColor: '#E3F2FD' }}>{t.totalPlayers || 0} Players</Chip>
                                </View>
                                <Divider />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                                    <View>
                                        <Text style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Revenue</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>₹{t.totalCollections || 0}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Platform (5%)</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a237e' }}>₹{Math.floor((t.totalCollections || 0) * 0.05)}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Organizer (95%)</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32' }}>₹{Math.floor((t.totalCollections || 0) * 0.95)}</Text>
                                    </View>
                                </View>
                                <Button
                                    mode="contained"
                                    style={{ marginTop: 20, borderRadius: 12 }}
                                    onPress={() => router.push(`/(owner)/tournament-settlement/${t.id}`)}
                                    icon="cash-fast"
                                >
                                    Review & Release
                                </Button>
                            </Surface>
                        ))
                    )}

                    <Title style={[styles.sectionTitle, { marginTop: 30 }]}>Settlement History</Title>
                    {(() => {
                        // Create a unified list of settled records
                        // 1. Start with actual financial statements
                        const list = [...statements];

                        // 2. Add tournaments that are marked 'settled' but don't have a statement record yet
                        settledTournaments.forEach(t => {
                            const hasStatement = statements.some(s => s.tournamentId === t.id);
                            if (!hasStatement) {
                                list.push({
                                    id: `temp-${t.id}`,
                                    tournamentId: t.id,
                                    tournamentName: t.name,
                                    settlementDate: t.settlementDate || new Date().toISOString(),
                                    organizerName: "Processing...",
                                    organizerShare: t.settlementAmount || (t.totalCollections * 0.95),
                                    platformCommission: (t.totalCollections * 0.05),
                                    invoiceNumber: "SYNCING",
                                    transferId: "Pending Confirmation",
                                    isSyncing: true
                                });
                            }
                        });

                        if (list.length === 0) {
                            return (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="history" size={40} color="#ccc" />
                                    <Text style={{ color: 'gray', marginTop: 5 }}>No settlement history yet.</Text>
                                </View>
                            );
                        }

                        return list.map((s) => (
                            <Surface key={s.id} style={[styles.organizerCard, { borderLeftWidth: 4, borderLeftColor: s.isSyncing ? '#FF9800' : '#4CAF50' }]} elevation={1}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1a1a1a' }}>{s.tournamentName}</Text>
                                        <Text style={{ color: 'gray', fontSize: 12 }}>
                                            {new Date(s.settlementDate).toLocaleDateString()} • {s.organizerName}
                                        </Text>
                                    </View>
                                    <Chip
                                        icon={s.isSyncing ? "clock-outline" : "check-decagram"}
                                        compact
                                        style={{ backgroundColor: s.isSyncing ? '#FFF3E0' : '#E8F5E9' }}
                                        textStyle={{ color: s.isSyncing ? '#E65100' : '#2E7D32', fontSize: 10 }}
                                    >
                                        {s.isSyncing ? 'SYNCING' : 'SETTLED'}
                                    </Chip>
                                </View>
                                <Divider style={{ marginVertical: 10 }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ fontSize: 11, color: '#666' }}>Amount Paid</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: s.isSyncing ? '#666' : '#2E7D32' }}>₹{s.organizerShare?.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 11, color: '#666' }}>Commission</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a237e' }}>₹{s.platformCommission?.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</Text>
                                    </View>
                                </View>
                                <View style={{ marginTop: 12, backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 10, color: '#666' }}>INV: {s.invoiceNumber}</Text>
                                    <Text style={{ fontSize: 10, color: '#666' }}>TRF: {s.transferId ? (s.transferId.length > 15 ? s.transferId.substring(0, 15) + '...' : s.transferId) : 'N/A'}</Text>
                                </View>
                            </Surface>
                        ));
                    })()}
                    <View style={{ height: 120 }} />
                </ScrollView>
            )}
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
    // New Revenue Styling
    revenueCard: {
        flex: 1,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        gap: 12
    },
    revenueIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    revenueMiniLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: 'gray',
        letterSpacing: 0.5,
        marginBottom: 2
    },
    revenueValueSmall: {
        fontSize: 18,
        fontWeight: 'bold',
        lineHeight: 22
    },
    revenueSubtext: {
        fontSize: 9,
        color: '#666',
        marginTop: 2
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20
    },
    summaryBox: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    summaryValueSmall: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 4
    },
    summaryLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    }
});
// End of file
