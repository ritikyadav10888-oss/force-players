import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Title, Text, Surface, ActivityIndicator, IconButton, Card, Chip, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LiveMatchListScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Real-time listener for live scores
        const q = query(collection(db, 'tournaments', id, 'matches'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort: Live first, then Scheduled, then Completed
            list.sort((a, b) => {
                const statusOrder = { 'live': 0, 'scheduled': 1, 'completed': 2 };
                return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
            });
            setMatches(list);
            setLoading(false);
        });
        return () => unsub();
    }, [id]);

    const renderItem = ({ item }) => {
        const isLive = item.status === 'live';
        const score = item.scoreData || {};

        let scoreText = "VS";
        if (isLive || item.status === 'completed') {
            if (['Cricket'].includes(item.sport)) {
                scoreText = `${score.runs || 0}/${score.wickets || 0}`;
            } else if (['Tennis', 'Badminton'].includes(item.sport)) {
                // Show sets if available, or just VS
                scoreText = "VS";
                if (score.sets && score.sets.length > 0) {
                     const currentSet = score.sets[score.sets.length - 1];
                     scoreText = `${currentSet.p1}-${currentSet.p2}`;
                }
            } else {
                scoreText = `${score.p1 || 0} - ${score.p2 || 0}`;
            }
        }

        return (
            <Card style={[styles.card, isLive && {borderColor: '#ef5350', borderWidth: 2}]} onPress={() => router.push(`/tournament/${id}/match/${item.id}`)}>
                <Card.Content>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                        <Chip compact style={{backgroundColor: isLive ? '#ffcdd2' : '#f0f0f0'}}>
                            {isLive ? 'LIVE' : (item.status?.toUpperCase() || 'SCHEDULED')}
                        </Chip>
                        <Text style={{fontSize: 12, color: 'gray'}}>{item.sport}</Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Text style={[styles.teamName, {textAlign: 'left'}]}>{item.participant1Name}</Text>
                        <Text style={styles.score}>{scoreText}</Text>
                        <Text style={[styles.teamName, {textAlign: 'right'}]}>{item.participant2Name}</Text>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>Match Center</Title>
                <View style={{width: 40}} />
            </View>

            {loading ? <ActivityIndicator style={{marginTop: 50}} /> : (
                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{padding: 16}}
                    ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: 'gray'}}>No matches found.</Text>}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: 'white' },
    card: { marginBottom: 12, backgroundColor: 'white' },
    teamName: { flex: 1, fontSize: 16, fontWeight: 'bold' },
    score: { fontSize: 20, fontWeight: 'bold', color: '#1A237E', marginHorizontal: 10 }
});
