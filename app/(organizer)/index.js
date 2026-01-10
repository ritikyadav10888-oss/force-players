import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, Share, Platform, Alert, Dimensions, Linking, ScrollView } from 'react-native';
import { Title, Text, Surface, useTheme, Button, ActivityIndicator, IconButton, List, Divider, Chip, Badge, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import * as Firestore from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { db, storage } from '../../src/config/firebase';
import { SECURITY_CONFIG } from '../../src/config/security';
import { useAuth } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Portal, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';


export default function OrganizerDashboard() {
    const router = useRouter();
    const { user, userData, logout } = useAuth();
    const theme = useTheme();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [configModalVisible, setConfigModalVisible] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [teamsToConfigure, setTeamsToConfigure] = useState([]);
    const [uploading, setUploading] = useState(false);
    const { width } = Dimensions.get('window');

    // Real-time listener for tournaments
    useEffect(() => {
        console.log("OrganizerDashboard mounted - Refreshing Listener");
        if (!user || !userData) return;

        setLoading(true);
        let q;
        const role = (userData?.role || '').toLowerCase();
        const isOwner = role === 'owner' || role === 'admin' || (user?.email && SECURITY_CONFIG.OWNER_EMAILS.includes(user.email));

        if (isOwner) {
            q = query(collection(db, 'tournaments'));
        } else {
            q = query(collection(db, 'tournaments'), where('organizerId', '==', user.uid));
        }

        const unsubscribe = Firestore.onSnapshot(q, async (querySnapshot) => {
            console.log("Tournaments received from snapshot:", querySnapshot.size);
            const list = await Promise.all(querySnapshot.docs.map(async (d) => {
                const data = { id: d.id, ...d.data() };

                // Fetch player count for this tournament
                try {
                    const pSnap = await getDocs(collection(db, 'tournaments', d.id, 'players'));
                    const playersList = pSnap.docs.map(p => ({ id: p.id, ...p.data() }));

                    // Filter for PAID players only for stats calculation
                    const paidPlayers = playersList.filter(p => p.paid === true);

                    data.players = playersList; // Keep full list to show "Pending" users in UI
                    data.playerCount = paidPlayers.length;
                    data.totalCollected = (paidPlayers.length * (parseInt(data.entryFee) || 0));

                    // Fetch current enrollments if Team-Related
                    if (data.tournamentType === 'Team' || (data.tournamentType === 'Normal' && data.entryType === 'Team')) {
                        data.teamCounts = {};
                        data.teamPlayers = {}; // Store players per team

                        console.log('=== TEAM DEBUG ===');
                        console.log('All Players:', playersList.map(p => ({ name: p.playerName, team: p.teamName, paid: p.paid })));
                        console.log('Configured Teams:', data.teams);

                        if (data.teams) {
                            data.teams.forEach(team => {
                                const teamName = typeof team === 'string' ? team : team.name;
                                // Only count PAID members towards the team limit
                                // Use case-insensitive and trimmed comparison for robustness
                                const teamMembers = paidPlayers.filter(p => {
                                    const playerTeam = (p.teamName || '').trim().toLowerCase();
                                    const configuredTeam = (teamName || '').trim().toLowerCase();
                                    return playerTeam === configuredTeam;
                                });
                                data.teamCounts[teamName] = teamMembers.length;
                                data.teamPlayers[teamName] = teamMembers; // Store full player list
                                console.log(`Team: "${teamName}", Count: ${teamMembers.length}, Players:`, teamMembers.map(p => p.playerName));
                            });
                        }
                        console.log('=================');
                    }
                } catch (subError) {
                    console.warn(`Could not fetch details for tournament ${d.id}:`, subError);
                    data.players = [];
                    data.playerCount = 0;
                    data.totalCollected = 0;
                }

                return data;
            }));
            setTournaments(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tournaments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userData]);

    const openConfigModal = (item) => {
        setSelectedTournament(item);
        const max = item.maxTeams || (item.tournamentType === 'Team' ? 0 : 0);
        const initialTeams = Array.from({ length: max }, (_, i) => {
            const existing = item.teams?.[i];
            const isString = typeof existing === 'string';
            return {
                id: i + 1,
                name: (isString ? existing : existing?.name) || '',
                logo: (!isString ? existing?.logoUrl : null)
            };
        });
        setTeamsToConfigure(initialTeams);
        setConfigModalVisible(true);
    };

    const pickTeamLogo = async (index) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            const newTeams = [...teamsToConfigure];
            let uri = result.assets[0].uri;
            if (Platform.OS === 'web' && result.assets[0].base64) {
                uri = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
            }
            newTeams[index].logo = uri;
            setTeamsToConfigure(newTeams);
        }
    };

    const uploadFile = async (uri, path) => {
        if (!uri) return null;
        const storageRef = ref(storage, path);

        try {
            // Web: Handle Data URLs directly
            if (Platform.OS === 'web' && uri.startsWith('data:')) {
                await uploadString(storageRef, uri, 'data_url');
                return await getDownloadURL(storageRef);
            }

            const response = await fetch(uri);
            const blob = await response.blob();
            await uploadBytes(storageRef, blob);
            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Upload failed:", error);
            throw error;
        }
    };

    const saveTeamConfig = async () => {
        if (!selectedTournament) return;
        setUploading(true);
        try {
            const finalTeams = await Promise.all(teamsToConfigure.map(async (team) => {
                let logoUrl = team.logo;
                // Upload if it exists and is NOT already a remote URL
                if (team.logo && !team.logo.startsWith('http')) {
                    logoUrl = await uploadFile(team.logo, `tournaments/${selectedTournament.id}/teams/${Date.now()}_${team.id}.jpg`);
                }
                return {
                    id: team.id,
                    name: team.name || `Team ${team.id}`,
                    logoUrl: logoUrl
                };
            }));

            await updateDoc(doc(db, 'tournaments', selectedTournament.id), {
                teams: finalTeams
            });

            setConfigModalVisible(false);

            Alert.alert("Success", "Teams configured successfully!");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save team configuration.");
        } finally {
            setUploading(false);
        }
    };

    const handleShare = async (id, name, isOrganizer = false) => {
        const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
        const url = isOrganizer ? `${domain}/organizer/${id}` : `${domain}/tournament/${id}`;
        const message = isOrganizer
            ? `Check out all my upcoming tournaments: ${url}`
            : `Join ${name}! Register here: ${url}`;

        try {
            await Share.share({
                message: message,
                url: url
            });
        } catch (error) {
            console.error(error.message);
        }
    };

    const shareToWhatsApp = (id, name, isOrganizer = false) => {
        const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
        const url = isOrganizer ? `${domain}/organizer/${id}` : `${domain}/tournament/${id}`;
        const message = isOrganizer
            ? `Check out all my upcoming tournaments: ${url}`
            : `Join *${name}*! Register here: ${url}`;
        const encodedMsg = encodeURIComponent(message);

        if (Platform.OS === 'web') {
            window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
        } else {
            Linking.openURL(`whatsapp://send?text=${encodedMsg}`).catch(() => {
                Alert.alert('Error', 'WhatsApp is not installed');
            });
        }
    };


    const shareToFacebook = (id) => {
        const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
        const url = `${domain}/tournament/${id}`;
        const link = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        Linking.openURL(link);
    };

    const renderItem = ({ item }) => (
        <Surface style={styles.card} elevation={2}>
            {/* Banner Section */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/(organizer)/players/${item.id}`)}
                style={styles.bannerContainer}
            >
                {item.bannerUrl || item.banner ? (
                    <Image source={{ uri: item.bannerUrl || item.banner }} style={styles.banner} resizeMode="cover" />
                ) : (
                    <LinearGradient colors={['#304FFE', '#000051']} style={styles.placeholderBanner}>
                        <MaterialCommunityIcons name="trophy" size={60} color="rgba(255,255,255,0.2)" />
                    </LinearGradient>
                )}

                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.gradient} />

                <View style={styles.bannerContent}>
                    <Chip icon="crown" style={styles.prizeChip} textStyle={{ color: 'white', fontWeight: 'bold' }}>₹{item.winningPrize || '0'}</Chip>
                    <Title style={styles.cardTitle} numberOfLines={2}>{item.name}</Title>
                    <Text style={styles.gameName}><MaterialCommunityIcons name="gamepad-variant" /> {item.gameName} ( {item.entryType} )</Text>
                </View>

                <View style={styles.feeBadge}>
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>ENTRY</Text>
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>₹{item.entryFee}</Text>
                </View>

                {item.accessExpiryDate && (
                    <View style={[styles.expiryBadge, { backgroundColor: new Date() > new Date(item.accessExpiryDate) ? '#d32f2f' : '#FF9800' }]}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={12} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10, marginLeft: 4 }}>
                            {new Date() > new Date(item.accessExpiryDate) ? 'ACCESS EXPIRED' : `ACCESS UNTIL: ${new Date(item.accessExpiryDate).toLocaleDateString()}`}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Content Section */}
            <View style={styles.cardContent}>
                {/* Modern Status Row */}
                <View style={styles.statusRow}>
                    <View style={styles.statusBadge}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color="#1565C0" />
                        <Text style={styles.statusText}>{item.startDate || 'TBA'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { flex: 1, marginLeft: 8 }]}>
                        <MaterialCommunityIcons name="map-marker-radius" size={16} color="#C62828" />
                        <Text style={[styles.statusText, { color: '#333' }]} numberOfLines={1}>{item.address || 'Venue TBA'}</Text>
                    </View>
                </View>

                <Divider style={{ marginBottom: 10 }} />

                <List.Accordion
                    title="View Rules & Details"
                    left={props => <Avatar.Icon {...props} icon="text-box-search-outline" size={32} style={{ backgroundColor: '#E3F2FD' }} color="#1565C0" />}
                    style={styles.accordionHeader}
                    titleStyle={{ fontSize: 15, fontWeight: '600', color: '#333' }}
                >
                    <View style={styles.accordionContent}>
                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>EARNINGS</Text>
                                <Title style={styles.statValue}>₹{item.totalCollected || 0}</Title>
                            </View>
                            <View style={[styles.statDividerVertical]} />
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>PLAYERS</Text>
                                <Title style={styles.statValue}>{item.playerCount || 0}</Title>
                            </View>
                        </View>

                        <View style={styles.detailsGrid}>
                            <View style={styles.detailCard}>
                                <MaterialCommunityIcons name="calendar-start" size={20} color={theme.colors.primary} />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.detailLabel}>START</Text>
                                    <Text style={styles.detailValue}>{item.startDate} {item.startTime}</Text>
                                </View>
                            </View>
                            <View style={styles.detailCard}>
                                <MaterialCommunityIcons name="calendar-end" size={20} color={theme.colors.primary} />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.detailLabel}>END</Text>
                                    <Text style={styles.detailValue}>{item.endDate || 'N/A'}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.detailsGrid, { marginTop: 10 }]}>
                            <View style={styles.detailCard}>
                                <MaterialCommunityIcons name="calendar-alert" size={20} color="#d32f2f" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.detailLabel}>REGISTRATION DEADLINE</Text>
                                    <Text style={styles.detailValue}>{item.registrationLastDate || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={styles.detailCard}>
                                <MaterialCommunityIcons name="format-list-bulleted" size={20} color={theme.colors.primary} />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.detailLabel}>FORMAT</Text>
                                    <Text style={styles.detailValue}>{item.tournamentType} / {item.entryType}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.detailsGrid, { marginTop: 10 }]}>
                            <View style={[styles.detailCard, { flex: 1 }]}>
                                <MaterialCommunityIcons name="identifier" size={20} color="gray" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.detailLabel}>TOURNAMENT ID</Text>
                                    <Text style={[styles.detailValue, { fontSize: 10 }]}>{item.id}</Text>
                                </View>
                            </View>
                        </View>

                        <Divider style={{ marginVertical: 10 }} />
                        <Text style={styles.detailLabel}>Description:</Text>
                        <Text style={styles.detailText}>{item.description || 'No description provided.'}</Text>
                        <Divider style={{ marginVertical: 10 }} />
                        <Text style={styles.detailLabel}>Rules:</Text>
                        <Text style={styles.detailText}>{Array.isArray(item.rules) ? item.rules.join('\n') : (item.rules || 'No rules.')}</Text>
                    </View>
                </List.Accordion>

                {/* Player List Accordion */}
                <List.Accordion
                    title={`Registered Players (${item.playerCount || 0})`}
                    left={props => <Avatar.Icon {...props} icon="account-group" size={32} style={{ backgroundColor: '#E8F5E9' }} color="#2E7D32" />}
                    style={[styles.accordionHeader, { marginTop: 8 }]}
                    titleStyle={{ fontSize: 15, fontWeight: '600', color: '#333' }}
                >
                    <View style={styles.playerListContainer}>
                        {((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? (
                            <Text style={{ textAlign: 'center', color: 'gray', padding: 15, fontSize: 13, fontStyle: 'italic' }}>
                                Player details hidden (Access Expired or Tournament Completed)
                            </Text>
                        ) : item.players && item.players.length > 0 ? (
                            item.players.slice(0, 5).map((player, idx) => (
                                <Surface key={player.id || idx} style={styles.playerListItem} elevation={1}>
                                    <Avatar.Text size={36} label={player.playerName?.[0] || 'P'} style={{ backgroundColor: theme.colors.primary }} labelStyle={{ fontSize: 14, color: 'white' }} />
                                    <View style={{ marginLeft: 12, flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>{player.playerName}</Text>
                                        <Text style={{ fontSize: 11, color: 'gray' }}>{player.teamName || 'Solo'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <View style={[styles.paidBadge, { backgroundColor: player.paid ? '#E8F5E9' : '#FFEBEE' }]}>
                                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: player.paid ? '#2E7D32' : '#C62828' }}>{player.paid ? 'PAID' : 'PENDING'}</Text>
                                        </View>
                                    </View>
                                </Surface>
                            ))
                        ) : (
                            <Text style={{ textAlign: 'center', color: 'gray', padding: 10, fontSize: 12 }}>No players registered yet.</Text>
                        )}

                        {/* Only show 'View All' if NOT expired and NOT completed and has players */}
                        {item.players && item.players.length > 5 && (!item.accessExpiryDate || new Date() <= new Date(item.accessExpiryDate)) && item.status !== 'completed' && (
                            <Button mode="text" compact onPress={() => router.push(`/(organizer)/players/${item.id}`)} style={{ marginTop: 5 }}>
                                View All {item.players.length} Players
                            </Button>
                        )}
                    </View>
                </List.Accordion>

                {/* Teams Overview for Team-Related */}
                {(item.tournamentType === 'Team' || (item.tournamentType === 'Normal' && item.entryType === 'Team')) && (
                    <View style={styles.teamsSection}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={styles.detailLabel}>Teams Overview ({item.teams?.length || 0}/{item.maxTeams || item.maxParticipants || 0})</Text>
                            {item.tournamentType === 'Team' && (
                                <Button mode="text" compact onPress={() => openConfigModal(item)}>Edit Setup</Button>
                            )}
                        </View>
                        {item.teams && item.teams.length > 0 ? (
                            <View style={styles.teamGrid}>
                                {item.teams.map((team, index) => {
                                    const teamName = typeof team === 'string' ? team : team.name;
                                    const teamLogo = typeof team === 'string' ? null : team.logoUrl;
                                    const count = item.teamCounts?.[teamName] || 0;
                                    const teamPlayers = item.teamPlayers?.[teamName] || [];

                                    return (
                                        <View key={index} style={styles.teamStatusCard}>
                                            {teamLogo ? (
                                                <Image source={{ uri: teamLogo }} style={styles.teamMinLogo} resizeMode="cover" />
                                            ) : (
                                                <Avatar.Text size={36} label={teamName?.[0] || 'T'} style={{ backgroundColor: '#E8F5E9' }} labelStyle={{ fontSize: 14, color: '#2E7D32' }} />
                                            )}
                                            <Text style={styles.teamNameText} numberOfLines={1}>{teamName}</Text>
                                            <Badge style={{ backgroundColor: count >= item.teamSize ? '#4CAF50' : '#2196F3' }}>
                                                {count}/{item.teamSize || 0}
                                            </Badge>

                                            {/* Show enrolled players */}
                                            {count > 0 && (
                                                ((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? (
                                                    <Text style={{ fontSize: 9, color: 'gray', marginTop: 4, fontStyle: 'italic', textAlign: 'center' }}>
                                                        Players Hidden
                                                    </Text>
                                                ) : (
                                                    <View style={styles.teamPlayersContainer}>
                                                        <Text style={styles.playersLabel}>Players:</Text>
                                                        {teamPlayers.map((player, idx) => (
                                                            <View key={idx} style={styles.playerRow}>
                                                                <Text style={styles.playerName} numberOfLines={1}>• {player.playerName}</Text>
                                                                <View style={[styles.miniPaidBadge, {
                                                                    backgroundColor: player.paid ? '#E8F5E9' : '#FFEBEE'
                                                                }]}>
                                                                    <Text style={{
                                                                        fontSize: 8,
                                                                        fontWeight: 'bold',
                                                                        color: player.paid ? '#2E7D32' : '#C62828'
                                                                    }}>
                                                                        {player.paid ? 'PAID' : 'PENDING'}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )
                                            )}

                                            <Text style={{ fontSize: 9, color: 'gray', marginTop: 2 }}>
                                                {Math.max(0, (item.teamSize || 0) - count)} More Req.
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            item.tournamentType === 'Team' ? (
                                <Button mode="contained-tonal" icon="shield-edit" onPress={() => openConfigModal(item)}>
                                    Configure {item.maxTeams} Teams
                                </Button>
                            ) : (
                                <Text style={{ fontSize: 12, color: 'gray', textAlign: 'center', padding: 10 }}>
                                    No teams defined by the owner.
                                </Text>
                            )
                        )}
                    </View>
                )}

                <Divider style={{ marginVertical: 15 }} />

                <LinearGradient
                    colors={['#F5F5F5', '#E3F2FD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#BBDEFB' }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, color: '#1565C0', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Share Registration Link</Text>
                        <MaterialCommunityIcons name="share-variant" size={16} color="#1565C0" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', padding: 10, borderRadius: 10 }}>
                        <Text style={{ flex: 1, color: '#0D47A1', fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
                            {Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app'}/tournament/{item.id}
                        </Text>
                        <TouchableOpacity
                            onPress={() => handleShare(item.id, item.name)}
                            style={{ backgroundColor: 'white', padding: 6, borderRadius: 8, elevation: 2, marginLeft: 10 }}
                        >
                            <MaterialCommunityIcons name="content-copy" size={18} color="#1565C0" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <View style={styles.actionRow}>
                    <Button
                        mode="contained"
                        icon="account-group"
                        onPress={() => {
                            if ((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') {
                                Alert.alert("Access Expired", "Your management access for this tournament has expired or the tournament has ended. Please contact the administrator.");
                                return;
                            }
                            router.push(`/(organizer)/players/${item.id}`);
                        }}
                        style={{ flex: 1, marginRight: 5, borderRadius: 8, opacity: ((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? 0.6 : 1 }}
                        contentStyle={{ height: 45 }}
                        buttonColor={((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? '#757575' : theme.colors.primary}
                    >
                        {((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? 'Access Expired' : 'Manage'}
                    </Button>



                    {/* Social Share Buttons */}
                    <View style={{ flexDirection: 'row' }}>
                        <IconButton
                            icon="whatsapp"
                            iconColor="white"
                            containerColor="#25D366"
                            size={20}
                            onPress={() => shareToWhatsApp(item.id, item.name)}
                            style={{ margin: 0, marginRight: 5 }}
                        />
                        <IconButton
                            icon="share-variant"
                            iconColor="white"
                            containerColor={theme.colors.primary}
                            size={20}
                            onPress={() => handleShare(item.id, item.name)}
                            style={{ margin: 0 }}
                        />
                    </View>
                </View>
            </View>
        </Surface >
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
            <LinearGradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Surface style={styles.logoSurface} elevation={8}>
                            <Image source={require('../../assets/logo.png')} style={styles.logo} />
                        </Surface>
                        <View>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 1, fontWeight: '600', marginBottom: 2 }}>ORGANIZER DASHBOARD</Text>
                            <Title style={styles.headerTitle}>{user?.displayName || userData?.name || 'Organizer'}</Title>
                        </View>
                    </View>
                    <IconButton
                        icon="logout"
                        iconColor="white"
                        size={24}
                        onPress={() => logout()}
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                    />
                </View>

                {/* Dashboard Stats */}
                {!loading && (
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{tournaments.length}</Text>
                            <Text style={styles.statLabel}>Events</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>₹{tournaments.reduce((acc, t) => acc + (t.totalCollected || 0), 0)}</Text>
                            <Text style={styles.statLabel}>Collected</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>₹{Math.floor(tournaments.reduce((acc, t) => acc + (t.totalCollected || 0), 0) * 0.95)}</Text>
                            <Text style={styles.statLabel}>Settlement (95%)</Text>
                        </View>
                    </View>
                )}
            </LinearGradient>

            <View style={styles.mainContainer}>
                {loading ? (
                    <ActivityIndicator size="large" style={{ marginTop: 50 }} color={theme.colors.primary} />
                ) : (
                    <FlatList
                        data={tournaments}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        ListHeaderComponent={
                            !loading && tournaments.length > 0 ? (
                                <Surface style={styles.masterShareCard} elevation={2}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                        <View style={styles.masterIconCircle}>
                                            <MaterialCommunityIcons name="bullhorn-variant" size={24} color="white" />
                                        </View>
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A237E' }}>Master Profile Link</Text>
                                            <Text style={{ fontSize: 11, color: '#666' }}>Shares ALL your active tournaments in one page</Text>
                                        </View>
                                        <IconButton
                                            icon="whatsapp"
                                            containerColor="#25D366"
                                            iconColor="white"
                                            size={20}
                                            onPress={() => shareToWhatsApp(user.uid, 'My Profile', true)}
                                        />
                                    </View>
                                    <View style={styles.masterLinkRow}>
                                        <Text style={styles.masterLinkText} numberOfLines={1}>
                                            {Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app'}/organizer/{user.uid}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.masterCopyBtn}
                                            onPress={() => handleShare(user.uid, 'My Profile', true)}
                                        >
                                            <MaterialCommunityIcons name="content-copy" size={18} color="#1A237E" />
                                        </TouchableOpacity>
                                    </View>
                                </Surface>
                            ) : null
                        }
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color="#ccc" />
                                <Title style={{ color: 'gray', marginTop: 10 }}>No Tournaments Found</Title>
                                <Text style={{ color: 'gray' }}>You haven't been assigned any tournaments yet.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* Team Configuration Modal */}
            <Portal>
                <Modal visible={configModalVisible} onDismiss={() => setConfigModalVisible(false)} contentContainerStyle={styles.modal}>
                    <Title>Configure Team Slots ({selectedTournament?.maxTeams || 0})</Title>
                    <ScrollView style={{ maxHeight: 500 }}>
                        {teamsToConfigure.map((team, index) => (
                            <Surface key={index} style={styles.configItem} elevation={1}>
                                <TouchableOpacity onPress={() => pickTeamLogo(index)}>
                                    <View style={styles.logoPicker}>
                                        {team.logo ? (
                                            <Image source={{ uri: team.logo }} style={styles.configuredLogo} resizeMode="cover" />
                                        ) : (
                                            <>
                                                <MaterialCommunityIcons name="camera-plus" size={20} color="gray" />
                                                <Text style={{ fontSize: 8, color: 'gray', marginTop: 2 }}>Logo</Text>
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>
                                <TextInput
                                    label={`Team ${index + 1} Name`}
                                    value={team.name}
                                    onChangeText={(text) => {
                                        const nt = [...teamsToConfigure];
                                        nt[index].name = text;
                                        setTeamsToConfigure(nt);
                                    }}
                                    mode="outlined"
                                    style={{ flex: 1, marginLeft: 10 }}
                                    dense
                                />
                            </Surface>
                        ))}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
                        <Button onPress={() => setConfigModalVisible(false)} style={{ marginRight: 10 }}>Cancel</Button>
                        <Button mode="contained" onPress={saveTeamConfig} loading={uploading} disabled={uploading}>Save Config</Button>
                    </View>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { padding: 20, paddingTop: 50, paddingBottom: 40, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, shadowColor: "#1a237e", shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 800, alignSelf: 'center' },
    logoSurface: { borderRadius: 12, padding: 0, elevation: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
    logo: { width: 44, height: 44, borderRadius: 10 },
    headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 22, letterSpacing: 0.5 },
    headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },

    masterShareCard: { margin: 15, marginBottom: 10, padding: 15, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#e0e0e0' },
    masterIconCircle: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#3F51B5', justifyContent: 'center', alignItems: 'center' },
    masterLinkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 12, padding: 10, paddingRight: 5 },
    masterLinkText: { flex: 1, fontSize: 12, color: '#1A237E', fontWeight: '500' },
    masterCopyBtn: { padding: 8, backgroundColor: 'white', borderRadius: 8, elevation: 2 },

    statsContainer: { flexDirection: 'row', marginTop: 25, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 15, justifyContent: 'space-around', maxWidth: 500, width: '100%', alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    statItem: { alignItems: 'center', flex: 1 },
    statNumber: { color: 'white', fontSize: 24, fontWeight: '800' },
    statLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 5 },

    mainContainer: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20, marginTop: -25 },
    card: { borderRadius: 24, backgroundColor: 'white', marginBottom: 24, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },

    bannerContainer: { height: 200, position: 'relative' },
    banner: { width: '100%', height: '100%' },
    placeholderBanner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%' },
    bannerContent: { position: 'absolute', bottom: 15, left: 15, right: 15 },
    cardTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
    gameName: { color: '#E0E0E0', fontSize: 14, marginTop: 4 },
    prizeChip: { backgroundColor: '#FFD700', alignSelf: 'flex-start', marginBottom: 8, height: 28 },

    feeBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    expiryBadge: { position: 'absolute', top: 15, left: 15, backgroundColor: '#FF9800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

    cardContent: { padding: 20 },
    statusRow: { flexDirection: 'row', marginBottom: 15 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#EEEEEE' },
    statusText: { fontSize: 11, fontWeight: '600', color: '#555', marginLeft: 6 },

    accordionHeader: { backgroundColor: 'white', padding: 0, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', borderRadius: 8, overflow: 'hidden' },
    accordionContent: { padding: 15, backgroundColor: 'white', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },

    statsRow: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E0E0E0' },
    statBox: { flex: 1 },
    statLabel: { fontSize: 10, color: '#757575', fontWeight: 'bold', letterSpacing: 1 },
    statValue: { fontSize: 18, color: '#1A237E', fontWeight: 'bold', marginTop: 2 },
    statDividerVertical: { width: 1, backgroundColor: '#E0E0E0', marginHorizontal: 15 },

    detailsGrid: { flexDirection: 'row', gap: 10 },
    detailCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EEEEEE' },
    detailLabel: { fontSize: 10, color: 'gray', fontWeight: 'bold' },
    detailValue: { fontSize: 12, color: '#333', fontWeight: '600' },
    detailText: { color: '#555', fontSize: 13, lineHeight: 20, marginBottom: 5 },

    // Player List Styles
    playerListContainer: { marginTop: 10 },
    playerListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'white', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
    paidBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },


    actionRow: { flexDirection: 'row', justifyContent: 'space-between' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

    // Team Config Styles
    teamsSection: { marginTop: 15, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 12 },
    teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    teamStatusCard: { width: 100, alignItems: 'center', backgroundColor: 'white', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10 },
    teamMinLogo: { width: 36, height: 36, borderRadius: 18, marginBottom: 5 },
    teamNameText: { fontSize: 11, fontWeight: 'bold', color: '#333', marginVertical: 5, textAlign: 'center' },
    teamPlayersContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        width: '100%',
    },
    playersLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 4,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    playerName: {
        fontSize: 10,
        color: '#333',
        flex: 1,
    },
    miniPaidBadge: {
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
    },

    emptyState: { alignItems: 'center', paddingVertical: 50 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 14 },
    modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20, maxWidth: 600, alignSelf: 'center', width: '90%' },
    configItem: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 10, borderRadius: 10 },
    logoPicker: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
    configuredLogo: { width: '100%', height: '100%' },

    // New styles for player list
    playerListContainer: { padding: 10, backgroundColor: 'white', borderRadius: 12, marginHorizontal: 15, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    playerListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }
});
