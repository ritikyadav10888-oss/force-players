import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Platform } from 'react-native';
import { Title, Text, Surface, useTheme, Avatar, FAB, Divider, Searchbar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const executeDelete = async (id, setOrganizers) => {
    try {
        await deleteDoc(doc(db, "users", id));
        setOrganizers(prev => prev.filter(item => item.id !== id));
        if (Platform.OS !== 'web') Alert.alert("Success", "Organizer deleted successfully.");
    } catch (error) {
        console.error(error);
        if (Platform.OS !== 'web') Alert.alert("Error", "Failed to delete organizer.");
        else alert("Failed to delete organizer: " + error.message);
    }
};

export default function OrganizersScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [organizers, setOrganizers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrganizers = async () => {
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'organizer'));
            const snapshot = await getDocs(q).catch(() => ({ docs: [] }));

            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            organizers.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort alphabetically
            setOrganizers(list);
        } catch (error) {
            console.warn("Error fetching organizers:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrganizers();
    }, []);

    const handleDelete = (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this organizer? This action cannot be undone.")) {
                executeDelete(id, setOrganizers);
            }
        } else {
            Alert.alert(
                "Delete Organizer",
                "Are you sure you want to delete this organizer? This action cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => executeDelete(id, setOrganizers)
                    }
                ]
            );
        }
    };

    const filteredOrganizers = organizers.filter(org =>
        (org.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (org.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={[styles.container, { backgroundColor: '#F5F7FA' }]}>
            <View style={styles.header}>
                <Title>Organizers</Title>
            </View>
            <View style={styles.content}>
                <Searchbar
                    placeholder="Search Organizers"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />

                <FlatList
                    data={filteredOrganizers}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrganizers(); }} />}
                    renderItem={({ item }) => (
                        <Surface style={styles.card} elevation={1}>
                            <View style={styles.cardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    {item.profilePic ? (
                                        <Avatar.Image size={42} source={{ uri: item.profilePic }} />
                                    ) : (
                                        <Avatar.Text size={42} label={item.name?.[0] || 'O'} style={{ backgroundColor: theme.colors.secondaryContainer }} />
                                    )}
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.name}>{item.name}</Text>
                                        <Text style={styles.email}>{item.email}</Text>
                                    </View>
                                </View>
                            </View>

                            <Divider style={{ marginVertical: 10 }} />

                            <View style={styles.actionRow}>
                                <IconButton
                                    icon="eye"
                                    size={20}
                                    onPress={() => router.push({ pathname: '/(owner)/organizer-details', params: { id: item.id } })}
                                />
                                <IconButton
                                    icon="pencil"
                                    size={20}
                                    onPress={() => router.push({ pathname: '/(owner)/create-organizer', params: { editId: item.id } })}
                                />
                                <IconButton
                                    icon="plus"
                                    size={20}
                                    iconColor={theme.colors.primary}
                                    style={{ backgroundColor: theme.colors.elevation.level2 }}
                                    onPress={() => router.push({ pathname: '/(owner)/create-tournament', params: { organizerId: item.id } })}
                                />
                                <IconButton
                                    icon="delete"
                                    size={20}
                                    iconColor={theme.colors.error}
                                    onPress={() => handleDelete(item.id)}
                                />
                            </View>
                        </Surface>
                    )}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No organizers found.</Text>}
                />
            </View>

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color="white"
                label="Add"
                onPress={() => router.push('/(owner)/create-organizer')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardInfo: { marginLeft: 15 },
    name: { fontSize: 16, fontWeight: 'bold' },
    email: { fontSize: 12, color: 'gray' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
