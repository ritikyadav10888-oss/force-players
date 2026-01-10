import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Dimensions, ScrollView, Share, Platform, Alert } from 'react-native';
import { Title, Text, Surface, useTheme, Button, ActivityIndicator, IconButton, Avatar, Card } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function OrganizerPublicProfile() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const [tournaments, setTournaments] = useState([]);
    const [organizer, setOrganizer] = useState(null);
    const [loading, setLoading] = useState(true);
    const { width } = Dimensions.get('window');

    const fetchOrganizerData = async () => {
        try {
            // Fetch Organizer Info
            const orgDoc = await getDoc(doc(db, 'users', id));
            if (orgDoc.exists()) {
                setOrganizer(orgDoc.data());
            }

            // Fetch Organizer's tournaments
            const q = query(collection(db, 'tournaments'), where('organizerId', '==', id));
            const querySnapshot = await getDocs(q);
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTournaments(list.filter(t => !t.isDraft));
        } catch (error) {
            console.error("Error fetching organizer data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchOrganizerData();
    }, [id]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/tournament/${item.id}`)}
        >
            <Surface style={styles.card} elevation={3}>
                <View style={styles.bannerContainer}>
                    {item.bannerUrl || item.banner ? (
                        <Image source={{ uri: item.bannerUrl || item.banner }} style={styles.banner} resizeMode="cover" />
                    ) : (
                        <LinearGradient colors={['#304FFE', '#000051']} style={styles.placeholderBanner}>
                            <MaterialCommunityIcons name="trophy-variant" size={40} color="rgba(255,255,255,0.3)" />
                        </LinearGradient>
                    )}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bannerGradient} />

                    <View style={styles.feeBadge}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>ENTRY</Text>
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>₹{item.entryFee}</Text>
                    </View>

                    <View style={styles.bannerInfo}>
                        <Title style={styles.cardTitle} numberOfLines={1}>{item.name}</Title>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{item.gameName} • ₹{item.winningPrize} Prize</Text>
                    </View>
                </View>
                <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <MaterialCommunityIcons name="calendar" size={16} color={theme.colors.primary} />
                            <Text style={styles.infoText}>{item.startDate}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <MaterialCommunityIcons name="map-marker" size={16} color="#d32f2f" />
                            <Text style={styles.infoText} numberOfLines={1}>{item.city || 'Location TBA'}</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Button mode="contained" onPress={() => router.push(`/tournament/${item.id}`)} style={{ flex: 1, marginTop: 15, borderRadius: 12 }} buttonColor={theme.colors.primary}>
                            Register Now
                        </Button>
                        <IconButton
                            icon="share-variant"
                            mode="contained-tonal"
                            onPress={() => {
                                const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
                                const url = `${domain}/tournament/${item.id}`;
                                Share.share({ message: `Join ${item.name}! Register here: ${url}`, url });
                            }}
                            style={{ marginLeft: 10, marginTop: 15, borderRadius: 12 }}
                            containerColor="#F5F7FA"
                            iconColor={theme.colors.primary}
                            size={24}
                        />
                    </View>
                </View>
            </Surface>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.loadingCenter}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 10, color: '#666' }}>Loading Organizer Profile...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <LinearGradient
                    colors={['#1A237E', '#3F51B5']}
                    style={styles.profileHeader}
                >
                    <View style={styles.headerContent}>
                        <Avatar.Text
                            size={80}
                            label={organizer?.name?.[0] || 'O'}
                            style={{ backgroundColor: 'white', elevation: 10 }}
                            labelStyle={{ color: '#1A237E', fontWeight: 'bold' }}
                        />
                        <Title style={styles.orgName}>{organizer?.name || 'Organizer'}</Title>
                        <Text style={styles.orgStats}>{tournaments.length} Tournaments Hosted</Text>

                        <View style={styles.contactRow}>
                            {organizer?.phone && (
                                <IconButton icon="phone" iconColor="white" style={styles.contactIcon} onPress={() => { }} />
                            )}
                            {organizer?.email && (
                                <IconButton icon="email" iconColor="white" style={styles.contactIcon} onPress={() => { }} />
                            )}
                            <IconButton
                                icon="share-variant"
                                iconColor="white"
                                style={styles.contactIcon}
                                onPress={() => {
                                    const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
                                    const url = `${domain}/organizer/${id}`;
                                    Share.share({ message: `Check out all tournaments by ${organizer?.name}: ${url}`, url });
                                }}
                            />
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.content}>
                    <Title style={styles.sectionTitle}>Active Tournaments</Title>
                    {tournaments.length > 0 ? (
                        tournaments.map(item => (
                            <View key={item.id}>
                                {renderItem({ item })}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="calendar-blank" size={60} color="#ccc" />
                            <Text style={styles.emptyText}>No active tournaments at the moment.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: { padding: 30, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, alignItems: 'center', elevation: 10 },
    headerContent: { alignItems: 'center' },
    orgName: { color: 'white', fontWeight: 'bold', fontSize: 24, marginTop: 15 },
    orgStats: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 5 },
    contactRow: { flexDirection: 'row', marginTop: 15 },
    contactIcon: { backgroundColor: 'rgba(255,255,255,0.2)' },

    content: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#333' },

    card: { backgroundColor: 'white', marginBottom: 25, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
    bannerContainer: { height: 160, position: 'relative' },
    banner: { width: '100%', height: '100%' },
    placeholderBanner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    bannerGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
    feeBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    bannerInfo: { position: 'absolute', bottom: 15, left: 15, right: 15 },
    cardTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },

    cardContent: { padding: 15 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoItem: { flexDirection: 'row', alignItems: 'center' },
    infoText: { marginLeft: 5, color: '#666', fontSize: 13, maxWidth: 120 },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});
