import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { Title, Text, Surface, useTheme, Button, IconButton, Avatar, List, Divider, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function OrganizerProfile() {
    const router = useRouter();
    const { user, userData, logout } = useAuth();
    const theme = useTheme();
    const [revealSensitive, setRevealSensitive] = useState(false);

    if (!userData) return <View style={styles.center}><ActivityIndicator /></View>;

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
        <SafeAreaView style={[styles.container, { backgroundColor: '#F0F2F5' }]}>
            <View style={styles.header}>
                <Title>My Profile</Title>
                <IconButton icon="logout" iconColor={theme.colors.error} onPress={logout} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Profile Header */}
                <Surface style={styles.profileCard} elevation={2}>
                    <View style={styles.avatarContainer}>
                        {userData.profilePic ? (
                            <Image source={{ uri: userData.profilePic }} style={styles.avatar} />
                        ) : (
                            <Avatar.Text size={100} label={userData.name?.[0] || 'O'} style={{ backgroundColor: theme.colors.primary }} />
                        )}
                        <View style={styles.nameSection}>
                            <Title style={styles.name}>{userData.name}</Title>
                            <Text style={styles.role}>Organizer Account</Text>
                            {userData.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <MaterialCommunityIcons name="check-decagram" size={16} color="white" />
                                    <Text style={{ color: 'white', marginLeft: 4, fontWeight: 'bold', fontSize: 12 }}>VERIFIED</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Surface>

                {/* Personal Info */}
                <Surface style={styles.sectionCard} elevation={1}>
                    <Title style={styles.sectionTitle}>Contact Information</Title>
                    <InfoRow icon="email" label="Email Address" value={userData.email} />
                    <Divider style={styles.divider} />
                    <InfoRow icon="phone" label="Phone Number" value={userData.phone} />
                    <Divider style={styles.divider} />
                    <InfoRow icon="map-marker" label="Address" value={userData.address} />
                </Surface>

                {/* Bank & ID - Sensitive */}
                <Surface style={styles.sectionCard} elevation={1}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Title style={styles.sectionTitle}>Banking & ID</Title>
                        <Button mode="text" onPress={() => setRevealSensitive(!revealSensitive)} icon={revealSensitive ? "eye-off" : "eye"}>
                            {revealSensitive ? "Hide" : "Show"}
                        </Button>
                    </View>

                    {revealSensitive ? (
                        <>
                            <InfoRow icon="card-account-details" label="Aadhar Number" value={userData.aadharNumber} />
                            <Divider style={styles.divider} />
                            <InfoRow icon="bank" label="Bank Name" value={userData.bankDetails?.bankName} />
                            <Divider style={styles.divider} />
                            <InfoRow icon="numeric" label="Account Number" value={userData.bankDetails?.accountNumber} />
                            <Divider style={styles.divider} />
                            <InfoRow icon="barcode" label="IFSC Code" value={userData.bankDetails?.ifsc} />

                            {userData.aadharPhoto && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={styles.label}>Aadhar Photo</Text>
                                    <Image source={{ uri: userData.aadharPhoto }} style={styles.idCardImage} resizeMode="contain" />
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <MaterialCommunityIcons name="shield-lock" size={40} color="gray" />
                            <Text style={{ color: 'gray', marginTop: 10 }}>Sensitive details are hidden.</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'white' },
    content: { padding: 20, maxWidth: 800, alignSelf: 'center', width: '100%' },
    profileCard: { padding: 20, borderRadius: 16, backgroundColor: 'white', marginBottom: 20, alignItems: 'center' },
    avatarContainer: { alignItems: 'center' },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    nameSection: { alignItems: 'center', marginTop: 10 },
    name: { fontSize: 24, fontWeight: 'bold' },
    role: { color: 'gray' },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 8 },
    sectionCard: { padding: 20, borderRadius: 16, backgroundColor: 'white', marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    infoRow: { paddingVertical: 8 },
    label: { fontSize: 12, color: 'gray' },
    value: { fontSize: 16, color: '#333', marginTop: 2 },
    divider: { marginVertical: 8 },
    idCardImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#f0f0f0', marginTop: 5 }
});
