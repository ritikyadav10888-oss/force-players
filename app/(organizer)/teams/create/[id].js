import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity, Platform } from 'react-native';
import { TextInput, Button, Title, Text, Surface, Avatar, Checkbox, Searchbar, ActivityIndicator, useTheme, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { db, storage } from '../../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

export default function CreateTeamScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();

    const [name, setName] = useState('');
    const [logo, setLogo] = useState(null);
    const [players, setPlayers] = useState([]);
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchPlayers();
    }, []);

    const fetchPlayers = async () => {
        try {
            const q = query(collection(db, 'tournaments', id, 'players'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPlayers(list);
        } catch (error) {
            Alert.alert("Error", "Could not fetch players.");
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            let uri = result.assets[0].uri;
            if (Platform.OS === 'web' && result.assets[0].base64) {
                 uri = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
            }
            setLogo(uri);
        }
    };

    const togglePlayer = (playerId) => {
        if (selectedPlayers.includes(playerId)) {
            setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
        } else {
            setSelectedPlayers([...selectedPlayers, playerId]);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Please enter a team name.");
            return;
        }
        if (selectedPlayers.length === 0) {
            Alert.alert("Error", "Please select at least one player.");
            return;
        }

        setSubmitting(true);
        try {
            let logoUrl = null;
            if (logo) {
                const storageRef = ref(storage, `tournaments/${id}/teams/${Date.now()}.jpg`);
                if (logo.startsWith('data:')) {
                    await uploadString(storageRef, logo, 'data_url');
                } else {
                    const response = await fetch(logo);
                    const blob = await response.blob();
                    await uploadBytes(storageRef, blob);
                }
                logoUrl = await getDownloadURL(storageRef);
            }

            await addDoc(collection(db, 'tournaments', id, 'teams'), {
                name,
                logo: logoUrl,
                playerIds: selectedPlayers,
                createdAt: new Date().toISOString()
            });

            Alert.alert("Success", "Team created successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to create team.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredPlayers = players.filter(p => p.playerName?.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <SafeAreaView style={styles.container}>
             <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Title>Create Team</Title>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.logoContainer}>
                    <TouchableOpacity onPress={pickImage}>
                        {logo ? (
                            <Image source={{ uri: logo }} style={styles.logo} />
                        ) : (
                            <Surface style={styles.logoPlaceholder}>
                                <Avatar.Icon icon="camera" size={40} />
                                <Text style={{marginTop: 5}}>Add Logo</Text>
                            </Surface>
                        )}
                    </TouchableOpacity>
                </View>

                <TextInput
                    label="Team Name"
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    style={styles.input}
                />

                <Title style={styles.sectionTitle}>Select Players ({selectedPlayers.length})</Title>
                <Searchbar
                    placeholder="Search players..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />

                {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
                    filteredPlayers.map(player => (
                        <Surface key={player.id} style={styles.playerItem} elevation={1}>
                            <Checkbox
                                status={selectedPlayers.includes(player.id) ? 'checked' : 'unchecked'}
                                onPress={() => togglePlayer(player.id)}
                            />
                            <View style={{flex: 1, marginLeft: 10}}>
                                <Text style={{fontWeight: 'bold'}}>{player.playerName}</Text>
                                <Text style={{fontSize: 12, color: 'gray'}}>{player.phone}</Text>
                            </View>
                             {player.paid ? <Text style={{color: 'green', fontSize: 10, fontWeight: 'bold'}}>PAID</Text> : <Text style={{color: 'orange', fontSize: 10}}>PENDING</Text>}
                        </Surface>
                    ))
                )}
            </ScrollView>
            <View style={styles.footer}>
                 <Button mode="contained" onPress={handleCreate} loading={submitting} disabled={submitting}>Create Team</Button>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'white' },
    content: { padding: 20 },
    logoContainer: { alignItems: 'center', marginBottom: 20 },
    logo: { width: 100, height: 100, borderRadius: 50 },
    logoPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
    input: { marginBottom: 20, backgroundColor: 'white' },
    sectionTitle: { fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
    searchBar: { marginBottom: 15, backgroundColor: 'white' },
    playerItem: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 8, backgroundColor: 'white', borderRadius: 8 },
    footer: { padding: 15, backgroundColor: 'white', elevation: 5 }
});
