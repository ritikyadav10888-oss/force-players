import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Title, Text, Card, Avatar, Surface, useTheme, Divider, Searchbar, IconButton, ActivityIndicator, Chip, Modal, Portal, List } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PublicTournamentPlayersScreen() {
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
            // Only show PAID/Confirmed players if necessary? 
            // For now, showing all registered as per request "full access players details"
            setPlayers(list);
        } catch (error) {
            console.error("Error fetching player list:", error);
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
        (p.teamName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayData = React.useMemo(() => {
        const teams = {};
        const solo = [];

        filteredPlayers.forEach(p => {
            const tName = (p.teamName || 'Solo').trim();
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
                        {item.members.map((member) => (
                            <View key={member.id}>
                                <Divider />
                                <List.Item
                                    title={member.playerName}
                                    description={member.data?.kit?.jerseyName ? `Jersey: ${member.data.kit.jerseyName}` : 'Player'}
                                    left={props => <List.Icon {...props} icon="account" />}
                                    right={props => <IconButton icon="chevron-right" size={20} />}
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
                    <View style={{ width: 40 }} />
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

            {/* Public Player Details Modal (Limited Info) */}
            <Portal>
                <Modal visible={!!selectedPlayer} onDismiss={() => setSelectedPlayer(null)} contentContainerStyle={styles.modalContent}>
                    {selectedPlayer && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Title>{selectedPlayer.playerName}</Title>
                                <IconButton icon="close" onPress={() => setSelectedPlayer(null)} />
                            </View>

                            {/* Images - Allowed publicly? Assuming photos are needed for identification/gallery feel */}
                            <View style={{ flexDirection: 'row', marginBottom: 20, justifyContent: 'center' }}>
                                {selectedPlayer.data?.personal?.playerImgUrl ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <Image source={{ uri: selectedPlayer.data.personal.playerImgUrl }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 5 }} />
                                        <Text style={{ fontSize: 10, color: 'gray' }}>Profile Photo</Text>
                                    </View>
                                ) : (
                                    <Avatar.Text size={80} label={selectedPlayer.playerName[0]} />
                                )}
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Player Details</Text>
                                <DetailRow label="Team" value={selectedPlayer.teamName || 'Solo'} />
                                <DetailRow label="Jersey Name" value={selectedPlayer.data?.kit?.jerseyName} />
                                <DetailRow label="Jersey Number" value={selectedPlayer.data?.kit?.jerseyNumber} />
                                <DetailRow label="Game Role" value={selectedPlayer.data?.gameProfiles?.[tournament?.gameName]?.role || 'Player'} />
                            </View>

                            {/* No Personal Contact Info for Public */}

                        </ScrollView>
                    )}
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const DetailRow = ({ label, value }) => {
    if (!value) return null;
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalContent: { backgroundColor: 'white', padding: 25, margin: 20, borderRadius: 16, maxHeight: '80%', width: '100%', maxWidth: 500, alignSelf: 'center' },
    section: { marginVertical: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginBottom: 10 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { color: 'gray', fontSize: 14 },
    detailValue: { fontWeight: '500', fontSize: 14 }
});
