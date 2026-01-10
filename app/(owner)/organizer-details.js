import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert, TouchableOpacity, Platform } from 'react-native';
import { doc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { Title, Text, Surface, useTheme, ActivityIndicator, IconButton, Avatar, Divider, Button, TextInput } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function OrganizerDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const theme = useTheme();

    const [organizer, setOrganizer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [revealSensitive, setRevealSensitive] = useState(false);

    const [assignedTournaments, setAssignedTournaments] = useState([]);

    useEffect(() => {
        if (id) {
            fetchOrganizerDetails();
            fetchAssignedTournaments();
        }
    }, [id]);

    const fetchAssignedTournaments = async () => {
        try {
            const q = query(collection(db, 'tournaments'), where('organizerId', '==', id));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAssignedTournaments(list);
        } catch (e) { console.log(e); }
    };

    const fetchOrganizerDetails = async () => {
        try {
            const docRef = doc(db, 'users', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setOrganizer({ id: docSnap.id, ...docSnap.data() });
            } else {
                Alert.alert('Error', 'Organizer not found');
                router.back();
            }
        } catch (error) {
            console.error("Error fetching organizer:", error);
            Alert.alert('Error', 'Failed to fetch details');
        } finally {
            setLoading(false);
        }
    };

    const executeDeleteTournament = async (tId) => {
        try {
            await deleteDoc(doc(db, 'tournaments', tId));
            fetchAssignedTournaments();
            if (Platform.OS !== 'web') Alert.alert("Success", "Tournament deleted successfully.");
        } catch (error) {
            console.error(error);
            if (Platform.OS !== 'web') Alert.alert("Error", "Failed to delete tournament.");
            else alert("Failed to delete tournament: " + error.message);
        }
    };

    const handleDeleteTournament = (tId) => {
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this tournament? This action cannot be undone.")) {
                executeDeleteTournament(tId);
            }
        } else {
            Alert.alert(
                "Delete Tournament",
                "Are you sure you want to delete this tournament? This action cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => executeDeleteTournament(tId)
                    }
                ]
            );
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    if (!organizer) return null;

    const InfoRow = ({ icon, label, value }) => (
        <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name={icon} size={24} color={theme.colors.primary} style={{ marginRight: 15 }} />
                <View>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.value}>{value || 'Not provided'}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F5F7FA' }]}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Profile Card */}
                <Surface style={styles.profileCard} elevation={2}>
                    <View style={styles.avatarContainer}>
                        {organizer.profilePic ? (
                            <TouchableOpacity onPress={() => {/* Ideally open full image */ }}>
                                <Image source={{ uri: organizer.profilePic }} style={styles.avatar} />
                            </TouchableOpacity>
                        ) : (
                            <Avatar.Text size={100} label={organizer.name?.[0] || 'O'} style={{ backgroundColor: theme.colors.primary }} />
                        )}
                        <IconButton
                            icon="pencil"
                            mode="contained"
                            style={{ position: 'absolute', top: 0, right: 0, margin: 0 }}
                            onPress={() => router.push({ pathname: '/(owner)/create-organizer', params: { editId: organizer.id } })}
                        />
                        <View style={styles.nameSection}>
                            <Title style={styles.name}>{organizer.name}</Title>
                            <Text style={styles.role}>Registered Organizer</Text>
                            {organizer.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <MaterialCommunityIcons name="check-decagram" size={16} color="white" />
                                    <Text style={{ color: 'white', marginLeft: 4, fontWeight: 'bold', fontSize: 12 }}>VERIFIED</Text>
                                </View>
                            )}
                            <Button
                                mode="contained"
                                icon="plus"
                                style={{ marginTop: 15 }}
                                onPress={() => router.push({ pathname: '/(owner)/create-tournament', params: { organizerId: organizer.id } })}
                            >
                                Assign Tournament
                            </Button>
                        </View>
                    </View>
                </Surface>

                {/* Status Overview */}
                <View style={styles.statsRow}>
                    <Surface style={styles.statCard} elevation={1}>
                        <MaterialCommunityIcons name="calendar-clock" size={24} color={theme.colors.primary} />
                        <Title style={styles.statNumber}>{new Date(organizer.createdAt).toLocaleDateString()}</Title>
                        <Text style={styles.statLabel}>Joined Date</Text>
                    </Surface>
                    <Surface style={styles.statCard} elevation={1}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={24} color={theme.colors.error} />
                        <Title style={[styles.statNumber, { fontSize: 16 }]}>
                            {organizer.accessExpiryDate ? new Date(organizer.accessExpiryDate).toLocaleDateString() : 'Unlimited'}
                        </Title>
                        <Text style={styles.statLabel}>Access Expires</Text>
                    </Surface>
                </View>

                {/* Personal Info */}
                <Surface style={styles.sectionCard} elevation={1}>
                    <Title style={styles.sectionTitle}>Contact Directory</Title>
                    <InfoRow icon="email" label="Email Address" value={organizer.email} />
                    <Divider style={styles.divider} />
                    <InfoRow icon="phone" label="Phone Number" value={organizer.phone} />
                    <Divider style={styles.divider} />
                    <InfoRow icon="map-marker" label="Values Address" value={organizer.address} />
                </Surface>

                {/* Assigned Tournaments Section */}
                <Surface style={styles.sectionCard} elevation={1}>
                    <Title style={styles.sectionTitle}>Assigned Tournaments</Title>
                    {assignedTournaments.length === 0 ? (
                        <Text style={{ color: 'gray', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>No tournaments assigned yet.</Text>
                    ) : (
                        assignedTournaments.map((t) => (
                            <View key={t.id} style={styles.tournamentItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tournamentName}>{t.name}</Text>
                                    <Text style={styles.tournamentMeta}>{t.gameName} • {t.entryType}</Text>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                    <IconButton
                                        icon="pencil"
                                        size={18}
                                        onPress={() => router.push({ pathname: '/(owner)/create-tournament', params: { id: t.id } })}
                                    />
                                    <IconButton
                                        icon="delete"
                                        size={18}
                                        iconColor={theme.colors.error}
                                        onPress={() => handleDeleteTournament(t.id)}
                                    />
                                </View>
                            </View>
                        ))
                    )}
                </Surface>

                {/* Payment Configuration (Owner Only) */}
                <Surface style={styles.sectionCard} elevation={1}>
                    <Title style={styles.sectionTitle}>Payment Configuration</Title>
                    <Text style={{ fontSize: 13, color: 'gray', marginBottom: 15 }}>
                        Link the organizer's Razorpay Route Account ID to enable automated settlements (95% share).
                    </Text>

                    <View style={styles.inputContainer}>
                        <MaterialCommunityIcons name="bank-transfer" size={24} color="#6200ea" style={{ marginRight: 10 }} />
                        <TextInput
                            label="Connected Account ID (e.g. acc_K...)"
                            value={organizer.paymentDetails?.connectedAccountId || ''}
                            onChangeText={(text) => setOrganizer(prev => ({ ...prev, paymentDetails: { ...prev.paymentDetails, connectedAccountId: text } }))}
                            mode="outlined"
                            style={{ flex: 1, backgroundColor: 'white' }}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15 }}>
                        <Button
                            mode="contained"
                            onPress={async () => {
                                try {
                                    const ref = doc(db, 'users', organizer.id);
                                    await updateDoc(ref, {
                                        paymentDetails: {
                                            connectedAccountId: organizer.paymentDetails?.connectedAccountId || '',
                                            updatedAt: new Date().toISOString()
                                        }
                                    });
                                    Alert.alert("Success", "Payment configuration saved.");
                                } catch (e) {
                                    Alert.alert("Error", "Failed to save payment config.");
                                }
                            }}
                        >
                            Save Configuration
                        </Button>
                    </View>
                </Surface>

                {/* Sensitive Data Secured */}
                <Surface style={styles.sectionCard} elevation={1}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Title style={styles.sectionTitle}>Banking & ID</Title>
                        <Button
                            mode="contained-tonal"
                            compact
                            onPress={() => setRevealSensitive(!revealSensitive)}
                            icon={revealSensitive ? "eye-off" : "eye"}
                        >
                            {revealSensitive ? "Hide Details" : "Reveal"}
                        </Button>
                    </View>

                    {revealSensitive ? (
                        <>
                            <InfoRow icon="card-account-details" label="Aadhar Number" value={organizer.aadharNumber} />
                            <Divider style={styles.divider} />
                            <InfoRow icon="bank" label="Bank Name" value={organizer.bankDetails?.bankName} />
                            <Divider style={styles.divider} />
                            <InfoRow icon="numeric" label="Account Number" value={organizer.bankDetails?.accountNumber} />
                            <Divider style={styles.divider} />
                            <InfoRow icon="barcode" label="IFSC Code" value={organizer.bankDetails?.ifsc} />

                            {organizer.aadharPhoto && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={[styles.label, { marginBottom: 10 }]}>Aadhar Photo Document</Text>
                                    <View style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' }}>
                                        <Image source={{ uri: organizer.aadharPhoto }} style={styles.idCardImage} resizeMode="contain" />
                                    </View>
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={{ padding: 30, alignItems: 'center', backgroundColor: '#fafafa', borderRadius: 10 }}>
                            <MaterialCommunityIcons name="shield-lock" size={50} color="#ddd" />
                            <Text style={{ color: 'gray', marginTop: 10, textAlign: 'center' }}>
                                Sensitive information is hidden for security.{'\n'}Click 'Reveal' to view.
                            </Text>
                        </View>
                    )}
                </Surface>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: 'white', elevation: 2 },
    content: { padding: 20, maxWidth: 800, alignSelf: 'center', width: '100%' },
    profileCard: { padding: 30, borderRadius: 20, backgroundColor: 'white', marginBottom: 20, alignItems: 'center' },
    avatarContainer: { alignItems: 'center' },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#f0f0f0' },
    nameSection: { alignItems: 'center', marginTop: 15 },
    name: { fontSize: 26, fontWeight: 'bold' },
    role: { color: 'gray', fontSize: 16 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, marginTop: 10 },
    statsRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: 'white', padding: 20, borderRadius: 15, alignItems: 'center' },
    statNumber: { fontSize: 18, marginTop: 10 },
    statLabel: { color: 'gray', fontSize: 12 },
    sectionCard: { padding: 25, borderRadius: 16, backgroundColor: 'white', marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#333' },
    infoRow: { paddingVertical: 10 },
    label: { fontSize: 12, color: '#777', textTransform: 'uppercase', letterSpacing: 0.5 },
    value: { fontSize: 16, color: '#333', marginTop: 4, fontWeight: '500' },
    divider: { marginVertical: 10, backgroundColor: '#f0f0f0' },
    idCardImage: { width: '100%', height: 250, backgroundColor: '#f5f5f5' },
    tournamentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    tournamentName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    tournamentMeta: { fontSize: 12, color: 'gray' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 }
});
