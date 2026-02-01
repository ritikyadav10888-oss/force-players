import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Title, Text, Surface, ActivityIndicator, Button, IconButton, useTheme, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- SCORING COMPONENTS ---

const CricketScorer = ({ match, onUpdate }) => {
    const [score, setScore] = useState(match.scoreData || { runs: 0, wickets: 0, overs: 0, balls: 0, currentOver: [] });

    // Derived state
    const oversDisplay = `${Math.floor(score.balls / 6)}.${score.balls % 6}`;

    const updateScore = (type, value = 0) => {
        const newScore = { ...score };

        if (type === 'RUN') {
            newScore.runs += value;
            newScore.balls += 1;
            newScore.currentOver.push(value);
        } else if (type === 'WICKET') {
            newScore.wickets += 1;
            newScore.balls += 1;
            newScore.currentOver.push('W');
        } else if (type === 'WIDE' || type === 'NOBALL') {
            newScore.runs += 1 + value; // Extra run + any run taken
            // Ball count doesn't increase for Wide/NB usually in limited overs, but varies.
            // Standard: Extra run, ball not counted.
            newScore.currentOver.push(type === 'WIDE' ? 'WD' : 'NB');
        }

        // Over completion logic (simple version)
        if (newScore.currentOver.length >= 6) {
             // Visual cleanup for new over could go here, but keeping history is better
        }

        setScore(newScore);
        onUpdate(newScore);
    };

    return (
        <View style={styles.scorerContainer}>
            <Surface style={styles.scoreBoard} elevation={4}>
                <Title style={{fontSize: 48}}>{score.runs}/{score.wickets}</Title>
                <Text style={{fontSize: 20, color: 'gray'}}>Overs: {oversDisplay}</Text>
                <View style={styles.overContainer}>
                    {score.currentOver.slice(-6).map((b, i) => (
                        <View key={i} style={styles.ballBubble}>
                            <Text style={{fontWeight: 'bold'}}>{b}</Text>
                        </View>
                    ))}
                </View>
            </Surface>

            <View style={styles.controls}>
                <View style={styles.row}>
                    {[0, 1, 2, 3].map(r => (
                        <TouchableOpacity key={r} style={styles.controlBtn} onPress={() => updateScore('RUN', r)}>
                            <Text style={styles.btnText}>{r}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.row}>
                    {[4, 6].map(r => (
                        <TouchableOpacity key={r} style={[styles.controlBtn, {backgroundColor: '#e3f2fd'}]} onPress={() => updateScore('RUN', r)}>
                            <Text style={styles.btnText}>{r}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.controlBtn, {backgroundColor: '#ffcdd2'}]} onPress={() => updateScore('WICKET')}>
                        <Text style={[styles.btnText, {color: '#c62828'}]}>OUT</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.row}>
                    <Button mode="outlined" onPress={() => updateScore('WIDE')}>Wide</Button>
                    <Button mode="outlined" onPress={() => updateScore('NOBALL')}>No Ball</Button>
                </View>
            </View>
        </View>
    );
};

const TennisScorer = ({ match, onUpdate }) => {
    // Schema: { sets: [{p1: 0, p2: 0}], currentGame: {p1: 0, p2: 0} }
    // Points: 0, 15, 30, 40, AD
    const POINTS = ['0', '15', '30', '40', 'AD'];
    const [state, setState] = useState(match.scoreData || {
        sets: [{p1: 0, p2: 0}],
        currentGame: {p1: 0, p2: 0},
        p1Name: match.participant1Name,
        p2Name: match.participant2Name
    });

    const addPoint = (player) => {
        const newState = JSON.parse(JSON.stringify(state)); // Deep copy
        const opponent = player === 'p1' ? 'p2' : 'p1';

        const pScore = newState.currentGame[player];
        const oScore = newState.currentGame[opponent];

        // Logic
        if (pScore === 3 && oScore < 3) {
            // Game Won
            winGame(newState, player);
        } else if (pScore === 3 && oScore === 3) {
            // Deuce -> AD
            newState.currentGame[player] = 4; // AD
        } else if (pScore === 4) { // Has AD
            // Game Won
            winGame(newState, player);
        } else if (pScore === 3 && oScore === 4) {
            // Opponent had AD, back to Deuce
            newState.currentGame[opponent] = 3;
        } else {
            newState.currentGame[player]++;
        }

        setState(newState);
        onUpdate(newState);
    };

    const winGame = (state, player) => {
        state.currentGame = {p1: 0, p2: 0};
        const currentSetIdx = state.sets.length - 1;
        state.sets[currentSetIdx][player]++;

        // Check Set Win (Simplified: First to 6)
        // In a real app, would add Tie-Break logic and 2-game lead logic
    };

    return (
        <View style={styles.scorerContainer}>
            <Surface style={styles.tennisBoard} elevation={4}>
                <View style={styles.tennisRow}>
                    <Text style={styles.tennisName}>{state.p1Name}</Text>
                    <View style={{flexDirection: 'row'}}>
                        {state.sets.map((s, i) => <Text key={i} style={styles.setScore}>{s.p1}</Text>)}
                        <Text style={styles.gameScore}>{POINTS[state.currentGame.p1] || state.currentGame.p1}</Text>
                    </View>
                </View>
                <Divider />
                <View style={styles.tennisRow}>
                    <Text style={styles.tennisName}>{state.p2Name}</Text>
                    <View style={{flexDirection: 'row'}}>
                        {state.sets.map((s, i) => <Text key={i} style={styles.setScore}>{s.p2}</Text>)}
                        <Text style={styles.gameScore}>{POINTS[state.currentGame.p2] || state.currentGame.p2}</Text>
                    </View>
                </View>
            </Surface>

            <View style={styles.controls}>
                <Button mode="contained" onPress={() => addPoint('p1')} style={styles.pointBtn}>
                    Point {state.p1Name}
                </Button>
                <Button mode="contained" onPress={() => addPoint('p2')} style={styles.pointBtn} buttonColor="#ef5350">
                    Point {state.p2Name}
                </Button>
            </View>
        </View>
    );
};

const GenericScorer = ({ match, onUpdate }) => {
    const [score, setScore] = useState(match.scoreData || { p1: 0, p2: 0 });

    const update = (p, val) => {
        const n = { ...score, [p]: (score[p] || 0) + val };
        if (n[p] < 0) n[p] = 0;
        setScore(n);
        onUpdate(n);
    };

    return (
        <View style={styles.scorerContainer}>
            <View style={styles.genericRow}>
                <Text style={styles.genericName}>{match.participant1Name}</Text>
                <Title style={{fontSize: 60}}>{score.p1}</Title>
                <View style={{flexDirection: 'row'}}>
                    <IconButton icon="minus" mode="contained" onPress={() => update('p1', -1)} />
                    <IconButton icon="plus" mode="contained" onPress={() => update('p1', 1)} />
                </View>
            </View>
            <Divider style={{marginVertical: 20}} />
            <View style={styles.genericRow}>
                <Text style={styles.genericName}>{match.participant2Name}</Text>
                <Title style={{fontSize: 60}}>{score.p2}</Title>
                <View style={{flexDirection: 'row'}}>
                    <IconButton icon="minus" mode="contained" onPress={() => update('p2', -1)} />
                    <IconButton icon="plus" mode="contained" onPress={() => update('p2', 1)} />
                </View>
            </View>
        </View>
    );
};

// --- MAIN SCREEN ---

export default function ScoreMatchScreen() {
    const { id, matchId } = useLocalSearchParams();
    const router = useRouter();
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'tournaments', id, 'matches', matchId), (docSnap) => {
            if (docSnap.exists()) {
                setMatch({ id: docSnap.id, ...docSnap.data() });
            } else {
                Alert.alert("Error", "Match not found");
                router.back();
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, matchId]);

    const handleScoreUpdate = async (newScoreData) => {
        try {
            await updateDoc(doc(db, 'tournaments', id, 'matches', matchId), {
                scoreData: newScoreData,
                status: 'live' // Automatically set to live on update
            });
        } catch (error) {
            console.error("Score update failed", error);
        }
    };

    const handleFinish = async () => {
        Alert.alert("Finish Match", "Are you sure? This will mark the match as Completed.", [
            { text: "Cancel" },
            {
                text: "Finish",
                onPress: async () => {
                    await updateDoc(doc(db, 'tournaments', id, 'matches', matchId), {
                        status: 'completed',
                        endTime: new Date().toISOString()
                    });
                    router.back();
                }
            }
        ]);
    };

    if (loading) return <ActivityIndicator style={{marginTop: 50}} />;
    if (!match) return null;

    const sport = match.sport || 'Generic';
    const isCricket = ['Cricket'].includes(sport);
    const isTennis = ['Tennis', 'Badminton', 'Pickleball', 'Table Tennis'].includes(sport);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>{sport} Scorer</Title>
                <Button mode="text" onPress={handleFinish} textColor="red">Finish</Button>
            </View>

            <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                {isCricket ? (
                    <CricketScorer match={match} onUpdate={handleScoreUpdate} />
                ) : isTennis ? (
                    <TennisScorer match={match} onUpdate={handleScoreUpdate} />
                ) : (
                    <GenericScorer match={match} onUpdate={handleScoreUpdate} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: 'white' },
    scorerContainer: { padding: 20, alignItems: 'center' },

    // Cricket Styles
    scoreBoard: { padding: 20, borderRadius: 16, alignItems: 'center', width: '100%', marginBottom: 30 },
    overContainer: { flexDirection: 'row', marginTop: 15, gap: 5 },
    ballBubble: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
    controls: { width: '100%', gap: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
    controlBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white', elevation: 2, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 24, fontWeight: 'bold' },

    // Tennis Styles
    tennisBoard: { width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 30 },
    tennisRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    tennisName: { fontSize: 18, fontWeight: 'bold', flex: 1 },
    setScore: { fontSize: 20, color: 'gray', marginHorizontal: 10 },
    gameScore: { fontSize: 24, fontWeight: 'bold', color: '#1A237E', width: 40, textAlign: 'right' },
    pointBtn: { width: '100%', marginVertical: 5, paddingVertical: 8 },

    // Generic Styles
    genericRow: { alignItems: 'center', width: '100%' },
    genericName: { fontSize: 20, marginBottom: 10 }
});
