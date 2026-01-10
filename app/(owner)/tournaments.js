import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Platform } from 'react-native';
import { Title, Text, Surface, useTheme, Chip, FAB, Searchbar, Button, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, getCountFromServer, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TournamentCard = ({ item, onDelete }) => {
    const theme = useTheme();
    const router = useRouter();

    return (
        <Surface style={styles.card} elevation={2}>
            <View style={styles.cardContent}>
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="trophy" size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.info}>
                        <Title style={styles.tName}>{item.name}</Title>
                        <Text style={styles.tMeta}><MaterialCommunityIcons name="gamepad-variant" size={14} /> {item.gameName} ({item.entryType})</Text>
                        <Text style={styles.tMeta}><MaterialCommunityIcons name="calendar" size={14} /> {item.startDate} | By: {item.organizerName || 'Unknown'}</Text>
                    </View>
                    <Chip textStyle={{ fontSize: 10, height: 12, lineHeight: 12 }} style={{ alignSelf: 'flex-start' }}>{item.status || 'Open'}</Chip>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statChip}>
                        <MaterialCommunityIcons name="account-group" size={16} color="#666" />
                        <Text style={{ marginLeft: 5, fontWeight: 'bold', color: '#444' }}>
                            {item.enrolledCount} / {item.maxParticipants || '∞'}
                        </Text>
                    </View>
                    <View style={styles.statChip}>
                        <MaterialCommunityIcons name="cash" size={16} color="#666" />
                        <Text style={{ marginLeft: 5, fontWeight: 'bold', color: '#444' }}>Fee: ₹{item.entryFee}</Text>
                    </View>
                    <View style={styles.statChip}>
                        <MaterialCommunityIcons name="chart-line" size={16} color="green" />
                        <Text style={{ marginLeft: 5, fontWeight: 'bold', color: 'green' }}>
                            ₹{((Number(item.entryFee) || 0) * (item.enrolledCount || 0)).toLocaleString()}
                        </Text>
                    </View>
                </View>

                <Divider style={{ marginVertical: 10 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Button
                        mode="outlined"
                        icon="pencil"
                        style={{ flex: 1, borderColor: theme.colors.primary }}
                        textColor={theme.colors.primary}
                        onPress={() => router.push({ pathname: '/(owner)/create-tournament', params: { id: item.id } })}
                    >
                        Edit
                    </Button>
                    <Button
                        mode="outlined"
                        icon="delete"
                        style={{ flex: 1, borderColor: theme.colors.error }}
                        textColor={theme.colors.error}
                        onPress={() => onDelete(item.id)}
                    >
                        Delete
                    </Button>
                </View>
            </View>
        </Surface>
    );
};

export default function TournamentsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [tournaments, setTournaments] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTournaments = async () => {
        try {
            const q = query(collection(db, 'tournaments'));
            const snapshot = await getDocs(q).catch(() => ({ docs: [] }));

            const list = await Promise.all(snapshot.docs.map(async doc => {
                const data = doc.data();
                let count = 0;
                try {
                    const countSnap = await getDocs(collection(db, 'tournaments', doc.id, 'players')).catch(() => ({ size: 0 }));
                    count = countSnap.size;
                } catch (e) { console.warn("Count error", e); }
                return { id: doc.id, ...data, enrolledCount: count };
            }));

            setTournaments(list);
        } catch (error) {
            console.warn("Error fetching tournaments:", error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    const filtered = tournaments.filter(t =>
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const executeDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'tournaments', id));
            fetchTournaments();
            if (Platform.OS !== 'web') Alert.alert("Success", "Tournament deleted successfully.");
        } catch (error) {
            console.error(error);
            if (Platform.OS !== 'web') Alert.alert("Error", "Failed to delete tournament.");
            else alert("Failed to delete tournament: " + error.message);
        }
    };

    const handleDelete = (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this tournament? This action cannot be undone.")) {
                executeDelete(id);
            }
        } else {
            Alert.alert(
                "Delete Tournament",
                "Are you sure you want to delete this tournament? This action cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => executeDelete(id)
                    }
                ]
            );
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Title>Tournaments</Title>
            </View>
            <View style={styles.content}>
                <Searchbar
                    placeholder="Search Tournaments"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />

                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTournaments(); }} />}
                    renderItem={({ item }) => <TournamentCard item={item} onDelete={handleDelete} />}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No tournaments found.</Text>}
                />
            </View>
            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.tertiary }]}
                color="black"
                label="Create"
                onPress={() => router.push('/(owner)/create-tournament')}
            />
        </View>
    );
}

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
    card: { backgroundColor: 'white', borderRadius: 12, marginBottom: 15, overflow: 'hidden' },
    cardContent: { padding: 15 },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 45, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    info: { flex: 1 },
    tName: { fontSize: 16, fontWeight: 'bold', color: '#1a237e' },
    tMeta: { fontSize: 12, color: 'gray', marginTop: 2 },
    statsRow: { flexDirection: 'row', marginTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    statChip: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
