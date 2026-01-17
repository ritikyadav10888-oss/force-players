import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Platform } from 'react-native';
import { Title, Text, Surface, useTheme, Chip, FAB, Searchbar, Button, Divider, Portal, Dialog, Paragraph } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, getCountFromServer, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TournamentCard = ({ item, onDelete, deletingId }) => {
    const theme = useTheme();
    const router = useRouter();
    const isDeleting = deletingId === item.id;

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
                        <Text style={styles.tMeta}><MaterialCommunityIcons name="calendar" size={14} /> {item.startDate}</Text>
                        <Text style={styles.tMeta}>
                            <MaterialCommunityIcons name="account-tie" size={14} />
                            <Text style={{ fontWeight: '600', color: '#1a237e' }}>Organizer: </Text>
                            {item.organizerName || 'Unknown'}
                            {item.organizerEmail ? ` (${item.organizerEmail})` : ''}
                        </Text>
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
                        disabled={isDeleting}
                    >
                        Edit
                    </Button>
                    <Button
                        mode="outlined"
                        icon="delete"
                        style={{ flex: 1, borderColor: theme.colors.error }}
                        textColor={theme.colors.error}
                        onPress={() => onDelete(item.id)}
                        loading={isDeleting}
                        disabled={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
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
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
        setDeletingId(id);
        setConfirmDeleteId(null); // Close modal
        try {
            await deleteDoc(doc(db, 'tournaments', id));
            await fetchTournaments();
            if (Platform.OS === 'web') alert("Tournament deleted successfully.");
            else Alert.alert("Success", "Tournament deleted successfully.");
        } catch (error) {
            console.error("Delete Error:", error);
            if (Platform.OS === 'web') alert("Failed: " + error.message);
            else Alert.alert("Error", "Failed to delete: " + error.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDelete = (id) => {
        if (Platform.OS === 'web') {
            setConfirmDeleteId(id);
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
                    renderItem={({ item }) => <TournamentCard item={item} onDelete={handleDelete} deletingId={deletingId} />}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No tournaments found.</Text>}
                />
            </View>

            {/* Delete Confirmation Dialog */}
            <Portal>
                <Dialog visible={confirmDeleteId !== null} onDismiss={() => setConfirmDeleteId(null)} style={{ borderRadius: 16 }}>
                    <Dialog.Icon icon="alert-circle-outline" size={48} color={theme.colors.error} />
                    <Dialog.Title style={{ textAlign: 'center', fontSize: 20, fontWeight: 'bold' }}>Delete Tournament</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ textAlign: 'center', fontSize: 15, color: '#666' }}>
                            Are you sure you want to delete this tournament? This action cannot be undone.
                        </Paragraph>
                    </Dialog.Content>
                    <Dialog.Actions style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
                        <Button
                            onPress={() => setConfirmDeleteId(null)}
                            mode="outlined"
                            style={{ marginRight: 8, borderRadius: 8 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onPress={() => executeDelete(confirmDeleteId)}
                            mode="contained"
                            buttonColor={theme.colors.error}
                            icon="delete"
                            style={{ borderRadius: 8 }}
                        >
                            Delete
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

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
    header: {
        padding: 20,
        backgroundColor: 'white',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    content: {
        flex: 1,
        padding: 15,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center'
    },
    searchBar: {
        marginBottom: 15,
        backgroundColor: 'white',
        elevation: 2,
        borderRadius: 12
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    cardContent: { padding: 18 },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        elevation: 2
    },
    info: { flex: 1 },
    tName: { fontSize: 17, fontWeight: '700', color: '#1a237e', letterSpacing: 0.3 },
    tMeta: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },
    statsRow: {
        flexDirection: 'row',
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e8e8e8',
        paddingTop: 12
    },
    statChip: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
        backgroundColor: '#f5f7fa',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        borderRadius: 16,
        elevation: 6
    },
});
