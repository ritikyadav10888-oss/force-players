import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Title, Text, Surface, ActivityIndicator, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- READ ONLY COMPONENTS ---

const CricketBoard = ({ match }) => {
    const score = match.scoreData || { runs: 0, wickets: 0, balls: 0, currentOver: [] };
    const oversDisplay = `${Math.floor(score.balls / 6)}.${score.balls % 6}`;

    return (
        <Surface style={styles.board} elevation={4}>
            <Title style={{fontSize: 56, fontWeight: 'bold'}}>{score.runs}/{score.wickets}</Title>
            <Text style={{fontSize: 24, color: 'gray', marginBottom: 10}}>Overs: {oversDisplay}</Text>

            <View style={styles.overContainer}>
                <Text style={{marginRight: 10, fontWeight: 'bold', alignSelf: 'center'}}>This Over:</Text>
                {score.currentOver.map((b, i) => (
                    <View key={i} style={styles.ballBubble}>
                        <Text style={{fontWeight: 'bold'}}>{b}</Text>
                    </View>
                ))}
            </View>

            <Divider style={{marginVertical: 20, width: '100%'}} />
            <Text style={{fontSize: 16, color: 'gray'}}>Target: --</Text>
        </Surface>
    );
};

const TennisBoard = ({ match }) => {
    const score = match.scoreData || { sets: [{p1: 0, p2: 0}], currentGame: {p1: 0, p2: 0} };
    const POINTS = ['0', '15', '30', '40', 'AD'];

    return (
        <Surface style={styles.board} elevation={4}>
            <View style={styles.tennisRow}>
                <Text style={styles.tennisName}>{match.participant1Name}</Text>
                <View style={{flexDirection: 'row'}}>
                    {score.sets.map((s, i) => <Text key={i} style={styles.setScore}>{s.p1}</Text>)}
                    <Text style={styles.gameScore}>{POINTS[score.currentGame.p1] || score.currentGame.p1}</Text>
                </View>
            </View>
            <Divider />
            <View style={styles.tennisRow}>
                <Text style={styles.tennisName}>{match.participant2Name}</Text>
                <View style={{flexDirection: 'row'}}>
                    {score.sets.map((s, i) => <Text key={i} style={styles.setScore}>{s.p2}</Text>)}
                    <Text style={styles.gameScore}>{POINTS[score.currentGame.p2] || score.currentGame.p2}</Text>
                </View>
            </View>
        </Surface>
    );
};

const GenericBoard = ({ match }) => {
    const score = match.scoreData || { p1: 0, p2: 0 };
    return (
        <Surface style={styles.board} elevation={4}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                <View style={{alignItems: 'center', flex: 1}}>
                    <Text style={styles.genericName}>{match.participant1Name}</Text>
                    <Title style={{fontSize: 60}}>{score.p1}</Title>
                </View>
                <Text style={{fontSize: 30, color: 'gray'}}>VS</Text>
                <View style={{alignItems: 'center', flex: 1}}>
                    <Text style={styles.genericName}>{match.participant2Name}</Text>
                    <Title style={{fontSize: 60}}>{score.p2}</Title>
                </View>
            </View>
        </Surface>
    );
};

export default function PublicMatchScreen() {
    const { id, matchId } = useLocalSearchParams();
    const router = useRouter();
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'tournaments', id, 'matches', matchId), (docSnap) => {
            if (docSnap.exists()) {
                setMatch({ id: docSnap.id, ...docSnap.data() });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, matchId]);

    if (loading) return <ActivityIndicator style={{marginTop: 50}} />;
    if (!match) return <Text>Match not found</Text>;

    const sport = match.sport || 'Generic';
    const isCricket = ['Cricket'].includes(sport);
    const isTennis = ['Tennis', 'Badminton', 'Pickleball', 'Table Tennis'].includes(sport);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>Live Center</Title>
                <View style={{width: 40}} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.meta}>
                    <Text style={{fontSize: 12, color: 'gray', textTransform: 'uppercase', letterSpacing: 1}}>{match.sport} • {match.status}</Text>
                    <Text style={{fontSize: 12, color: 'gray'}}>{new Date(match.startTime).toLocaleString()}</Text>
                </View>

                {isCricket ? <CricketBoard match={match} /> :
                 isTennis ? <TennisBoard match={match} /> :
                 <GenericBoard match={match} />}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: 'white' },
    content: { padding: 20 },
    meta: { alignItems: 'center', marginBottom: 20 },
    board: { padding: 20, borderRadius: 16, alignItems: 'center', width: '100%', marginBottom: 30, backgroundColor: 'white' },

    // Cricket
    overContainer: { flexDirection: 'row', marginTop: 15, gap: 5 },
    ballBubble: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },

    // Tennis
    tennisRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center', width: '100%' },
    tennisName: { fontSize: 18, fontWeight: 'bold', flex: 1 },
    setScore: { fontSize: 20, color: 'gray', marginHorizontal: 10 },
    gameScore: { fontSize: 24, fontWeight: 'bold', color: '#1A237E', width: 40, textAlign: 'right' },

    // Generic
    genericName: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }
});
