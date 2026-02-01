import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert, Image } from 'react-native';
import { Title, Text, Surface, FAB, ActivityIndicator, useTheme, Card, Avatar, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeamListScreen() {
    const { id } = useLocalSearchParams(); // Tournament ID
    const router = useRouter();
    const theme = useTheme();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTeams = async () => {
        try {
            const q = query(collection(db, 'tournaments', id, 'teams'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTeams(list);
        } catch (error) {
            console.error("Error fetching teams:", error);
            Alert.alert("Error", "Could not load teams.");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (id) fetchTeams();
        }, [id])
    );

    const handleDelete = async (teamId) => {
        Alert.alert("Delete Team", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'tournaments', id, 'teams', teamId));
                        fetchTeams();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete team.");
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }) => (
        <Card style={styles.card} mode="elevated">
            <Card.Title
                title={item.name}
                subtitle={`${item.playerIds?.length || 0} Players`}
                left={(props) => item.logo ? <Avatar.Image {...props} source={{ uri: item.logo }} /> : <Avatar.Text {...props} label={item.name[0]} />}
                right={(props) => <IconButton {...props} icon="delete" onPress={() => handleDelete(item.id)} />}
            />
        </Card>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>Teams</Title>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={teams}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No teams created yet. Create teams to start scoring matches.</Text>}
                />
            )}

            <FAB
                icon="plus"
                style={styles.fab}
                label="Create Team"
                onPress={() => router.push(`/(organizer)/teams/create/${id}`)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'white', elevation: 2 },
    card: { marginBottom: 12 },
    fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
