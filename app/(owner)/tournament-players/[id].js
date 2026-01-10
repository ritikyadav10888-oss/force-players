import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl, Share, Image, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Title, Text, Card, Avatar, Surface, useTheme, Divider, Searchbar, IconButton, ActivityIndicator, Chip, Modal, Portal, List } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TournamentPlayersScreen() {
    const { id } = useLocalSearchParams();
    const theme = useTheme();
    const router = useRouter();
    const [players, setPlayers] = useState([]);
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        try {
            // Fetch Tournament Info
            const tDoc = await getDoc(doc(db, 'tournaments', id));
            if (tDoc.exists()) setTournament(tDoc.data());

            // Fetch Players into a list
            const q = query(collection(db, 'tournaments', id, 'players'));
            const querySnapshot = await getDocs(q);
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by registration time
            list.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
            setPlayers(list);
        } catch (error) {
            console.error("Error fetching player list:", error);
            Alert.alert("Error", "Could not fetch player list.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, []);

    const filteredPlayers = players.filter(p =>
        (p.playerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.teamName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.registrationNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.paymentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.orderId || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayData = React.useMemo(() => {
        const teams = {};
        const solo = [];

        filteredPlayers.forEach(p => {
            const tName = (p.teamName || 'Solo').trim();
            // Check if it's a "real" team (not Solo/empty and user explicitly entered it)
            // Assuming "Solo" is the default for individual.
            if (tName.toLowerCase() !== 'solo' && tName !== '') {
                if (!teams[tName]) teams[tName] = [];
                teams[tName].push(p);
            } else {
                solo.push(p);
            }
        });

        const result = [];
        // Add Teams
        Object.keys(teams).sort().forEach(name => {
            result.push({ type: 'team', name, members: teams[name], id: `team-${name}` });
        });
        // Add Solo Players
        solo.forEach(p => result.push({ type: 'player', data: p, id: p.id }));

        return result;
    }, [filteredPlayers]);


    const handleExport = async () => {
        if (players.length === 0) {
            Alert.alert('Export', 'No player data to export.');
            return;
        }

        try {
            // CSV Header
            let csvContent = "Registration ID,Team Name,Player Name,Email,Phone,Age,Address,Aadhar No,DOB,Emergency Contact,Gender,Photo,Aadhar Photo,Paid Status\n";

            // CSV Rows
            players.forEach(p => {
                const clean = (val) => (val || '-').toString().replace(/,/g, ' ').replace(/\n/g, ' ').trim();

                const regId = clean(p.registrationNumber);
                const team = clean(p.teamName || 'Solo');
                const name = clean(p.playerName);
                const email = clean(p.email);
                const phone = clean(p.phone);
                const age = clean(p.data?.personal?.age);
                const address = clean(p.data?.personal?.address);
                const aadhar = clean(p.data?.personal?.adharId);
                const dob = clean(p.data?.personal?.dob);
                const emergency = clean(p.data?.personal?.emergencyPhone);
                const gender = clean(p.data?.personal?.gender);
                const photo = clean(p.data?.personal?.playerImgUrl);
                const aadharPhoto = clean(p.data?.personal?.adharImgUrl);
                const paid = p.paid ? "Paid" : "Pending";

                csvContent += `${regId},${team},${name},${email},${phone},${age},${address},${aadhar},${dob},${emergency},${gender},${photo},${aadharPhoto},${paid}\n`;
            });

            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `${tournament?.name || 'Tournament'}_Player_List.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                await Share.share({
                    message: csvContent,
                    title: `${tournament?.name || 'Tournament'} - Player List.csv`
                });
            }
        } catch (error) {
            console.error("Export error:", error);
            Alert.alert('Error', 'Failed to export data');
        }
    };

    const [selectedPlayer, setSelectedPlayer] = useState(null);

    const renderItem = ({ item }) => {
        if (item.type === 'team') {
            return (
                <Card style={[styles.playerCard, { overflow: 'hidden' }]} mode="elevated" elevation={1}>
                    <List.Accordion
                        title={item.name}
                        titleStyle={{ fontWeight: 'bold', fontSize: 16 }}
                        description={`${item.members.length} Players`}
                        style={{ backgroundColor: 'white' }}
                        left={props => <Avatar.Text size={40} label={item.name[0]?.toUpperCase()} style={{ backgroundColor: '#E3F2FD' }} labelStyle={{ color: '#1565C0' }} />}
                    >
                        {item.members.map((member, index) => (
                            <View key={member.id}>
                                <Divider />
                                <List.Item
                                    title={member.playerName}
                                    description={`Reg: ${member.registrationNumber} • ${member.phone}`}
                                    left={props => <List.Icon {...props} icon="account" />}
                                    right={props => (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: member.paid ? '#2E7D32' : '#C62828', marginRight: 5 }}>
                                                {member.paid ? 'PAID' : 'PENDING'}
                                            </Text>
                                            <IconButton icon="chevron-right" size={20} />
                                        </View>
                                    )}
                                    onPress={() => setSelectedPlayer(member)}
                                    style={{ paddingLeft: 10 }}
                                />
                            </View>
                        ))}
                    </List.Accordion>
                </Card>
            );
        }

        // Render Individual Player
        const player = item.data;
        return (
            <TouchableOpacity onPress={() => setSelectedPlayer(player)} activeOpacity={0.8}>
                <Card style={styles.playerCard} mode="outlined">
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.playerInfo}>
                            <Avatar.Text
                                size={40}
                                label={player.playerName?.[0]?.toUpperCase() || 'P'}
                                style={{ backgroundColor: theme.colors.primaryContainer }}
                                labelStyle={{ color: theme.colors.primary }}
                            />
                            <View style={styles.nameContainer}>
                                <Text style={styles.playerName}>{player.playerName}</Text>
                                <Text style={styles.teamName}>Solo Player</Text>
                            </View>
                            <IconButton
                                icon="phone"
                                mode="contained"
                                containerColor={theme.colors.primary}
                                iconColor="white"
                                size={20}
                                onPress={() => Alert.alert('Contact', player.phone)}
                            />
                        </View>
                        <Divider style={styles.divider} />
                        <View style={styles.bottomRow}>
                            <View>
                                <Text style={styles.label}>Reg ID</Text>
                                <Text style={styles.value}>{player.registrationNumber}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.label}>Status</Text>
                                <Text style={[styles.value, { color: player.paid ? '#4CAF50' : '#d32f2f' }]}>
                                    {player.paid ? 'PAID' : 'PENDING'}
                                </Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Surface style={styles.header} elevation={2}>
                <View style={styles.headerTop}>
                    <IconButton icon="arrow-left" onPress={() => router.back()} />
                    <Title style={styles.title} numberOfLines={1}>
                        {tournament?.name || 'Players'}
                    </Title>
                    <IconButton icon="file-export" onPress={handleExport} />
                </View>
                <Searchbar
                    placeholder="Search players or teams..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    elevation={0}
                />
                <View style={styles.statsRow}>
                    <Chip icon="account-group" compact style={styles.chip}>{players.length} Registered</Chip>
                    <Chip icon="shield-account" compact style={styles.chip}>{displayData.filter(i => i.type === 'team').length} Teams</Chip>
                </View>
            </Surface>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" /></View>
            ) : (
                <FlatList
                    data={displayData}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={{ color: 'gray', marginTop: 50 }}>No registered players yet.</Text>
                        </View>
                    }
                />
            )}

            {/* Player Details Modal */}
            <Portal>
                <Modal visible={!!selectedPlayer} onDismiss={() => setSelectedPlayer(null)} contentContainerStyle={styles.modalContent}>
                    {selectedPlayer && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Title>{selectedPlayer.playerName}</Title>
                                <IconButton icon="close" onPress={() => setSelectedPlayer(null)} />
                            </View>

                            {/* Images - Using data from 'data' field created during registration */}
                            <View style={{ flexDirection: 'row', marginBottom: 20, justifyContent: 'space-around' }}>
                                {selectedPlayer.data?.personal?.playerImgUrl && (
                                    <View style={{ alignItems: 'center' }}>
                                        <Image source={{ uri: selectedPlayer.data.personal.playerImgUrl }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 5 }} />
                                        <Text style={{ fontSize: 10, color: 'gray' }}>Profile Photo</Text>
                                    </View>
                                )}
                                {selectedPlayer.data?.personal?.adharImgUrl && (
                                    <View style={{ alignItems: 'center' }}>
                                        <TouchableOpacity>
                                            <Image source={{ uri: selectedPlayer.data.personal.adharImgUrl }} style={{ width: 140, height: 90, borderRadius: 8, marginBottom: 5, resizeMode: 'cover', borderWidth: 1, borderColor: '#eee' }} />
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 10, color: 'gray' }}>Aadhar Card</Text>
                                    </View>
                                )}
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Personal Details</Text>
                                <DetailRow label="Email" value={selectedPlayer.email} />
                                <DetailRow label="Phone" value={selectedPlayer.phone} />
                                <DetailRow label="Age" value={selectedPlayer.data?.personal?.age} />
                                <DetailRow label="DOB" value={selectedPlayer.data?.personal?.dob} />
                                <DetailRow label="Gender" value={selectedPlayer.data?.personal?.gender} />
                                <DetailRow label="Blood Group" value={selectedPlayer.data?.personal?.bloodGroup} />
                                <DetailRow label="Address" value={selectedPlayer.data?.personal?.address} multiline />
                                <DetailRow label="Aadhar ID" value={selectedPlayer.data?.personal?.adharId ? `XXXX XXXX ${selectedPlayer.data.personal.adharId.slice(-4)}` : ''} />
                                <DetailRow label="Emergency Contact" value={selectedPlayer.data?.personal?.emergencyPhone} highlight />
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Kit Details</Text>
                                <DetailRow label="Jersey Name" value={selectedPlayer.data?.kit?.jerseyName} />
                                <DetailRow label="Jersey Number" value={selectedPlayer.data?.kit?.jerseyNumber} />
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                                    <Chip style={{ flex: 1 }}>Jersey: {selectedPlayer.data?.kit?.jerseySize}</Chip>
                                    <Chip style={{ flex: 1 }}>Shorts: {selectedPlayer.data?.kit?.jerseySize}</Chip>
                                </View>
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Game & Role</Text>
                                {/* Displaying only the current game profile for this tournament since that's what's most relevant here, but could show all if backed by master data */}
                                {selectedPlayer.data?.gameProfiles && Object.entries(selectedPlayer.data.gameProfiles).map(([game, details]) => (
                                    <View key={game} style={{ marginTop: 10, backgroundColor: '#f0f0f0', padding: 8, borderRadius: 8 }}>
                                        <Text style={{ fontWeight: 'bold' }}>{game}</Text>
                                        <Text>Role: {details.role}</Text>
                                        {Object.keys(details).map(k => {
                                            if (k === 'role') return null;
                                            return <Text key={k} style={{ fontSize: 12, color: '#555' }}>{k}: {details[k]}</Text>
                                        })}
                                    </View>
                                ))}
                            </View>

                            <Divider />
                            {selectedPlayer.paid && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Payment Details</Text>
                                    <DetailRow label="Status" value="PAID" highlight />
                                    <DetailRow label="Amount" value={selectedPlayer.paidAmount ? `₹${selectedPlayer.paidAmount}` : 'N/A'} />
                                    <DetailRow label="Payment ID" value={selectedPlayer.paymentId} />
                                    <DetailRow label="Order ID" value={selectedPlayer.orderId} />
                                    <DetailRow label="Method" value={selectedPlayer.method} />
                                    <DetailRow label="Date" value={selectedPlayer.paidAt?.seconds ? new Date(selectedPlayer.paidAt.seconds * 1000).toLocaleString() : 'N/A'} />
                                </View>
                            )}

                            {/* Enrollment History - If stored in the 'data' field (which comes from master profile snapshot at reg time) */}
                            {selectedPlayer.data?.enrolledTournaments && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>History (At Registration)</Text>
                                    {selectedPlayer.data.enrolledTournaments.map((t, i) => (
                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '500', fontSize: 13 }}>{t.tournamentName}</Text>
                                                {t.gameName && (
                                                    <View style={{ alignSelf: 'flex-start', backgroundColor: '#e0f7fa', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 }}>
                                                        <Text style={{ fontSize: 10, color: '#006064' }}>{t.gameName}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 12, color: 'gray', textAlign: 'right' }}>{t.date}</Text>
                                                <Text style={{ fontSize: 10, color: theme.colors.primary, textAlign: 'right', fontWeight: 'bold' }}>{t.role}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                        </ScrollView>
                    )}
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

// Helper Component
const DetailRow = ({ label, value, multiline, highlight }) => {
    if (!value) return null;
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, highlight && { color: '#B00020', fontWeight: 'bold' }]} numberOfLines={multiline ? 3 : 1}>{value}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    header: {
        backgroundColor: 'white',
        paddingBottom: 15,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%'
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
    searchBar: { backgroundColor: '#F1F3F5', marginHorizontal: 15, borderRadius: 12, height: 45 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 10, gap: 10 },
    chip: { backgroundColor: '#f0f0f0', height: 30 },
    list: {
        padding: 15,
        paddingBottom: 50,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%'
    },
    playerCard: { marginBottom: 12, borderRadius: 15, backgroundColor: 'white', borderColor: '#eee' },
    cardContent: { padding: 12 },
    playerInfo: { flexDirection: 'row', alignItems: 'center' },
    nameContainer: { flex: 1, marginLeft: 12 },
    playerName: { fontSize: 16, fontWeight: 'bold' },
    teamName: { fontSize: 13, color: '#666' },
    divider: { marginVertical: 10, backgroundColor: '#f5f5f5' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
    value: { fontSize: 13, fontWeight: '500', color: '#333' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Modal Styles
    modalContent: { backgroundColor: 'white', padding: 25, margin: 20, borderRadius: 16, maxHeight: '80%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    section: { marginVertical: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#304FFE', paddingLeft: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    detailLabel: { color: 'gray', fontSize: 13 },
    detailValue: { fontWeight: '500', fontSize: 13, flex: 1, textAlign: 'right', marginLeft: 10 }
});
