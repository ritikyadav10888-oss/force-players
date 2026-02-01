import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, Text, Surface, ActivityIndicator, Menu, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, getDocs, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function CreateMatchScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);

    const [p1, setP1] = useState(null);
    const [p2, setP2] = useState(null);
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    // Dropdown visibility
    const [p1Menu, setP1Menu] = useState(false);
    const [p2Menu, setP2Menu] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Get Tournament Info
            const tDoc = await getDoc(doc(db, 'tournaments', id));
            if (!tDoc.exists()) {
                Alert.alert("Error", "Tournament not found");
                return;
            }
            const tData = tDoc.data();
            setTournament(tData);

            let partList = [];
            // Determine Participant Type
            // If Team Sport or Team Entry -> Fetch Teams
            if (tData.entryType === 'Team' || ['Cricket', 'Football', 'Kabaddi'].includes(tData.gameName)) {
                 const q = query(collection(db, 'tournaments', id, 'teams'));
                 const snap = await getDocs(q);
                 partList = snap.docs.map(d => ({ id: d.id, name: d.data().name, type: 'team' }));
            } else {
                // Else Fetch Players
                 const q = query(collection(db, 'tournaments', id, 'players'));
                 const snap = await getDocs(q);
                 // Only fetch paid players ideally, but allow all for flexibility
                 partList = snap.docs.map(d => ({ id: d.id, name: d.data().playerName, type: 'player' }));
            }
            setParticipants(partList);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!p1 || !p2) {
            Alert.alert("Error", "Please select both participants.");
            return;
        }
        if (p1.id === p2.id) {
            Alert.alert("Error", "Participants must be different.");
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'tournaments', id, 'matches'), {
                participant1Id: p1.id,
                participant1Name: p1.name,
                participant2Id: p2.id,
                participant2Name: p2.name,
                participantType: participants[0]?.type || 'unknown', // team or player
                startTime: date.toISOString(),
                status: 'scheduled',
                sport: tournament.gameName || 'unknown',
                createdAt: new Date().toISOString()
            });
            Alert.alert("Success", "Match scheduled!", [{ text: "OK", onPress: () => router.back() }]);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to schedule match.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>Schedule Match</Title>
            </View>
            {loading ? <ActivityIndicator style={{marginTop: 50}} /> : (
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.label}>Participant 1</Text>
                    <Menu
                        visible={p1Menu}
                        onDismiss={() => setP1Menu(false)}
                        anchor={
                            <TouchableOpacity onPress={() => setP1Menu(true)} style={styles.dropdown}>
                                <Text>{p1 ? p1.name : "Select Participant"}</Text>
                            </TouchableOpacity>
                        }
                    >
                        <ScrollView style={{maxHeight: 200}}>
                            {participants.map(p => (
                                <Menu.Item key={p.id} onPress={() => { setP1(p); setP1Menu(false); }} title={p.name} />
                            ))}
                        </ScrollView>
                    </Menu>

                    <Text style={styles.label}>Participant 2</Text>
                    <Menu
                        visible={p2Menu}
                        onDismiss={() => setP2Menu(false)}
                        anchor={
                            <TouchableOpacity onPress={() => setP2Menu(true)} style={styles.dropdown}>
                                <Text>{p2 ? p2.name : "Select Participant"}</Text>
                            </TouchableOpacity>
                        }
                    >
                        <ScrollView style={{maxHeight: 200}}>
                            {participants.map(p => (
                                <Menu.Item key={p.id} onPress={() => { setP2(p); setP2Menu(false); }} title={p.name} />
                            ))}
                        </ScrollView>
                    </Menu>

                    <Text style={styles.label}>Start Time</Text>
                    <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dropdown}>
                        <Text>{date.toLocaleString()}</Text>
                    </TouchableOpacity>
                    {showPicker && (
                        <DateTimePicker
                            value={date}
                            mode="datetime"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowPicker(Platform.OS === 'ios');
                                if (selectedDate) setDate(selectedDate);
                            }}
                        />
                    )}

                    <Button mode="contained" onPress={handleCreate} loading={submitting} disabled={submitting} style={styles.btn}>
                        Schedule Match
                    </Button>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'white' },
    content: { padding: 20 },
    label: { marginBottom: 5, fontWeight: 'bold', color: 'gray' },
    dropdown: { padding: 15, backgroundColor: 'white', borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#e0e0e0' },
    btn: { marginTop: 20 }
});
