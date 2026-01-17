import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Share, Platform, Linking, Alert } from 'react-native';
import { Title, Text, Surface, useTheme, Button, ActivityIndicator, IconButton, Chip, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PlayerHome() {
    const router = useRouter();
    const { user, userData, logout } = useAuth();
    const theme = useTheme();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTournaments = async () => {
        try {
            // Fetch all upcoming tournaments
            const q = query(collection(db, 'tournaments')); // Can filter by status 'upcoming'
            const querySnapshot = await getDocs(q);
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // list.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
            setTournaments(list);
        } catch (error) {
            console.error("Error fetching tournaments:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchTournaments();
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/tournament/${item.id}`)}
        >
            <Surface style={styles.card} elevation={3}>
                {/* Banner Image / Placeholder */}
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
                        <Chip mode="flat" style={styles.prizeChip} textStyle={styles.prizeText}>
                            ₹{item.winningPrize || '0'} PRIZE
                        </Chip>
                        <Title style={styles.cardTitle} numberOfLines={1}>{item.name}</Title>
                    </View>
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoBox}>
                            <MaterialCommunityIcons name="gamepad-variant-outline" size={18} color={theme.colors.primary} />
                            <Text style={styles.infoValue}>{item.gameName}</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <MaterialCommunityIcons name="calendar-clock" size={18} color="#FF9800" />
                            <Text style={styles.infoValue}>{item.startDate}</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Button
                            mode="contained"
                            icon="medal"
                            onPress={() => router.push(`/tournament/${item.id}`)}
                            style={[styles.registerBtn, { flex: 1 }]}
                            contentStyle={{ height: 48 }}
                            buttonColor={theme.colors.primary}
                        >
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
                            style={{ marginLeft: 10, borderRadius: 12 }}
                            containerColor="#F5F7FA"
                            iconColor={theme.colors.primary}
                            size={24}
                        />
                        <IconButton
                            icon="content-copy"
                            mode="contained-tonal"
                            onPress={() => {
                                const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
                                const url = `${domain}/tournament/${item.id}`;
                                Share.share({ message: url });
                                Alert.alert("Copied", "Tournament link copied to clipboard!");
                            }}
                            style={{ marginLeft: 5, borderRadius: 12 }}
                            containerColor="#F5F7FA"
                            iconColor="#666"
                            size={24}
                        />
                    </View>
                </View>
            </Surface>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F8F9FA' }]}>
            <LinearGradient
                colors={['#0D47A1', '#1976D2', '#42A5F5']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Surface style={styles.logoContainer} elevation={8}>
                            <Image
                                source={require('../../assets/logo.png')}
                                style={styles.logo}
                            />
                        </Surface>
                        <View>
                            <Text style={styles.headerLabel}>WELCOME TO</Text>
                            <Title style={styles.headerTitle}>Force Tournaments</Title>
                        </View>
                    </View>
                    <View style={styles.headerActions}>
                        {(userData?.role === 'organizer' || userData?.role === 'owner') && (
                            <Button
                                mode="contained"
                                onPress={() => router.replace(userData.role === 'owner' ? '/(owner)' : '/(organizer)')}
                                style={{ marginRight: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' }}
                                textColor="white"
                                icon="view-dashboard"
                            >
                                Dashboard
                            </Button>
                        )}
                        {user ? (
                            <IconButton
                                icon="logout-variant"
                                iconColor="white"
                                onPress={logout}
                                style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                            />
                        ) : (
                            <Button
                                mode="contained"
                                onPress={() => router.push('/(auth)/login')}
                                style={{ borderRadius: 12 }}
                                buttonColor="white"
                                textColor={theme.colors.primary}
                            >
                                Login
                            </Button>
                        )}
                    </View>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" /></View>
            ) : (
                <FlatList
                    data={tournaments}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.contentStyle}
                    ListHeaderComponent={
                        userData?.role === 'organizer' && tournaments.length > 0 && user ? (
                            <Surface style={styles.masterLinkCard} elevation={2}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.masterIconCircle}>
                                        <MaterialCommunityIcons name="bullhorn-variant" size={22} color="white" />
                                    </View>
                                    <View style={{ marginLeft: 12, flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A237E' }}>Share All Tournaments</Text>
                                        <Text style={{ fontSize: 10, color: '#666' }}>Your public registration profile</Text>
                                    </View>
                                    <IconButton
                                        icon="whatsapp"
                                        containerColor="#25D366"
                                        iconColor="white"
                                        size={18}
                                        onPress={() => {
                                            const url = `${Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app'}/organizer/${user?.uid}`;
                                            const msg = encodeURIComponent(`Check out my upcoming tournaments: ${url}`);
                                            if (Platform.OS === 'web') window.open(`https://wa.me/?text=${msg}`, '_blank');
                                            else Linking.openURL(`whatsapp://send?text=${msg}`);
                                        }}
                                    />
                                </View>
                                <View style={styles.masterLinkRow}>
                                    <Text style={styles.masterLinkText} numberOfLines={1}>
                                        {Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app'}/organizer/{user?.uid}
                                    </Text>
                                    <TouchableOpacity
                                        style={{ backgroundColor: 'white', padding: 6, borderRadius: 8, elevation: 2 }}
                                        onPress={() => {
                                            const url = `${Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app'}/organizer/${user?.uid}`;
                                            Share.share({ message: `Check out my upcoming tournaments: ${url}`, url });
                                        }}
                                    >
                                        <MaterialCommunityIcons name="content-copy" size={18} color="#1A237E" />
                                    </TouchableOpacity>
                                </View>
                            </Surface>
                        ) : null
                    }
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <MaterialCommunityIcons name="trophy-broken" size={50} color="#ccc" />
                            <Text style={{ color: 'gray', marginTop: 10 }}>No upcoming tournaments.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 40,
        paddingBottom: 40,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15
    },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 800, width: '100%', alignSelf: 'center' },
    logoContainer: { borderRadius: 22, marginRight: 15, padding: 0, elevation: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
    logo: { width: 44, height: 44, borderRadius: 20 },
    headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1.5, fontWeight: 'bold', marginBottom: 2 },
    headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 22, letterSpacing: 0.5 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },

    contentStyle: {
        padding: 20,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
        paddingBottom: 100
    },

    masterLinkCard: { marginBottom: 20, padding: 15, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#e0e0e0' },
    masterIconCircle: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#3F51B5', justifyContent: 'center', alignItems: 'center' },
    masterLinkText: { flex: 1, fontSize: 12, color: '#1A237E', fontWeight: '500', marginRight: 10 },
    masterLinkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 8, paddingRight: 4, borderRadius: 12, marginTop: 10 },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    card: {
        backgroundColor: 'white',
        marginBottom: 25,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#eee'
    },
    bannerContainer: { height: 160, position: 'relative' },
    banner: { width: '100%', height: '100%' },
    placeholderBanner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    bannerGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },

    feeBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

    bannerInfo: { position: 'absolute', bottom: 15, left: 15, right: 15 },
    prizeChip: { backgroundColor: '#FFD700', height: 24, alignSelf: 'flex-start', marginBottom: 8 },
    prizeText: { fontSize: 10, fontWeight: '900', color: '#B8860B' },
    cardTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },

    cardContent: { padding: 20 },
    infoGrid: { flexDirection: 'row', marginBottom: 20, gap: 15 },
    infoBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 10, borderRadius: 12 },
    infoValue: { marginLeft: 8, fontSize: 12, fontWeight: '600', color: '#444' },

    registerBtn: { borderRadius: 12, elevation: 2 }
});
