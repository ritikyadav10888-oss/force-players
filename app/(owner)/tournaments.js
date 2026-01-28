import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Platform } from 'react-native';
import { Title, Text, Surface, useTheme, Chip, FAB, Searchbar, Button, Divider, Portal, Dialog, Paragraph } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, getCountFromServer, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { exportTournamentPlayers } from '../../src/services/ExcelExportService';

const TournamentCard = ({ item, onDelete, deletingId }) => {
    const theme = useTheme();
    const router = useRouter();
    const isDeleting = deletingId === item.id;

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'upcoming': return '#2196F3';
            case 'ongoing': return '#4CAF50';
            case 'completed': return '#757575';
            default: return '#9C27B0';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'upcoming': return 'Upcoming';
            case 'ongoing': return 'Ongoing';
            case 'completed': return 'Completed';
            default: return 'Open';
        }
    };

    const handleExportPlayers = async (tournamentId, tournamentName) => {
        await exportTournamentPlayers(tournamentId, tournamentName, db);
    };

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
                    <Chip
                        textStyle={{ fontSize: 10, height: 12, lineHeight: 12, color: 'white', fontWeight: 'bold' }}
                        style={{
                            alignSelf: 'flex-start',
                            backgroundColor: getStatusColor(item.computedStatus)
                        }}
                    >
                        {getStatusLabel(item.computedStatus)}
                    </Chip>
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

                {/* Transaction & Organizer Details Section */}
                <View style={styles.detailsSection}>
                    {/* Organizer Assignment Details */}
                    <View style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                            <MaterialCommunityIcons name="account-tie" size={18} color="#1a237e" />
                            <Text style={styles.detailTitle}>Organizer Assignment</Text>
                        </View>
                        <View style={styles.detailContent}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Name:</Text>
                                <Text style={styles.detailValue}>{item.organizerName || 'Not Assigned'}</Text>
                            </View>
                            {item.organizerEmail && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Email:</Text>
                                    <Text style={styles.detailValue}>{item.organizerEmail}</Text>
                                </View>
                            )}
                            {item.organizerId && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>ID:</Text>
                                    <Text style={[styles.detailValue, { fontFamily: 'monospace', fontSize: 11 }]}>
                                        {item.organizerId.substring(0, 12)}...
                                    </Text>
                                </View>
                            )}
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Status:</Text>
                                <View style={[styles.statusDot, { backgroundColor: item.organizerId ? '#4CAF50' : '#FF9800' }]} />
                                <Text style={[styles.detailValue, { color: item.organizerId ? '#4CAF50' : '#FF9800', fontWeight: 'bold' }]}>
                                    {item.organizerId ? 'Assigned' : 'Pending'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Transaction Tracking */}
                    <View style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                            <MaterialCommunityIcons name="cash-multiple" size={18} color="#1a237e" />
                            <Text style={styles.detailTitle}>Transaction Tracking</Text>
                        </View>
                        <View style={styles.detailContent}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Total Collected:</Text>
                                <Text style={[styles.detailValue, { color: '#4CAF50', fontWeight: 'bold' }]}>
                                    ₹{(item.totalCollections || ((Number(item.entryFee) || 0) * (item.enrolledCount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Platform Fee (5%):</Text>
                                <Text style={styles.detailValue}>
                                    ₹{(item.platformCommission || (Math.round((item.totalCollections || ((Number(item.entryFee) || 0) * (item.enrolledCount || 0))) * 0.05 * 100) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Organizer Share:</Text>
                                <Text style={[styles.detailValue, { color: '#2196F3', fontWeight: 'bold' }]}>
                                    ₹{(item.organizerShare || (Math.round((item.totalCollections || ((Number(item.entryFee) || 0) * (item.enrolledCount || 0))) * 0.95 * 100) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Paid Players:</Text>
                                <Text style={styles.detailValue}>{item.paidPlayerCount || item.enrolledCount || 0}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Payout Status:</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.statusDot, {
                                        backgroundColor: item.settlementStatus === 'completed' || item.settlementStatus === 'SUCCESS' ? '#4CAF50' :
                                            (item.settlementStatus === 'processing' || item.settlementStatus === 'PROCESSING' ? '#FF9800' : '#757575')
                                    }]} />
                                    <Text style={[styles.detailValue, {
                                        color: item.settlementStatus === 'completed' || item.settlementStatus === 'SUCCESS' ? '#4CAF50' :
                                            (item.settlementStatus === 'processing' || item.settlementStatus === 'PROCESSING' ? '#FF9800' : '#757575'),
                                        fontWeight: 'bold'
                                    }]}>
                                        {item.settlementStatus === 'completed' || item.settlementStatus === 'SUCCESS' ? 'Completed' :
                                            (item.settlementStatus === 'processing' || item.settlementStatus === 'PROCESSING' ? 'Processing' : 'Pending')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <Divider style={{ marginVertical: 10 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <Button
                            mode="contained"
                            icon="pencil"
                            style={{ flex: 1 }}
                            onPress={() => router.push(`/(owner)/edit-tournament/${item.id}`)}
                        >
                            Edit Tournament
                        </Button>
                        <Button
                            mode="outlined"
                            icon="microsoft-excel"
                            style={{ flex: 1, borderColor: '#217346' }}
                            textColor="#217346"
                            onPress={() => handleExportPlayers(item.id, item.name)}
                        >
                            Export Players
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
    const [statusFilter, setStatusFilter] = useState('all'); // all, upcoming, ongoing, completed

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

        if (!startDate) return 'upcoming'; // Default if no date

        if (endDate && today > endDate) {
            return 'completed';
        } else if (today >= startDate && (!endDate || today <= endDate)) {
            return 'ongoing';
        } else if (today < startDate) {
            return 'upcoming';
        }

        return 'upcoming';
    };

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

                const tournamentData = { id: doc.id, ...data, enrolledCount: count };
                tournamentData.computedStatus = getTournamentStatus(tournamentData);

                return tournamentData;
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

    // Filter by search query and status
    const filtered = tournaments.filter(t => {
        const matchesSearch = (t.name || '').toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (statusFilter === 'all') return true;
        return t.computedStatus === statusFilter;
    });

    // Calculate counts for each status
    const statusCounts = {
        all: tournaments.length,
        upcoming: tournaments.filter(t => t.computedStatus === 'upcoming').length,
        ongoing: tournaments.filter(t => t.computedStatus === 'ongoing').length,
        completed: tournaments.filter(t => t.computedStatus === 'completed').length
    };

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

                {/* Status Filter */}
                <View style={{ marginBottom: 15 }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: '600' }}>
                        Filter by Status
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        <Chip
                            selected={statusFilter === 'all'}
                            onPress={() => setStatusFilter('all')}
                            style={{ backgroundColor: statusFilter === 'all' ? theme.colors.primary : '#f5f5f5' }}
                            textStyle={{ color: statusFilter === 'all' ? 'white' : '#333' }}
                        >
                            All ({statusCounts.all})
                        </Chip>
                        <Chip
                            selected={statusFilter === 'upcoming'}
                            onPress={() => setStatusFilter('upcoming')}
                            style={{ backgroundColor: statusFilter === 'upcoming' ? '#2196F3' : '#f5f5f5' }}
                            textStyle={{ color: statusFilter === 'upcoming' ? 'white' : '#333' }}
                        >
                            Upcoming ({statusCounts.upcoming})
                        </Chip>
                        <Chip
                            selected={statusFilter === 'ongoing'}
                            onPress={() => setStatusFilter('ongoing')}
                            style={{ backgroundColor: statusFilter === 'ongoing' ? '#4CAF50' : '#f5f5f5' }}
                            textStyle={{ color: statusFilter === 'ongoing' ? 'white' : '#333' }}
                        >
                            Ongoing ({statusCounts.ongoing})
                        </Chip>
                        <Chip
                            selected={statusFilter === 'completed'}
                            onPress={() => setStatusFilter('completed')}
                            style={{ backgroundColor: statusFilter === 'completed' ? '#757575' : '#f5f5f5' }}
                            textStyle={{ color: statusFilter === 'completed' ? 'white' : '#333' }}
                        >
                            Completed ({statusCounts.completed})
                        </Chip>
                    </View>
                </View>

                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTournaments(); }} colors={[theme.colors.primary]} />}
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

    // Transaction & Organizer Details Styles
    detailsSection: {
        marginTop: 15,
        gap: 12,
    },
    detailCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    detailTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1a237e',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailContent: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 12,
        color: '#333',
        fontWeight: '600',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
});
