import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Title, Text, Surface, FAB, ActivityIndicator, useTheme, Card, Avatar, IconButton, Chip } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { collection, query, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchListScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tournament, setTournament] = useState(null);

    const fetchMatches = async () => {
        try {
            const q = query(collection(db, 'tournaments', id, 'matches'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort by startTime
            list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            setMatches(list);
        } catch (error) {
            console.error("Error fetching matches:", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (id) {
                fetchMatches();
                // Also fetch tournament info for context if needed
                getDoc(doc(db, 'tournaments', id)).then(snap => {
                    if (snap.exists()) setTournament(snap.data());
                });
            }
        }, [id])
    );

    const handleDelete = async (matchId) => {
        Alert.alert("Delete Match", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'tournaments', id, 'matches', matchId));
                        fetchMatches();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete match.");
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }) => (
        <Card style={styles.card} mode="elevated" onPress={() => router.push(`/(organizer)/matches/score/${id}?matchId=${item.id}`)}>
            <Card.Content>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                    <Text style={{color: 'gray', fontSize: 12}}>
                        {new Date(item.startTime).toLocaleString()}
                    </Text>
                    <Chip compact style={{backgroundColor: item.status === 'live' ? '#ffcdd2' : '#f0f0f0'}}>
                        {item.status?.toUpperCase() || 'SCHEDULED'}
                    </Chip>
                </View>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Title style={{flex: 1, textAlign: 'center'}}>{item.participant1Name}</Title>
                    <Text style={{fontWeight: 'bold', fontSize: 18, color: 'gray'}}>VS</Text>
                    <Title style={{flex: 1, textAlign: 'center'}}>{item.participant2Name}</Title>
                </View>
            </Card.Content>
            <Card.Actions>
                <IconButton icon="delete" onPress={() => handleDelete(item.id)} />
                <IconButton icon="scoreboard" onPress={() => router.push(`/(organizer)/matches/score/${id}?matchId=${item.id}`)} />
            </Card.Actions>
        </Card>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>Matches</Title>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No matches scheduled.</Text>}
                />
            )}

            <FAB
                icon="plus"
                style={styles.fab}
                label="Schedule Match"
                onPress={() => router.push(`/(organizer)/matches/create/${id}`)}
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
