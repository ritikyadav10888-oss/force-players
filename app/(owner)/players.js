import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Title, Text, Surface, useTheme, Avatar, Searchbar, Modal, Portal, IconButton, Divider, Chip } from 'react-native-paper';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

export default function PlayersScreen() {
    const theme = useTheme();
    const [players, setPlayers] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    const fetchPlayers = async () => {
        try {
            // Fetching from master_players to show all tournament registrants
            const q = query(collection(db, 'master_players'));
            const snapshot = await getDocs(q).catch((e) => { console.warn(e); return { docs: [] }; });
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlayers(list);
        } catch (error) {
            console.warn("Error fetching players:", error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPlayers();
    }, []);

    const filtered = players.filter(p =>
        (p.personal?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.personal?.phone || '').includes(searchQuery)
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Title>Registered Players</Title>
            </View>
            <View style={styles.content}>
                <Searchbar
                    placeholder="Search by Name, Email or Phone"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />

                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPlayers(); }} />}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => setSelectedPlayer(item)}>
                            <Surface style={styles.card} elevation={1}>
                                <View style={styles.row}>
                                    {item.personal?.playerImgUrl ? (
                                        <Avatar.Image size={50} source={{ uri: item.personal.playerImgUrl }} />
                                    ) : (
                                        <Avatar.Text size={50} label={item.personal?.name?.[0] || 'P'} style={{ backgroundColor: theme.colors.primary }} />
                                    )}
                                    <View style={styles.info}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.name}>{item.personal?.name || 'Unknown'}</Text>
                                            <Text style={{ fontSize: 12, color: 'gray' }}>{item.personal?.phone}</Text>
                                        </View>
                                        <Text style={styles.email}>{item.email}</Text>

                                        {/* Display Games/Roles */}
                                        {item.gameProfiles && Object.keys(item.gameProfiles).length > 0 && (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 }}>
                                                {Object.entries(item.gameProfiles).map(([game, details]) => (
                                                    <View key={game} style={{ backgroundColor: '#E3F2FD', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 5, marginTop: 2 }}>
                                                        <Text style={{ fontSize: 10, color: '#1565C0' }}>{game}: {details.role}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {/* Enrolled Tournaments Summary */}
                                        {item.enrolledTournaments && item.enrolledTournaments.length > 0 && (
                                            <View style={{ marginTop: 8 }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 2 }}>Enrolled In:</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                    {item.enrolledTournaments.slice(0, 3).map((t, idx) => (
                                                        <View key={idx} style={{ backgroundColor: '#F3E5F5', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 5, marginTop: 2, borderWidth: 1, borderColor: '#CE93D8' }}>
                                                            <Text style={{ fontSize: 10, color: '#6A1B9A' }}>{t.tournamentName}</Text>
                                                        </View>
                                                    ))}
                                                    {item.enrolledTournaments.length > 3 && <Text style={{ fontSize: 10, color: '#666', alignSelf: 'center', marginLeft: 5 }}>+{item.enrolledTournaments.length - 3} more</Text>}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Surface>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No players registered yet.</Text>}
                />

                <Portal>
                    <Modal visible={!!selectedPlayer} onDismiss={() => setSelectedPlayer(null)} contentContainerStyle={styles.modalContent}>
                        {selectedPlayer && (
                            <ScrollView>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                    <Title>{selectedPlayer.personal?.name}</Title>
                                    <IconButton icon="close" onPress={() => setSelectedPlayer(null)} />
                                </View>

                                {/* Images */}
                                <View style={{ flexDirection: 'row', marginBottom: 20, justifyContent: 'space-around' }}>
                                    {selectedPlayer.personal?.playerImgUrl && (
                                        <View style={{ alignItems: 'center' }}>
                                            <Image source={{ uri: selectedPlayer.personal.playerImgUrl }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 5 }} />
                                            <Text style={{ fontSize: 10, color: 'gray' }}>Profile Photo</Text>
                                        </View>
                                    )}
                                    {selectedPlayer.personal?.adharImgUrl && (
                                        <View style={{ alignItems: 'center' }}>
                                            <TouchableOpacity onPress={() => {/* Optional: Add full screen view later */ }}>
                                                <Image source={{ uri: selectedPlayer.personal.adharImgUrl }} style={{ width: 140, height: 90, borderRadius: 8, marginBottom: 5, resizeMode: 'cover', borderWidth: 1, borderColor: '#eee' }} />
                                            </TouchableOpacity>
                                            <Text style={{ fontSize: 10, color: 'gray' }}>Aadhar Card</Text>
                                        </View>
                                    )}
                                </View>

                                <Divider />
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Personal Details</Text>
                                    <DetailRow label="Email" value={selectedPlayer.email} />
                                    <DetailRow label="Phone" value={selectedPlayer.personal?.phone} />
                                    <DetailRow label="Age" value={selectedPlayer.personal?.age} />
                                    <DetailRow label="DOB" value={selectedPlayer.personal?.dob} />
                                    <DetailRow label="Gender" value={selectedPlayer.personal?.gender} />
                                    <DetailRow label="Blood Group" value={selectedPlayer.personal?.bloodGroup} />
                                    <DetailRow label="Address" value={selectedPlayer.personal?.address} multiline />
                                    <DetailRow label="Aadhar ID" value={selectedPlayer.personal?.adharId ? `XXXX XXXX ${selectedPlayer.personal.adharId.slice(-4)}` : ''} />
                                    <DetailRow label="Emergency Contact" value={selectedPlayer.personal?.emergencyPhone} highlight />
                                </View>

                                <Divider />
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Kit Details</Text>
                                    <DetailRow label="Jersey Name" value={selectedPlayer.kit?.jerseyName} />
                                    <DetailRow label="Jersey Number" value={selectedPlayer.kit?.jerseyNumber} />
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                                        <Chip style={{ flex: 1 }}>Jersey: {selectedPlayer.kit?.jerseySize}</Chip>
                                        <Chip style={{ flex: 1 }}>Shorts: {selectedPlayer.kit?.jerseySize}</Chip>
                                        {/* Note: In data structure we might have separate shortsSize but fallback mostly implies L/M logic if incomplete. */}
                                    </View>
                                </View>

                                <Divider />
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Career & Games</Text>
                                    <DetailRow label="Pro Level" value={selectedPlayer.career?.level} />
                                    {selectedPlayer.gameProfiles && Object.entries(selectedPlayer.gameProfiles).map(([game, details]) => (
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
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Enrolled History</Text>
                                    {selectedPlayer.enrolledTournaments && selectedPlayer.enrolledTournaments.map((t, i) => (
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

                            </ScrollView>
                        )}
                    </Modal>
                </Portal>
            </View>
        </View>
    );
}

// Helper Component for Details
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
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { padding: 20, backgroundColor: 'white', elevation: 2 },
    content: {
        flex: 1,
        padding: 15,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center'
    },
    searchBar: { marginBottom: 15, backgroundColor: 'white' },
    card: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center' },
    info: { marginLeft: 15, flex: 1 }, // Added flex:1 to prevent text overflow
    name: { fontSize: 16, fontWeight: 'bold' },
    email: { fontSize: 14, color: 'gray' },

    // Modal Styles
    modalContent: { backgroundColor: 'white', padding: 25, margin: 20, borderRadius: 16, maxHeight: '80%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    section: { marginVertical: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#304FFE', paddingLeft: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    detailLabel: { color: 'gray', fontSize: 13 },
    detailValue: { fontWeight: '500', fontSize: 13, flex: 1, textAlign: 'right', marginLeft: 10 }
});
