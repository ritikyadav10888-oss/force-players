import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, Share, Platform, Alert, useWindowDimensions, Linking, ScrollView } from 'react-native';
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
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedSportFilter, setSelectedSportFilter] = useState('All');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
    const [payouts, setPayouts] = useState([]);
    const { width } = useWindowDimensions();
    const isMobile = width < 600;

    // Helper function to determine tournament status
    const getTournamentStatus = (tournament) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Respect manual completion and live status
        if (tournament.status === 'completed') return 'completed';
        if (tournament.status === 'live') return 'ongoing';

        const parseDate = (dateStr) => {
            if (!dateStr) return null;

            // Try standard Date parsing first (for "Day Mon DD YYYY" from toDateString())
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                dateObj.setHours(0, 0, 0, 0);
                return dateObj;
            }

            // Fallback for manual "DD-MM-YYYY" string
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const [day, month, year] = parts.map(Number);
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        return new Date(year, month - 1, day);
                    }
                }
            }
            return null;
        };

        const startDate = parseDate(tournament.startDate);
        const endDate = parseDate(tournament.endDate);

        if (!startDate) return 'upcoming';

        if (endDate && today > endDate) {
            return 'completed';
        } else if (today >= startDate && (!endDate || today <= endDate)) {
            return 'ongoing';
        } else if (today < startDate) {
            return 'upcoming';
        }

        return 'upcoming';
    };

    // Real-time listener for tournaments
    useEffect(() => {
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

                        if (data.teams) {
                            data.teams.forEach(team => {
                                const teamName = typeof team === 'string' ? team : team.name;
                                const teamMembers = paidPlayers.filter(p => {
                                    const playerTeam = (p.teamName || '').trim().toLowerCase();
                                    const configuredTeam = (teamName || '').trim().toLowerCase();
                                    return playerTeam === configuredTeam;
                                });
                                data.teamCounts[teamName] = teamMembers.length;
                                data.teamPlayers[teamName] = teamMembers;
                            });
                        }
                    }
                } catch (subError) {
                    console.warn(`Could not fetch details for tournament ${d.id}:`, subError);
                    data.players = [];
                    data.playerCount = 0;
                    data.totalCollected = 0;
                }

                // Add computed status
                data.computedStatus = getTournamentStatus(data);

                return data;
            }));
            setTournaments(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tournaments:", error);
            setLoading(false);
        });

        // 2. Real-time listener for payouts (financial_statements)
        const pQ = query(collection(db, 'financial_statements'), where('organizerId', '==', user.uid));
        const unsubscribePayouts = Firestore.onSnapshot(pQ, (snap) => {
            setPayouts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribe();
            unsubscribePayouts();
        };
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
        <Surface style={styles.card} elevation={4}>
            {/* Banner Section */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/(organizer)/players/${item.id}`)}
                style={styles.bannerContainer}
            >
                {item.bannerUrl || item.banner ? (
                    <Image source={{ uri: item.bannerUrl || item.banner }} style={styles.banner} resizeMode="cover" />
                ) : (
                    <LinearGradient colors={['#1A237E', '#311B92']} style={styles.placeholderBanner}>
                        <MaterialCommunityIcons name="trophy-variant" size={70} color="rgba(255,255,255,0.2)" />
                    </LinearGradient>
                )}

                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.gradient} />

                <View style={styles.bannerContent}>
                    <View style={styles.cardBadgeRow}>
                        <Surface style={styles.prizeBadge} elevation={4}>
                            <MaterialCommunityIcons name="crown" size={16} color="#FFD700" />
                            <Text style={styles.prizeValue}>₹{item.winningPrize || '0'}</Text>
                        </Surface>

                        {/* Unified Status Badge */}
                        <Surface
                            style={[
                                styles.statusBadge,
                                item.computedStatus === 'ongoing' ? styles.liveActionBadge : {},
                                {
                                    backgroundColor:
                                        item.computedStatus === 'completed' ? '#757575' :
                                            item.computedStatus === 'ongoing' ? '#FFEBEE' : // Red/Pink for Live
                                                '#2196F3'
                                }
                            ]}
                            elevation={2}
                        >
                            {item.computedStatus === 'ongoing' && <View style={styles.pulseDot} />}
                            <Text style={[
                                styles.statusText,
                                item.computedStatus === 'ongoing' ? { color: '#EF5350', fontWeight: '900' } : {}
                            ]}>
                                {item.computedStatus === 'completed' ? 'COMPLETED' :
                                    item.computedStatus === 'ongoing' ? 'LIVE' :
                                        'UPCOMING'}
                            </Text>
                        </Surface>
                    </View>
                    <Title style={styles.cardTitle} numberOfLines={2}>{item.name}</Title>
                    <View style={styles.cardMetaRow}>
                        <MaterialCommunityIcons name="gamepad-variant" size={14} color="#BDBDBD" />
                        <Text style={styles.gameNameMeta}>{item.gameName} • {item.entryType}</Text>
                    </View>
                </View>

                {/* Glassmorphism Fee Badge */}
                <Surface style={styles.feeGlassBadge} elevation={0}>
                    <Text style={styles.feeLabel}>ENTRY</Text>
                    <Text style={styles.feeAmount}>₹{item.entryFee}</Text>
                </Surface>

                {item.accessExpiryDate && (
                    <View style={[styles.expiryBadge, { backgroundColor: new Date() > new Date(item.accessExpiryDate) ? '#EF5350' : '#FF9800' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={12} color="white" />
                        <Text style={styles.expiryText}>
                            {new Date() > new Date(item.accessExpiryDate) ? 'EXPIRED' : `UNTIL: ${new Date(item.accessExpiryDate).toLocaleDateString()}`}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Content Section */}
            <View style={styles.cardContent}>

                {/* Timeline Section - Important Dates */}
                <Surface style={styles.timelineContainer} elevation={0}>
                    <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>REGISTRATION ENDS</Text>
                        <Text style={styles.timelineDate}>
                            {item.accessExpiryDate ? new Date(item.accessExpiryDate).toLocaleDateString() : 'TBA'}
                        </Text>
                    </View>
                    <View style={styles.timelineDividerVertical} />
                    <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>{item.computedStatus === 'ongoing' ? 'CURRENTLY' : 'STARTS'}</Text>
                        <Text style={[styles.timelineDate, item.computedStatus === 'ongoing' && { color: '#EF5350', fontSize: 12 }]}>
                            {item.computedStatus === 'ongoing' ? 'ONGOING' : (item.startDate || 'TBA')}
                        </Text>
                    </View>
                    <View style={styles.timelineDividerVertical} />
                    <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>ENDS</Text>
                        <Text style={styles.timelineDate}>{item.endDate || 'TBA'}</Text>
                    </View>
                </Surface>

                {/* Location Row (replaces old Status Row which had duplicate date) */}
                <View style={styles.statusRow}>
                    <View style={[styles.infoBadge, { flex: 1 }]}>
                        <MaterialCommunityIcons name="map-marker" size={16} color="#E91E63" />
                        <Text style={styles.infoText} numberOfLines={1}>{item.address || 'Venue TBA'}</Text>
                    </View>
                    <View style={[styles.infoBadge, { marginLeft: 10 }]}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#3F51B5" />
                        <Text style={styles.infoText}>{item.startTime || 'Time TBA'}</Text>
                    </View>
                </View>

                <Divider style={styles.cardDivider} />

                <List.AccordionGroup>
                    <List.Accordion
                        title="Rules & Parameters"
                        left={props => <Avatar.Icon {...props} icon="text-box-search-outline" size={32} style={{ backgroundColor: '#E8EAF6' }} color="#1A237E" />}
                        style={styles.accordionHeader}
                        titleStyle={styles.accordionTitle}
                        id="1"
                    >
                        <View style={styles.accordionContent}>
                            {/* Internal Stats Summary */}
                            <View style={styles.internalStatsRow}>
                                <View style={styles.internalStatItem}>
                                    <Text style={styles.internalStatLabel}>COLLECTED</Text>
                                    <Text style={styles.internalStatValue}>₹{item.totalCollected || 0}</Text>
                                </View>
                                <View style={styles.verticalDivider} />
                                <View style={styles.internalStatItem}>
                                    <Text style={styles.internalStatLabel}>PLAYERS</Text>
                                    <Text style={styles.internalStatValue}>{item.playerCount || 0}</Text>
                                </View>
                            </View>

                            <View style={styles.detailsGrid}>
                                <View style={styles.detailCard}>
                                    <MaterialCommunityIcons name="clock-start" size={18} color="#1A237E" />
                                    <View style={{ marginLeft: 10 }}>
                                        <Text style={styles.gridLabel}>SCHEDULE</Text>
                                        <Text style={styles.gridValue}>{item.startDate} {item.startTime}</Text>
                                    </View>
                                </View>
                                <View style={styles.detailCard}>
                                    <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#1A237E" />
                                    <View style={{ marginLeft: 10 }}>
                                        <Text style={styles.gridLabel}>MODE</Text>
                                        <Text style={styles.gridValue}>{item.tournamentType} / {item.entryType}</Text>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.sectionHeading}>Description</Text>
                            <Text style={styles.bodyText}>{item.description || 'No description provided.'}</Text>

                            <Text style={styles.sectionHeading}>Tournament Rules</Text>
                            <Text style={styles.bodyText}>{Array.isArray(item.rules) ? item.rules.join('\n') : (item.rules || 'Standard rules apply.')}</Text>
                        </View>
                    </List.Accordion>

                    <List.Accordion
                        title={`Registered Players (${item.playerCount || 0})`}
                        left={props => <Avatar.Icon {...props} icon="account-group" size={32} style={{ backgroundColor: '#E8F5E9' }} color="#2E7D32" />}
                        style={[styles.accordionHeader, { marginTop: 10 }]}
                        titleStyle={styles.accordionTitle}
                        id="2"
                    >
                        <View style={styles.playerListContainer}>
                            {((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? (
                                <View style={styles.hiddenNotice}>
                                    <MaterialCommunityIcons name="lock-outline" size={20} color="#757575" />
                                    <Text style={styles.hiddenText}>Player details hidden (Expired/Completed)</Text>
                                </View>
                            ) : item.players && item.players.length > 0 ? (
                                <View>
                                    {item.players.slice(0, 5).map((player, idx) => (
                                        <Surface key={player.id || idx} style={styles.playerCard} elevation={1}>
                                            <Avatar.Text size={36} label={player.playerName?.[0] || 'P'} style={styles.playerAvatar} labelStyle={{ fontSize: 14, color: 'white' }} />
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={styles.playerNameText}>{player.playerName}</Text>
                                                <Text style={styles.playerSubText}>{player.teamName || 'Solo Participant'}</Text>
                                            </View>
                                            <View style={[styles.paymentStatusBadge, { backgroundColor: player.paid ? '#E8F5E9' : '#FFF3E0' }]}>
                                                <Text style={[styles.paymentStatusText, { color: player.paid ? '#2E7D32' : '#E65100' }]}>{player.paid ? 'PAID' : 'PENDING'}</Text>
                                            </View>
                                        </Surface>
                                    ))}
                                    {item.players.length > 5 && (
                                        <Button
                                            mode="text"
                                            onPress={() => router.push(`/(organizer)/players/${item.id}`)}
                                            style={styles.viewAllBtn}
                                            labelStyle={{ color: '#1A237E', fontWeight: 'bold' }}
                                        >
                                            VIEW ALL PLAYERS
                                        </Button>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No registrations yet.</Text>
                            )}
                        </View>
                    </List.Accordion>
                </List.AccordionGroup>

                {/* Teams Section - Only for Team Tournaments */}
                {(item.tournamentType === 'Team' || (item.tournamentType === 'Normal' && item.entryType === 'Team')) && (
                    <View style={styles.teamsOverView}>
                        <View style={styles.sectionHeaderLine}>
                            <Text style={styles.sectionTitleText}>Teams Overview ({item.teams?.length || 0}/{item.maxTeams || 0})</Text>
                            {item.tournamentType === 'Team' && (
                                <TouchableOpacity onPress={() => openConfigModal(item)}>
                                    <Text style={styles.editSetupLink}>Edit Setup</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                            {item.teams?.map((team, index) => {
                                const teamName = typeof team === 'string' ? team : team.name;
                                const teamLogo = typeof team === 'string' ? null : team.logoUrl;
                                const count = item.teamCounts?.[teamName] || 0;
                                return (
                                    <Surface key={index} style={styles.miniTeamCard} elevation={2}>
                                        {teamLogo ? (
                                            <Image source={{ uri: teamLogo }} style={styles.miniTeamLogo} />
                                        ) : (
                                            <Avatar.Icon size={32} icon="shield-outline" style={{ backgroundColor: '#F5F5F5' }} color="#757575" />
                                        )}
                                        <Text style={styles.miniTeamName} numberOfLines={1}>{teamName}</Text>
                                        <Badge style={{ backgroundColor: count >= (item.teamSize || 0) ? '#4CAF50' : '#1A237E', marginTop: 4 }}>
                                            {count}/{item.teamSize || 0}
                                        </Badge>
                                    </Surface>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Settlement Info for Completed Tournaments */}
                {item.computedStatus === 'completed' && (
                    <View style={{ marginTop: 15 }}>
                        <Divider style={{ marginBottom: 15 }} />
                        <Title style={[styles.sectionHeading, { color: '#1A237E' }]}>Settlement Status</Title>
                        {(() => {
                            const payout = payouts.find(p => p.tournamentId === item.id);
                            if (payout) {
                                return (
                                    <Surface style={{ padding: 12, borderRadius: 12, backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' }} elevation={0}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View>
                                                <Text style={{ fontSize: 10, color: '#2E7D32', fontWeight: 'bold' }}>AMOUNT PAID</Text>
                                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1B5E20' }}>₹{Math.round(payout.organizerShare).toLocaleString()}</Text>
                                            </View>
                                            <Chip icon="check-decagram" compact style={{ backgroundColor: '#1B5E20' }} textStyle={{ color: 'white', fontSize: 10 }}>SETTLED</Chip>
                                        </View>
                                        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: '#666' }}>ID: {payout.invoiceNumber}</Text>
                                            <Text style={{ fontSize: 10, color: '#666' }}>DATE: {new Date(payout.settlementDate).toLocaleDateString()}</Text>
                                        </View>
                                    </Surface>
                                );
                            } else {
                                return (
                                    <Surface style={{ padding: 12, borderRadius: 12, backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2' }} elevation={0}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <MaterialCommunityIcons name="clock-outline" size={20} color="#E65100" />
                                            <View>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#E65100' }}>Settlement Processing</Text>
                                                <Text style={{ fontSize: 11, color: '#666' }}>Funds are being calculated & verified by owner.</Text>
                                            </View>
                                        </View>
                                    </Surface>
                                );
                            }
                        })()}
                    </View>
                )}

                <Divider style={[styles.cardDivider, { marginVertical: 15 }]} />

                {/* Registration Link Container */}
                <Surface style={styles.shareSurface} elevation={0}>
                    <View style={styles.shareInfo}>
                        <MaterialCommunityIcons name="link-variant" size={18} color="#1A237E" />
                        <Text style={styles.shareLabel}>Registration Link</Text>
                    </View>
                    <View style={styles.shareActions}>
                        <TouchableOpacity style={styles.shareIconBtn} onPress={() => shareToWhatsApp(item.id, item.name)}>
                            <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.shareIconBtn} onPress={() => handleShare(item.id, item.name)}>
                            <MaterialCommunityIcons name="share-variant" size={22} color="#1A237E" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.copyBtnMain} onPress={() => handleShare(item.id, item.name)}>
                            <MaterialCommunityIcons name="content-copy" size={16} color="white" />
                            <Text style={styles.copyBtnText}>COPY</Text>
                        </TouchableOpacity>
                    </View>
                </Surface>

                <Button
                    mode="contained"
                    icon="cog-outline"
                    onPress={() => {
                        if ((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') {
                            Alert.alert("Access Expired", "Management access has ended.");
                            return;
                        }
                        router.push(`/(organizer)/players/${item.id}`);
                    }}
                    style={styles.manageBtnMain}
                    contentStyle={{ height: 48 }}
                    buttonColor={((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? '#9E9E9E' : '#1A237E'}
                >
                    {((item.accessExpiryDate && new Date() > new Date(item.accessExpiryDate)) || item.status === 'completed') ? 'ACCESS EXPIRED' : 'MANAGE TOURNAMENT'}
                </Button>
            </View>
        </Surface>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
            <View style={styles.headerWrapper}>
                <LinearGradient
                    colors={['#1A237E', '#311B92']}
                    style={styles.header}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Decorative background elements */}
                    <View style={styles.headerBackground}>
                        <View style={[styles.glowCircle, { top: -20, left: -20, backgroundColor: 'rgba(63, 81, 181, 0.3)' }]} />
                        <View style={[styles.glowCircle, { bottom: -40, right: -40, backgroundColor: 'rgba(156, 39, 176, 0.2)' }]} />
                    </View>

                    <View style={styles.headerContent}>
                        <View style={styles.profileSectionNew}>
                            <Surface style={styles.avatarSurface} elevation={4}>
                                <Image source={require('../../assets/logo.png')} style={styles.avatarMain} />
                            </Surface>
                            <View style={styles.welcomeTextSection}>
                                <Text style={styles.welcomeBackLabel}>WELCOME BACK</Text>
                                <Title style={styles.userNameHeader}>{user?.displayName || userData?.name || 'Organizer'}</Title>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => logout()} style={styles.logoutIconBtn}>
                            <MaterialCommunityIcons name="logout-variant" size={22} color="white" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Reference-style Segmented Control - Overlapping */}
                <View style={styles.tabBarContainer}>
                    <Surface style={styles.segmentedTabBar} elevation={6}>
                        <TouchableOpacity
                            onPress={() => setActiveTab('dashboard')}
                            style={[styles.tabItem, activeTab === 'dashboard' && styles.activeTabItem]}
                        >
                            <MaterialCommunityIcons
                                name="view-dashboard"
                                size={18}
                                color={activeTab === 'dashboard' ? '#1A237E' : '#757575'}
                            />
                            <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.activeTabLabel]}>Dashboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setActiveTab('financials')}
                            style={[styles.tabItem, activeTab === 'financials' && styles.activeTabItem]}
                        >
                            <MaterialCommunityIcons
                                name="chart-bar"
                                size={18}
                                color={activeTab === 'financials' ? '#1A237E' : '#757575'}
                            />
                            <Text style={[styles.tabLabel, activeTab === 'financials' && styles.activeTabLabel]}>Financials</Text>
                        </TouchableOpacity>
                    </Surface>
                </View>
            </View>

            <View style={styles.mainContainer}>
                {loading ? (
                    <ActivityIndicator size="large" style={{ marginTop: 50 }} color={theme.colors.primary} />
                ) : activeTab === 'financials' ? (
                    /* Advanced Analytics Dashboard with Sport Filtering */
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {(() => {
                            const filteredTournaments = selectedSportFilter === 'All'
                                ? tournaments
                                : tournaments.filter(t => (t.gameName || 'Other') === selectedSportFilter);

                            const totalRevenue = filteredTournaments.reduce((acc, t) => acc + (t.totalCollected || 0), 0);
                            const totalPaidPlayers = filteredTournaments.reduce((acc, t) => acc + (t.playerCount || 0), 0);
                            const totalPlayers = filteredTournaments.reduce((acc, t) => acc + (t.players?.length || 0), 0);
                            const totalPending = filteredTournaments.reduce((acc, t) => {
                                const unpaid = (t.players || []).filter(p => !p.paid).length;
                                return acc + (unpaid * (parseInt(t.entryFee) || 0));
                            }, 0);
                            const conversionRate = totalPlayers > 0 ? Math.round((totalPaidPlayers / totalPlayers) * 100) : 0;

                            return (
                                <>
                                    {/* Primary Revenue Card */}
                                    <Surface style={styles.analyticsCard} elevation={2}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                            <View>
                                                <Title style={styles.analyticsTitle}>Financial Growth</Title>
                                                {selectedSportFilter !== 'All' && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A237E', marginRight: 6 }} />
                                                        <Text style={{ fontSize: 10, color: '#1A237E', fontWeight: 'bold' }}>FILTERED: {selectedSportFilter.toUpperCase()}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={{ backgroundColor: '#E8EAF6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#1A237E' }}>THIS MONTH</Text>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                            <View style={{ flex: 1, alignItems: 'center' }}>
                                                <Text style={styles.analysisLabel}>Net Revenue</Text>
                                                <Text style={styles.analysisValue}>₹{totalRevenue}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <MaterialCommunityIcons name="trending-up" size={14} color="#2E7D32" />
                                                    <Text style={{ fontSize: 10, color: '#2E7D32', fontWeight: 'bold', marginLeft: 2 }}>+12.4%</Text>
                                                </View>
                                            </View>
                                            <View style={{ width: 1, backgroundColor: '#EDF2F7', height: '100%' }} />
                                            <View style={{ flex: 1, alignItems: 'center' }}>
                                                <Text style={styles.analysisLabel}>Paid Players</Text>
                                                <Text style={styles.analysisValue}>{totalPaidPlayers}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <MaterialCommunityIcons name="account-check" size={14} color="#1A237E" />
                                                    <Text style={{ fontSize: 10, color: '#1A237E', fontWeight: 'bold', marginLeft: 2 }}>Verified</Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={{ marginBottom: 15 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Payout Eligibility</Text>
                                                <Text style={{ fontSize: 14, color: '#1A237E', fontWeight: 'bold' }}>₹{Math.floor(totalRevenue * 0.95)}</Text>
                                            </View>
                                            <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3 }}>
                                                <View style={{ width: '95%', height: '100%', backgroundColor: '#1A237E', borderRadius: 3 }} />
                                            </View>
                                            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>95% of total revenue is eligible for payout after fees</Text>
                                        </View>
                                    </Surface>

                                    {/* Secondary Analytics Grid */}
                                    <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 }}>
                                        <Surface style={{ flex: 1, padding: 16, borderRadius: 20, backgroundColor: 'white' }} elevation={1}>
                                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                                                <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#E65100" />
                                            </View>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold' }}>Pending</Text>
                                            <Text style={{ fontSize: 18, color: '#1E293B', fontWeight: '900', marginTop: 4 }}>₹{totalPending}</Text>
                                            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Recoverable</Text>
                                        </Surface>

                                        <Surface style={{ flex: 1, padding: 16, borderRadius: 20, backgroundColor: 'white' }} elevation={1}>
                                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                                                <MaterialCommunityIcons name="bullseye-arrow" size={20} color="#00695C" />
                                            </View>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold' }}>Conversion</Text>
                                            <Text style={{ fontSize: 18, color: '#1E293B', fontWeight: '900', marginTop: 4 }}>{conversionRate}%</Text>
                                            <View style={{ alignSelf: 'flex-start', backgroundColor: '#E0F2F1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                                                <Text style={{ fontSize: 9, color: '#00695C', fontWeight: '800' }}>HIGH</Text>
                                            </View>
                                        </Surface>
                                    </View>

                                    {/* Top Performing Tournament */}
                                    {filteredTournaments.length > 0 && (
                                        <Surface style={{ marginHorizontal: 20, padding: 16, borderRadius: 20, backgroundColor: '#1A237E', marginBottom: 20 }} elevation={2}>
                                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 }}>{selectedSportFilter !== 'All' ? `TOP ${selectedSportFilter.toUpperCase()} EVENT` : 'TOP PERFORMING EVENT'}</Text>
                                            {(() => {
                                                const top = [...filteredTournaments].sort((a, b) => (b.totalCollected || 0) - (a.totalCollected || 0))[0];
                                                return (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                            <MaterialCommunityIcons name="medal" size={24} color="#FFD700" />
                                                        </View>
                                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                                            <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>{top.name}</Text>
                                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{top.playerCount} Paid Players</Text>
                                                        </View>
                                                        <Text style={{ color: '#B9F6CA', fontSize: 16, fontWeight: '900' }}>₹{top.totalCollected}</Text>
                                                    </View>
                                                );
                                            })()}
                                        </Surface>
                                    )}

                                    {/* Sport Filter Selection chips */}
                                    <Text style={styles.sectionHeadingAlt}>Filter Dashboard by Sport</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, marginBottom: 25, gap: 12 }}>
                                        {/* All Sports Option */}
                                        <TouchableOpacity onPress={() => setSelectedSportFilter('All')}>
                                            <Surface style={[{ width: 140, padding: 15, borderRadius: 20, backgroundColor: 'white' }, selectedSportFilter === 'All' && { borderWidth: 2, borderColor: '#1A237E' }]} elevation={1}>
                                                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#E8EAF6', justifyContent: 'center', alignItems: 'center' }}>
                                                    <MaterialCommunityIcons name="apps" size={18} color="#1A237E" />
                                                </View>
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginTop: 10 }} numberOfLines={1}>All Sports</Text>
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ fontSize: 10, color: '#64748B' }}>{tournaments.length} Total </Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A237E', marginTop: 2 }}>Overview</Text>
                                                </View>
                                            </Surface>
                                        </TouchableOpacity>

                                        {(() => {
                                            const sportStats = tournaments.reduce((acc, t) => {
                                                const sport = t.gameName || 'Other';
                                                if (!acc[sport]) acc[sport] = { players: 0, revenue: 0, icon: 'gamepad-variant' };
                                                acc[sport].players += (t.playerCount || 0);
                                                acc[sport].revenue += (t.totalCollected || 0);

                                                if (sport.toLowerCase().includes('cricket')) acc[sport].icon = 'cricket';
                                                if (sport.toLowerCase().includes('football')) acc[sport].icon = 'soccer';
                                                if (sport.toLowerCase().includes('badminton')) acc[sport].icon = 'badminton';
                                                if (sport.toLowerCase().includes('chess')) acc[sport].icon = 'chess-pawn';
                                                return acc;
                                            }, {});

                                            return Object.entries(sportStats).map(([sport, stats], i) => (
                                                <TouchableOpacity key={i} onPress={() => setSelectedSportFilter(sport)}>
                                                    <Surface style={[{ width: 140, padding: 15, borderRadius: 20, backgroundColor: 'white' }, selectedSportFilter === sport && { borderWidth: 2, borderColor: '#1A237E' }]} elevation={1}>
                                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' }}>
                                                            <MaterialCommunityIcons name={stats.icon} size={18} color="#1A237E" />
                                                        </View>
                                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginTop: 10 }} numberOfLines={1}>{sport}</Text>
                                                        <View style={{ marginTop: 8 }}>
                                                            <Text style={{ fontSize: 10, color: '#64748B' }}>{stats.players} </Text>
                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A237E', marginTop: 2 }}>₹{stats.revenue}</Text>
                                                        </View>
                                                    </Surface>
                                                </TouchableOpacity>
                                            ));
                                        })()}
                                    </ScrollView>

                                    <Text style={styles.sectionHeadingAlt}>{selectedSportFilter !== 'All' ? `${selectedSportFilter} Recent Activity` : 'Recent Player Payments'}</Text>
                                    {(() => {
                                        const allPayments = filteredTournaments.flatMap(t =>
                                            (t.players || [])
                                                .filter(p => p.paid === true)
                                                .map(p => ({
                                                    ...p,
                                                    tournamentName: t.name,
                                                    amount: t.entryFee,
                                                    date: t.startDate
                                                }))
                                        ).sort((a, b) => new Date(b.registrationDate || 0) - new Date(a.registrationDate || 0));

                                        return (
                                            allPayments.length > 0 ? (
                                                allPayments.slice(0, 10).map((payment, i) => (
                                                    <Surface key={i} style={styles.transactionItem} elevation={1}>
                                                        <Avatar.Icon size={40} icon="account-cash" style={{ backgroundColor: '#E8EAF6' }} color="#1A237E" />
                                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                                            <Text style={styles.txnName}>{payment.playerName}</Text>
                                                            <Text style={styles.txnDate} numberOfLines={1}>{payment.tournamentName}</Text>
                                                        </View>
                                                        <View style={{ alignItems: 'flex-end' }}>
                                                            <Text style={styles.txnAmount}>+₹{payment.amount}</Text>
                                                            <Text style={{ fontSize: 9, color: '#94A3B8' }}>{payment.date || 'Success'}</Text>
                                                        </View>
                                                    </Surface>
                                                ))
                                            ) : (
                                                <View style={styles.emptyActivity}>
                                                    <Text style={styles.emptyText}>No recent payments found {selectedSportFilter !== 'All' ? `for ${selectedSportFilter}` : ''}.</Text>
                                                </View>
                                            )
                                        );
                                    })()}

                                    <Text style={styles.sectionHeadingAlt}>Settlement History</Text>
                                    {(() => {
                                        // Unified payout list
                                        const list = [...payouts];

                                        // Add settled tournaments that don't have a record in financial_statements yet
                                        tournaments.forEach(t => {
                                            if (t.settlementStatus === 'completed') {
                                                const hasRecord = payouts.some(p => p.tournamentId === t.id);
                                                if (!hasRecord) {
                                                    list.push({
                                                        id: `temp-${t.id}`,
                                                        tournamentName: t.name,
                                                        settlementDate: new Date().toISOString(),
                                                        organizerShare: t.totalCollected * 0.95,
                                                        invoiceNumber: 'SYNCING',
                                                        isSyncing: true
                                                    });
                                                }
                                            }
                                        });

                                        if (list.length === 0) {
                                            return (
                                                <View style={styles.emptyActivity}>
                                                    <Text style={styles.emptyText}>No settlements received yet.</Text>
                                                </View>
                                            );
                                        }

                                        return list.map((p, i) => (
                                            <Surface key={i} style={[styles.transactionItem, { borderLeftWidth: 4, borderLeftColor: p.isSyncing ? '#FF9800' : '#4CAF50' }]} elevation={1}>
                                                <Avatar.Icon size={40} icon={p.isSyncing ? "clock-sync" : "bank-transfer-in"} style={{ backgroundColor: p.isSyncing ? '#FFF3E0' : '#E8F5E9' }} color={p.isSyncing ? '#E65100' : '#2E7D32'} />
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text style={styles.txnName}>{p.tournamentName}</Text>
                                                    <Text style={styles.txnDate}>{new Date(p.settlementDate).toLocaleDateString()} • {p.invoiceNumber}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={[styles.txnAmount, { color: p.isSyncing ? '#E65100' : '#2E7D32' }]}>₹{Math.round(p.organizerShare).toLocaleString()}</Text>
                                                    <Chip compact style={{ backgroundColor: p.isSyncing ? '#FFF3E0' : '#E8F5E9', height: 20 }} textStyle={{ fontSize: 8, color: p.isSyncing ? '#E65100' : '#2E7D32' }}>{p.isSyncing ? 'SYNCING' : 'SETTLED'}</Chip>
                                                </View>
                                            </Surface>
                                        ));
                                    })()}
                                </>
                            );
                        })()}
                    </ScrollView>
                ) : (
                    /* Dashboard View - Tournament List */
                    <FlatList
                        data={tournaments.filter(t => selectedStatusFilter === 'All' || t.computedStatus === selectedStatusFilter.toLowerCase())}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        ListHeaderComponent={
                            <View>
                                {!loading && tournaments.length > 0 && user ? (
                                    <Surface style={styles.masterShareCard} elevation={5}>
                                        <View style={styles.masterHeader}>
                                            <LinearGradient
                                                colors={['#3F51B5', '#1A237E']}
                                                style={styles.masterIconCircle}
                                            >
                                                <MaterialCommunityIcons name="share-variant" size={22} color="white" />
                                            </LinearGradient>
                                            <View style={{ marginLeft: 15, flex: 1 }}>
                                                <Text style={styles.masterTitle}>Share Professional Profile</Text>
                                                <Text style={styles.masterSubtitle}>Enable players to view all your tournaments at once</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => shareToWhatsApp(user?.uid, 'My Profile', true)}
                                                style={styles.whatsappIconCircle}
                                            >
                                                <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.masterLinkContainer}>
                                            <MaterialCommunityIcons name="link-variant" size={16} color="#757575" style={{ marginRight: 8 }} />
                                            <Text style={styles.masterLinkText} numberOfLines={1}>
                                                {Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app'}/organizer/{user?.uid}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.masterCopyAction}
                                                onPress={() => handleShare(user?.uid, 'My Profile', true)}
                                            >
                                                <MaterialCommunityIcons name="content-copy" size={18} color="#1A237E" />
                                                <Text style={styles.copyText}>COPY</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </Surface>
                                ) : null}

                                {/* Status Filter Chips */}
                                {!loading && tournaments.length > 0 && (
                                    <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                            {['All', 'Upcoming', 'Ongoing', 'Completed'].map((status) => (
                                                <Chip
                                                    key={status}
                                                    mode="outlined"
                                                    selected={selectedStatusFilter === status}
                                                    onPress={() => setSelectedStatusFilter(status)}
                                                    style={{
                                                        backgroundColor: selectedStatusFilter === status ? '#E8EAF6' : 'white',
                                                        borderColor: selectedStatusFilter === status ? '#1A237E' : '#E0E0E0',
                                                    }}
                                                    textStyle={{
                                                        color: selectedStatusFilter === status ? '#1A237E' : '#64748B',
                                                        fontWeight: 'bold',
                                                        fontSize: 11
                                                    }}
                                                    showSelectedOverlay={true}
                                                >
                                                    {status === 'Completed' ? 'ENDED' : status.toUpperCase()}
                                                </Chip>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        }
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color="#ccc" />
                                <Title style={{ color: 'gray', marginTop: 10 }}>No Tournaments Found</Title>
                                <Text style={{ color: 'gray' }}>
                                    {selectedStatusFilter !== 'All'
                                        ? `No ${selectedStatusFilter.toLowerCase()} tournaments found.`
                                        : "You haven't been assigned any tournaments yet."}
                                </Text>
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
    headerWrapper: { position: 'relative', marginBottom: 20 },
    header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 60, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
    headerBackground: { ...StyleSheet.absoluteFillObject, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
    glowCircle: { width: 120, height: 120, borderRadius: 60, position: 'absolute', opacity: 0.6 },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 800, alignSelf: 'center' },

    // New Header Styles from Reference
    profileSectionNew: { flexDirection: 'row', alignItems: 'center' },
    avatarSurface: { width: 48, height: 48, borderRadius: 24, padding: 3, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
    avatarMain: { width: 42, height: 42, borderRadius: 21 },
    welcomeTextSection: { marginLeft: 12 },
    welcomeBackLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    userNameHeader: { color: 'white', fontWeight: 'bold', fontSize: 24, lineHeight: 28, marginTop: -2 },
    logoutIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },

    // Segmented Tab Bar Styles
    tabBarContainer: { position: 'absolute', bottom: -28, left: 20, right: 20, alignItems: 'center', zIndex: 10 },
    segmentedTabBar: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 24, width: '100%', maxWidth: 500, padding: 4, height: 56, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 20, gap: 10, height: '100%' },
    activeTabItem: { backgroundColor: '#E8EAF6' }, // Lavender background for 'half-white' look
    tabLabel: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    activeTabLabel: { color: '#1A237E' },

    // Financials/Analytics Styles
    analyticsCard: { margin: 20, padding: 24, borderRadius: 24, backgroundColor: 'white' },
    analyticsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginBottom: 20 },
    analyticsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    analysisItem: { flex: 1, alignItems: 'center' },
    analysisLabel: { fontSize: 11, color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' },
    analysisValue: { fontSize: 22, color: '#1E293B', fontWeight: '900', marginTop: 4 },
    analysisDivider: { width: 1, backgroundColor: '#EDF2F7', height: '100%' },
    analysisSub: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
    payoutContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16 },
    payoutInfo: { flex: 1 },
    payoutLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    payoutValue: { fontSize: 20, color: '#2E7D32', fontWeight: '900' },
    payoutBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
    payoutBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    transactionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderRadius: 20, marginHorizontal: 20, marginBottom: 12 },
    txnName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
    txnDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
    txnAmount: { fontSize: 15, fontWeight: '900', color: '#2E7D32' },
    sectionHeadingAlt: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginHorizontal: 20, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyActivity: { alignItems: 'center', padding: 40 },

    masterShareCard: { margin: 15, marginBottom: 10, padding: 20, borderRadius: 24, backgroundColor: 'white' },
    masterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    masterIconCircle: { width: 50, height: 50, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    masterTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E' },
    masterSubtitle: { fontSize: 11, color: '#757575', marginTop: 2 },
    whatsappIconCircle: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    masterLinkContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 15, paddingLeft: 12, paddingRight: 4, height: 48 },
    masterLinkText: { flex: 1, fontSize: 12, color: '#424242', fontWeight: '500' },
    masterCopyAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 15, height: 40, borderRadius: 12, elevation: 2 },
    copyText: { fontSize: 11, fontWeight: 'bold', color: '#1A237E', marginLeft: 6 },

    mainContainer: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20, marginTop: 15 },
    card: { borderRadius: 24, backgroundColor: 'white', marginBottom: 24, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },

    bannerContainer: { height: 150, position: 'relative' },
    banner: { width: '100%', height: '100%' },
    placeholderBanner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%' },
    bannerContent: { position: 'absolute', bottom: 15, left: 15, right: 15 },
    cardBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    prizeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    prizeValue: { fontSize: 13, fontWeight: '900', color: '#333', marginLeft: 4 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF5350', marginRight: 5 },
    liveText: { fontSize: 9, fontWeight: '900', color: '#EF5350', letterSpacing: 0.5 },
    cardTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', lineHeight: 22 },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
    gameNameMeta: { color: '#BDBDBD', fontSize: 12, fontWeight: '500' },
    feeGlassBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    feeLabel: { color: 'white', fontSize: 8, fontWeight: 'bold', opacity: 0.8 },
    feeAmount: { color: 'white', fontSize: 14, fontWeight: '900', marginTop: 1 },
    expiryBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
    expiryText: { color: 'white', fontWeight: 'bold', fontSize: 9, marginLeft: 4 },

    cardContent: { padding: 12 },
    statusRow: { flexDirection: 'row', marginBottom: 12 },
    infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#EDF2F7' },
    infoText: { fontSize: 10, fontWeight: '600', color: '#4A5568', marginLeft: 4 },
    cardDivider: { backgroundColor: '#EDF2F7' },

    accordionHeader: { backgroundColor: 'white', padding: 0, borderRadius: 10, overflow: 'hidden' },
    accordionTitle: { fontSize: 13, fontWeight: '700', color: '#2D3748' },
    accordionContent: { padding: 15, backgroundColor: 'white' },
    internalStatsRow: { flexDirection: 'row', backgroundColor: '#F7FAFC', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    internalStatItem: { flex: 1, alignItems: 'center' },
    internalStatLabel: { fontSize: 9, color: '#718096', fontWeight: 'bold', letterSpacing: 1 },
    internalStatValue: { fontSize: 18, color: '#1A237E', fontWeight: '800', marginTop: 2 },
    verticalDivider: { width: 1, backgroundColor: '#E2E8F0', height: '100%' },

    detailsGrid: { flexDirection: 'row', gap: 10 },
    detailCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EDF2F7' },
    gridLabel: { fontSize: 9, color: '#A0AEC0', fontWeight: 'bold' },
    gridValue: { fontSize: 12, color: '#2D3748', fontWeight: '700' },
    sectionHeading: { fontSize: 11, fontWeight: 'bold', color: '#718096', marginTop: 15, marginBottom: 5, textTransform: 'uppercase' },
    bodyText: { color: '#4A5568', fontSize: 13, lineHeight: 20 },

    playerListContainer: { marginTop: 10 },
    hiddenNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F8FAFC', borderRadius: 12, gap: 10 },
    hiddenText: { fontSize: 12, color: '#718096', fontStyle: 'italic' },
    playerCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'white', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    playerAvatar: { backgroundColor: '#1A237E' },
    playerNameText: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
    playerSubText: { fontSize: 11, color: '#64748B' },
    paymentStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    paymentStatusText: { fontSize: 10, fontWeight: '800' },
    viewAllBtn: { marginTop: 5 },
    emptyText: { textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 12 },

    teamsOverView: { marginTop: 15 },
    sectionHeaderLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitleText: { fontSize: 11, fontWeight: 'bold', color: '#718096', textTransform: 'uppercase' },
    editSetupLink: { fontSize: 12, color: '#1A237E', fontWeight: 'bold' },
    miniTeamCard: { width: 110, alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginRight: 12 },
    miniTeamLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9' },
    miniTeamName: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 8, textAlign: 'center' },

    shareSurface: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    shareInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    shareLabel: { fontSize: 12, fontWeight: '700', color: '#1A237E' },
    shareActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    shareIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    copyBtnMain: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A237E', paddingHorizontal: 15, height: 36, borderRadius: 12, gap: 6 },
    copyBtnText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
    manageBtnMain: { borderRadius: 16, marginTop: 5, elevation: 4 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 24, maxWidth: 600, alignSelf: 'center', width: '90%' },
    configItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 12, borderRadius: 16, backgroundColor: '#F8FAFC' },
    logoPicker: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDF2F7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'white' },
    configuredLogo: { width: '100%', height: '100%' },

    // Tournament Status Badge
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginLeft: 8,
    },
    statusText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },

    // Timeline Styles
    timelineContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EDF2F7' },
    timelineItem: { flex: 1, alignItems: 'center' },
    timelineLabel: { fontSize: 8, color: '#94A3B8', fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 4 },
    timelineDate: { fontSize: 11, color: '#334155', fontWeight: '800' },
    timelineDividerVertical: { width: 1, height: '80%', backgroundColor: '#E2E8F0' },
});
