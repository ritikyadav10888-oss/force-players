import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl, Share, Image, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { Title, Text, Card, Avatar, Surface, useTheme, Divider, Searchbar, IconButton, ActivityIndicator, Chip, Modal, Portal, List, TextInput, Button, ProgressBar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TournamentPlayersScreen() {
    const { id } = useLocalSearchParams();
    const theme = useTheme();
    const router = useRouter();
    const [players, setPlayers] = useState([]);
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editTeamModalVisible, setEditTeamModalVisible] = useState(false);
    const [teamToRename, setTeamToRename] = useState({ oldName: '', newName: '' });
    const [renaming, setRenaming] = useState(false);
    const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [isExpired, setIsExpired] = useState(false);

    const fetchData = async () => {
        try {
            // Fetch Tournament Info
            const tDoc = await getDoc(doc(db, 'tournaments', id));
            if (tDoc.exists()) {
                const tData = tDoc.data();
                setTournament(tData);

                // Check for Access Expiry
                if ((tData.accessExpiryDate && new Date() > new Date(tData.accessExpiryDate)) || tData.status === 'completed') {
                    setIsExpired(true);
                    setPlayers([]);
                    setLoading(false);
                    return; // Stop fetching players
                }
            }

            // Fetch Players into a list
            const q = query(collection(db, 'tournaments', id, 'players'));
            const querySnapshot = await getDocs(q);
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by registration time
            list.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
            setPlayers(list);
        } catch (error) {
            console.error("Error fetching player list:", error);
            Alert.alert("Error", "Could not fetch player list.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, []);

    const filteredPlayers = players.filter(p =>
        (p.playerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.teamName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.registrationNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayData = React.useMemo(() => {
        const teams = {};
        const solo = [];

        filteredPlayers.forEach(p => {
            const tName = (p.teamName || 'Solo').trim();
            // Check if it's a "real" team (not Solo/empty and user explicitly entered it)
            // Assuming "Solo" is the default for individual.
            if (tName.toLowerCase() !== 'solo' && tName !== '') {
                if (!teams[tName]) teams[tName] = [];
                teams[tName].push(p);
            } else {
                solo.push(p);
            }
        });

        const result = [];
        // Add Teams
        Object.keys(teams).sort().forEach(name => {
            result.push({ type: 'team', name, members: teams[name], id: `team-${name}` });
        });
        // Add Solo Players
        solo.forEach(p => result.push({ type: 'player', data: p, id: p.id }));

        return result;
    }, [filteredPlayers]);


    const handleRenameTeam = async () => {
        if (!teamToRename.newName.trim()) return;
        setRenaming(true);
        try {
            const playersToUpdate = players.filter(p => p.teamName === teamToRename.oldName);
            const batch = playersToUpdate.map(p =>
                updateDoc(doc(db, 'tournaments', id, 'players', p.id), {
                    teamName: teamToRename.newName.trim()
                })
            );

            await Promise.all(batch);
            Alert.alert("Success", "Team renamed successfully!");
            setEditTeamModalVisible(false);
            fetchData();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to rename team.");
        } finally {
            setRenaming(false);
        }
    };

    const handleExport = async () => {
        if (players.length === 0) {
            Alert.alert('Export', 'No player data to export.');
            return;
        }

        try {
            // CSV Header
            let csvContent = "Registration ID,Team Name,Player Name,Email,Phone,Age,Address,Aadhar No,DOB,Emergency Contact,Gender,Photo,Aadhar Photo,Paid Status\n";

            // CSV Rows
            players.forEach(p => {
                const clean = (val) => (val || '-').toString().replace(/,/g, ' ').replace(/\n/g, ' ').trim();

                const regId = clean(p.registrationNumber);
                const team = clean(p.teamName || 'Solo');
                const name = clean(p.playerName);
                const email = clean(p.email);
                const phone = clean(p.phone);
                const age = clean(p.data?.personal?.age);
                const address = clean(p.data?.personal?.address);
                const aadharRaw = clean(p.data?.personal?.adharId);
                const aadhar = aadharRaw !== '-' ? `XXXX-XXXX-${aadharRaw.slice(-4)}` : '-';
                const dob = clean(p.data?.personal?.dob);
                const emergency = clean(p.data?.personal?.emergencyPhone);
                const gender = clean(p.data?.personal?.gender);
                const photo = clean(p.data?.personal?.playerImgUrl);
                const aadharPhoto = clean(p.data?.personal?.adharImgUrl);
                const paid = p.paid ? "Paid" : "Pending";

                csvContent += `${regId},${team},${name},${email},${phone},${age},${address},${aadhar},${dob},${emergency},${gender},${photo},${aadharPhoto},${paid}\n`;

            });

            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `${tournament?.name || 'Tournament'}_Player_List.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                await Share.share({
                    message: csvContent,
                    title: `${tournament?.name || 'Tournament'} - Player List.csv`
                });
            }
        } catch (error) {
            console.error("Export error:", error);
            Alert.alert('Error', 'Failed to export data');
        }
    };

    const getAnalytics = () => {
        const stats = {
            totalHumans: 0,
            soloPlayers: 0,
            teamPlayers: 0,
            paid: 0,
            pending: 0,
            roles: {},
            genders: { Male: 0, Female: 0, Other: 0 }
        };

        players.forEach(p => {
            const rosterSize = (p.teamMembers?.length || 0) + 1;
            stats.totalHumans += rosterSize;

            if (p.entryType === 'Solo') stats.soloPlayers += 1;
            else stats.teamPlayers += rosterSize;

            if (p.paid || p.status === 'success') stats.paid += rosterSize;
            else stats.pending += rosterSize;

            const role = p.data?.gameProfiles?.[tournament?.gameName]?.role || p.role || 'Unspecified';
            stats.roles[role] = (stats.roles[role] || 0) + 1;

            const gender = p.data?.personal?.gender || 'Male';
            stats.genders[gender] = (stats.genders[gender] || 0) + 1;

            p.teamMembers?.forEach(m => {
                const mRole = m.gameProfiles?.[tournament?.gameName]?.role || m.role || 'Unspecified';
                stats.roles[mRole] = (stats.roles[mRole] || 0) + 1;
                const mGender = m.personal?.gender || m.gender || 'Male';
                stats.genders[mGender] = (stats.genders[mGender] || 0) + 1;
            });
        });

        return stats;
    };

    const [selectedPlayer, setSelectedPlayer] = useState(null);

    const renderItem = ({ item }) => {
        if (item.type === 'team') {
            return (
                <Card style={[styles.playerCard, { overflow: 'hidden' }]} mode="elevated" elevation={1}>
                    <List.Accordion
                        title={item.name}
                        titleStyle={{ fontWeight: 'bold', fontSize: 16 }}
                        description={`${item.members.reduce((acc, current) => acc + (current.teamMembers?.length || 1), 0)} Players Total`}
                        style={{ backgroundColor: 'white' }}
                        left={props => <Avatar.Text size={40} label={item.name[0]?.toUpperCase()} style={{ backgroundColor: '#E3F2FD' }} labelStyle={{ color: '#1565C0' }} />}
                        right={props => (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <IconButton
                                    icon="pencil"
                                    size={20}
                                    onPress={() => {
                                        setTeamToRename({ oldName: item.name, newName: item.name });
                                        setEditTeamModalVisible(true);
                                    }}
                                />
                                <MaterialCommunityIcons name={props.isExpanded ? "chevron-up" : "chevron-down"} size={24} color="gray" />
                            </View>
                        )}
                    >
                        {item.members.map((reg, regIdx) => (
                            <View key={reg.id || regIdx}>
                                <Divider />
                                {/* Main Registrant (Captain) */}
                                <List.Item
                                    title={reg.playerName}
                                    description={reg.role === 'Captain' ? `Captain • ${reg.phone}` : reg.phone}
                                    left={props => reg.role === 'Captain'
                                        ? <Avatar.Icon {...props} icon="star" size={30} style={{ backgroundColor: '#FFF9C4' }} color="#FBC02D" />
                                        : <Avatar.Text size={30} label={reg.playerName?.[0] || 'P'} style={{ backgroundColor: '#E3F2FD' }} labelStyle={{ fontSize: 14 }} />
                                    }
                                    right={props => <IconButton icon="magnify" size={20} />}
                                    onPress={() => setSelectedPlayer(reg)}
                                    style={{ paddingLeft: 10 }}
                                />

                                {/* Team Roster (if any) */}
                                {reg.teamMembers?.map((member, memIdx) => (
                                    <List.Item
                                        key={`${reg.id}-m-${memIdx}`}
                                        title={member.playerName || member.name}
                                        description={member.phone || 'Member'}
                                        left={props => <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 10, color: 'gray' }}>#{memIdx + 2}</Text></View>}
                                        right={props => <IconButton icon="magnify" size={20} />}
                                        onPress={() => {
                                            // Create a virtual player object for the modal
                                            setSelectedPlayer({
                                                ...member,
                                                playerName: member.playerName || member.name,
                                                registrationNumber: `${reg.registrationNumber}-${memIdx + 1}`,
                                                teamName: reg.teamName,
                                                data: member // member already contains personal/kit etc if structured right, 
                                                // but wait, in app/tournament/[id].js processedMembers is full profile.
                                            });
                                        }}
                                        style={{ paddingLeft: 30, backgroundColor: '#FAFAFA' }}
                                    />
                                ))}
                            </View>
                        ))}
                    </List.Accordion>
                </Card>
            );
        }

        // Render Individual Player
        const player = item.data;
        return (
            <TouchableOpacity onPress={() => setSelectedPlayer(player)} activeOpacity={0.8}>
                <Card style={styles.playerCard} mode="outlined">
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.playerInfo}>
                            <Avatar.Text
                                size={40}
                                label={player.playerName?.[0]?.toUpperCase() || 'P'}
                                style={{ backgroundColor: theme.colors.primaryContainer }}
                                labelStyle={{ color: theme.colors.primary }}
                            />
                            <View style={styles.nameContainer}>
                                <Text style={styles.playerName}>{player.playerName}</Text>
                                <Text style={styles.teamName}>Solo Player</Text>
                            </View>
                            <IconButton
                                icon="phone"
                                mode="contained"
                                containerColor={theme.colors.primary}
                                iconColor="white"
                                size={20}
                                onPress={() => Linking.openURL(`tel:${player.phone}`)}
                            />
                        </View>
                        <Divider style={styles.divider} />
                        <View style={styles.bottomRow}>
                            <View>
                                <Text style={styles.label}>Reg ID</Text>
                                <Text style={styles.value}>{player.registrationNumber}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.label}>Status</Text>
                                <Text style={[styles.value, { color: player.paid ? '#4CAF50' : '#D32F2F' }]}>{player.paid ? 'PAID' : 'PENDING'}</Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Surface style={styles.header} elevation={2}>
                <View style={styles.headerTop}>
                    <IconButton icon="arrow-left" onPress={() => router.back()} />
                    <Title style={styles.title} numberOfLines={1}>
                        {tournament?.name || 'Players'}
                    </Title>
                    <View style={{ flexDirection: 'row' }}>
                        <IconButton
                            icon="information"
                            iconColor={theme.colors.primary}
                            onPress={() => setInfoModalVisible(true)}
                        />
                        <IconButton
                            icon="chart-bar"
                            iconColor={theme.colors.primary}
                            onPress={() => setAnalyticsModalVisible(true)}
                        />
                        <IconButton icon="file-export" onPress={handleExport} />
                    </View>
                </View>
                <Searchbar
                    placeholder="Search players or teams..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    elevation={0}
                />
                <View style={styles.statsRow}>
                    <Chip icon="account-group" compact style={styles.chip}>{players.length} Registered</Chip>
                    <Chip icon="shield-account" compact style={styles.chip}>{displayData.filter(i => i.type === 'team').length} Teams</Chip>
                </View>
            </Surface>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" /></View>
            ) : isExpired ? (
                <View style={[styles.center, { padding: 40 }]}>
                    <MaterialCommunityIcons name="lock-clock" size={64} color="#BDBDBD" />
                    <Title style={{ marginTop: 20, color: '#616161', fontSize: 20 }}>Management Access Expired</Title>
                    <Text style={{ textAlign: 'center', color: '#757575', marginTop: 10, lineHeight: 22 }}>
                        Your management period for this tournament has ended.{'\n'}
                        Player details and rosters are no longer visible.
                    </Text>
                    <Button
                        mode="outlined"
                        onPress={() => setInfoModalVisible(true)}
                        style={{ marginTop: 20, borderColor: theme.colors.primary }}
                    >
                        View Tournament Info
                    </Button>
                </View>
            ) : (
                <FlatList
                    data={displayData}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={{ color: 'gray', marginTop: 50 }}>No registered players yet.</Text>
                        </View>
                    }
                />
            )}

            {/* Player Details Modal */}
            <Portal>
                <Modal visible={!!selectedPlayer} onDismiss={() => setSelectedPlayer(null)} contentContainerStyle={styles.modalContent}>
                    {selectedPlayer && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <View>
                                    <Title>{selectedPlayer.playerName}</Title>
                                    {/* Show Verified Badge if Paid */}
                                    {(selectedPlayer.paid || selectedPlayer.status === 'success') && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', alignSelf: 'flex-start', paddingHorizontal: 6, borderRadius: 4, marginTop: 2 }}>
                                            <MaterialCommunityIcons name="check-decagram" size={14} color="#2E7D32" />
                                            <Text style={{ fontSize: 10, color: '#2E7D32', fontWeight: 'bold', marginLeft: 2 }}>VERIFIED</Text>
                                        </View>
                                    )}
                                </View>
                                <IconButton icon="close" onPress={() => setSelectedPlayer(null)} />
                            </View>

                            {/* Images - Using data from 'data' field or direct property for team members */}
                            <View style={{ flexDirection: 'row', marginBottom: 20, justifyContent: 'space-around' }}>
                                {(selectedPlayer.personal?.playerImgUrl || selectedPlayer.playerImgUrl || selectedPlayer.data?.personal?.playerImgUrl) && (
                                    <View style={{ alignItems: 'center' }}>
                                        <Image
                                            source={{ uri: selectedPlayer.personal?.playerImgUrl || selectedPlayer.playerImgUrl || selectedPlayer.data?.personal?.playerImgUrl }}
                                            style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 5, backgroundColor: '#f0f0f0' }}
                                        />
                                        <Text style={{ fontSize: 10, color: 'gray' }}>Profile Photo</Text>
                                    </View>
                                )}
                                {(selectedPlayer.personal?.adharImgUrl || selectedPlayer.adharImgUrl || selectedPlayer.data?.personal?.adharImgUrl) && (
                                    <View style={{ alignItems: 'center' }}>
                                        <TouchableOpacity>
                                            <Image
                                                source={{ uri: selectedPlayer.personal?.adharImgUrl || selectedPlayer.adharImgUrl || selectedPlayer.data?.personal?.adharImgUrl }}
                                                style={{ width: 140, height: 90, borderRadius: 8, marginBottom: 5, resizeMode: 'cover', borderWidth: 1, borderColor: '#eee', backgroundColor: '#f0f0f0' }}
                                            />
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 10, color: 'gray' }}>Aadhar Card</Text>
                                    </View>
                                )}
                            </View>

                            <Divider />
                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Personal Details</Text>
                                <DetailRow label="Email" value={selectedPlayer.email} />
                                <DetailRow label="Phone" value={selectedPlayer.phone} onPress={() => Linking.openURL(`tel:${selectedPlayer.phone}`)} highlight />
                                <DetailRow label="Age" value={selectedPlayer.personal?.age || selectedPlayer.data?.personal?.age} />
                                <DetailRow label="DOB" value={selectedPlayer.personal?.dob || selectedPlayer.data?.personal?.dob} />
                                <DetailRow label="Gender" value={selectedPlayer.personal?.gender || selectedPlayer.data?.personal?.gender} />
                                <DetailRow label="Blood Group" value={selectedPlayer.personal?.bloodGroup || selectedPlayer.data?.personal?.bloodGroup} />
                                <DetailRow label="Address" value={selectedPlayer.personal?.address || selectedPlayer.data?.personal?.address} multiline />

                                {(() => {
                                    const adhar = selectedPlayer.personal?.adharId || selectedPlayer.data?.personal?.adharId;
                                    return adhar ? <DetailRow label="Aadhar ID" value={`XXXX XXXX ${adhar.slice(-4)}`} /> : null;
                                })()}

                                <DetailRow label="Emergency Contact" value={selectedPlayer.personal?.emergencyPhone || selectedPlayer.data?.personal?.emergencyPhone} highlight />
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Payment Status</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 13, color: 'gray' }}>Status</Text>
                                    <Chip
                                        icon={selectedPlayer.paid ? "check-circle" : "alert-circle"}
                                        style={{ backgroundColor: selectedPlayer.paid ? '#E8F5E9' : '#FFF3E0' }}
                                        textStyle={{ color: selectedPlayer.paid ? '#2E7D32' : '#E65100', fontSize: 12 }}
                                    >
                                        {selectedPlayer.paid ? 'PAID' : 'PENDING'}
                                    </Chip>
                                </View>
                                {selectedPlayer.paid && (
                                    <DetailRow
                                        label="Amount Paid"
                                        value={`₹${selectedPlayer.paidAmount || tournament?.entryFee || 0}`}
                                        highlight
                                    />
                                )}
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Kit Details</Text>
                                <DetailRow label="Jersey Name" value={selectedPlayer.kit?.jerseyName || selectedPlayer.data?.kit?.jerseyName} />
                                <DetailRow label="Jersey Number" value={selectedPlayer.kit?.jerseyNumber || selectedPlayer.data?.kit?.jerseyNumber} />
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                    <Chip style={{ flex: 1, backgroundColor: '#E8EAF6' }} textStyle={{ fontSize: 11 }}>Jersey: {selectedPlayer.kit?.jerseySize || selectedPlayer.data?.kit?.jerseySize || 'N/A'}</Chip>
                                    <Chip style={{ flex: 1, backgroundColor: '#E8EAF6' }} textStyle={{ fontSize: 11 }}>Shorts: {selectedPlayer.kit?.shortsSize || selectedPlayer.data?.kit?.shortsSize || 'N/A'}</Chip>
                                </View>
                            </View>

                            <Divider />
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Game & Role</Text>
                                {selectedPlayer.gameProfiles ? (
                                    Object.entries(selectedPlayer.gameProfiles).map(([game, details]) => (
                                        <Surface key={game} style={{ marginTop: 10, backgroundColor: '#F8F9FE', padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: theme.colors.primary }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                                <Text style={{ fontWeight: 'bold', color: theme.colors.primary, fontSize: 16 }}>{game}</Text>
                                                <Chip compact style={{ backgroundColor: '#E3F2FD' }}>{details.role}</Chip>
                                            </View>

                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 }}>
                                                {Object.entries(details).map(([k, v]) => {
                                                    if (k === 'role') return null;
                                                    // Format label from camelCase to Title Case
                                                    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                                    return (
                                                        <View key={k} style={{ backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#eee', minWidth: '45%' }}>
                                                            <Text style={{ fontSize: 10, color: 'gray', textTransform: 'uppercase' }}>{label}</Text>
                                                            <Text style={{ color: '#333', fontWeight: '600', fontSize: 13 }}>{v}</Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </Surface>
                                    ))
                                ) : (
                                    <DetailRow label="Primary Role" value={selectedPlayer.role || selectedPlayer.data?.role} />
                                )}
                            </View>

                            {/* Enrollment History - If stored in the 'data' field (which comes from master profile snapshot at reg time) */}
                            {selectedPlayer.data?.enrolledTournaments && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>History (At Registration)</Text>
                                    {selectedPlayer.data.enrolledTournaments.map((t, i) => (
                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '500', fontSize: 13 }}>{t.tournamentName}</Text>
                                                {t.gameName && (
                                                    <View style={{ alignSelf: 'flex-start', backgroundColor: '#e0f7fa', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 }}>
                                                        <Text style={{ fontSize: 10, color: '#006064' }}>{t.gameName}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 12, color: 'gray', textAlign: 'right' }}>{t.date}</Text>
                                                <Text style={{ fontSize: 10, color: theme.colors.primary, textAlign: 'right', fontWeight: 'bold' }}>{t.role}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                        </ScrollView>
                    )}
                </Modal>
            </Portal>

            <Portal>
                <Modal visible={analyticsModalVisible} onDismiss={() => setAnalyticsModalVisible(false)} contentContainerStyle={styles.analyticsModal}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Title style={{ fontSize: 22, fontWeight: '900', color: theme.colors.primary }}>Player Analytics</Title>
                        <IconButton icon="close" onPress={() => setAnalyticsModalVisible(false)} />
                    </View>

                    {(() => {
                        const stats = getAnalytics();
                        return (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.analyticsGrid}>
                                    <Surface style={styles.statCard} elevation={1}>
                                        <Text style={styles.statLabel}>TOTAL REACH</Text>
                                        <Text style={styles.statMainValue}>{stats.totalHumans}</Text>
                                        <Text style={styles.statSubValue}>Participants</Text>
                                    </Surface>
                                    <Surface style={styles.statCard} elevation={1}>
                                        <Text style={styles.statLabel}>PAYMENTS</Text>
                                        <Text style={[styles.statMainValue, { color: '#2E7D32' }]}>{stats.paid}</Text>
                                        <Text style={styles.statSubValue}>Confirmed</Text>
                                    </Surface>
                                </View>

                                <View style={styles.analyticsSection}>
                                    <Text style={styles.analyticsSectionTitle}>Registration Type</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <Text style={{ fontSize: 12, color: '#666' }}>Solo Players: {stats.soloPlayers}</Text>
                                        <Text style={{ fontSize: 12, color: '#666' }}>Team Roster: {stats.teamPlayers}</Text>
                                    </View>
                                    <ProgressBar
                                        progress={stats.totalHumans > 0 ? stats.soloPlayers / stats.totalHumans : 0}
                                        color={theme.colors.primary}
                                        style={{ height: 8, borderRadius: 4 }}
                                    />
                                </View>

                                <View style={styles.analyticsSection}>
                                    <Text style={styles.analyticsSectionTitle}>Role Distribution</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {Object.entries(stats.roles).map(([role, count]) => (
                                            <Chip key={role} style={styles.roleChip} textStyle={styles.roleChipText}>
                                                {role}: {count}
                                            </Chip>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.analyticsSection}>
                                    <Text style={styles.analyticsSectionTitle}>Gender Breakdown</Text>
                                    <View style={{ flexDirection: 'row', gap: 15 }}>
                                        <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#E3F2FD', padding: 10, borderRadius: 12 }}>
                                            <MaterialCommunityIcons name="face-man" size={24} color="#1565C0" />
                                            <Text style={{ fontWeight: 'bold', marginTop: 4 }}>{stats.genders.Male}</Text>
                                            <Text style={{ fontSize: 10, color: '#1565C0' }}>Male</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#FCE4EC', padding: 10, borderRadius: 12 }}>
                                            <MaterialCommunityIcons name="face-woman" size={24} color="#C2185B" />
                                            <Text style={{ fontWeight: 'bold', marginTop: 4 }}>{stats.genders.Female}</Text>
                                            <Text style={{ fontSize: 10, color: '#C2185B' }}>Female</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#F5F5F5', padding: 10, borderRadius: 12 }}>
                                            <MaterialCommunityIcons name="account-question" size={24} color="#666" />
                                            <Text style={{ fontWeight: 'bold', marginTop: 4 }}>{stats.genders.Other}</Text>
                                            <Text style={{ fontSize: 10, color: '#666' }}>Other</Text>
                                        </View>
                                    </View>
                                </View>

                                <Button
                                    mode="contained-tonal"
                                    onPress={() => setAnalyticsModalVisible(false)}
                                    style={{ marginTop: 20, borderRadius: 12 }}
                                >
                                    Done
                                </Button>
                            </ScrollView>
                        );
                    })()}
                </Modal>
            </Portal>

            <Portal>
                <Modal visible={infoModalVisible} onDismiss={() => setInfoModalVisible(false)} contentContainerStyle={styles.analyticsModal}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Title style={{ fontSize: 22, fontWeight: '900', color: theme.colors.primary }}>Tournament Details</Title>
                        <IconButton icon="close" onPress={() => setInfoModalVisible(false)} />
                    </View>
                    {tournament && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {tournament.bannerUrl && (
                                <Image source={{ uri: tournament.bannerUrl }} style={{ width: '100%', height: 150, borderRadius: 12, marginBottom: 15 }} resizeMode="cover" />
                            )}

                            <View style={styles.infoGrid}>
                                <DetailRow label="Name" value={tournament.name} />
                                <DetailRow label="Game" value={`${tournament.gameName} (${tournament.tournamentType})`} />
                                <DetailRow label="Entry Fee" value={`₹${tournament.entryFee}`} highlight />
                                <DetailRow label="Prize Pool" value={`₹${tournament.winningPrize}`} highlight />
                            </View>
                            <Divider style={{ marginVertical: 10 }} />
                            <View style={styles.infoGrid}>
                                <DetailRow label="Start Date" value={`${tournament.startDate} ${tournament.startTime}`} />
                                <DetailRow label="End Date" value={tournament.endDate} />
                                <DetailRow label="Reg Deadline" value={tournament.registrationLastDate} />
                                <DetailRow label="Capacity" value={`${tournament.maxParticipants} slots`} />
                            </View>
                            <Divider style={{ marginVertical: 10 }} />
                            <DetailRow label="Venue / City" value={tournament.address || tournament.city} multiline />
                            <Divider style={{ marginVertical: 10 }} />
                            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Description & Rules</Text>
                            <Text style={{ fontSize: 13, color: '#666', lineHeight: 20 }}>
                                {tournament.description}
                                {"\n\n"}
                                {Array.isArray(tournament.rules) ? tournament.rules.join('\n') : tournament.rules}
                            </Text>
                        </ScrollView>
                    )}
                </Modal>
            </Portal>

            <Portal>
                <Modal visible={editTeamModalVisible} onDismiss={() => setEditTeamModalVisible(false)} contentContainerStyle={styles.modalContent}>
                    <Title>Rename Team</Title>
                    <Text style={{ marginBottom: 15, color: 'gray' }}>This will update the team name for all registered members of "{teamToRename.oldName}".</Text>
                    <TextInput
                        label="New Team Name"
                        value={teamToRename.newName}
                        onChangeText={(text) => setTeamToRename({ ...teamToRename, newName: text })}
                        mode="outlined"
                        style={{ marginBottom: 20 }}
                        autoFocus
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <Button onPress={() => setEditTeamModalVisible(false)} style={{ marginRight: 10 }}>Cancel</Button>
                        <Button mode="contained" onPress={handleRenameTeam} loading={renaming} disabled={renaming || !teamToRename.newName.trim()}>
                            Update Name
                        </Button>
                    </View>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

// Helper Component
const DetailRow = ({ label, value, multiline, highlight, onPress }) => {
    if (!value) return null;
    return (
        <TouchableOpacity
            style={styles.detailRow}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.7}
        >
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, highlight && { color: '#B00020', fontWeight: 'bold' }]} numberOfLines={multiline ? 3 : 1}>{value}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    header: {
        backgroundColor: 'white',
        paddingBottom: 15,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%'
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
    searchBar: { backgroundColor: '#F1F3F5', marginHorizontal: 15, borderRadius: 12, height: 45 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 10, gap: 10 },
    chip: { backgroundColor: '#f0f0f0', height: 30 },
    list: {
        padding: 15,
        paddingBottom: 50,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%'
    },
    playerCard: { marginBottom: 12, borderRadius: 15, backgroundColor: 'white', borderColor: '#eee' },
    cardContent: { padding: 12 },
    playerInfo: { flexDirection: 'row', alignItems: 'center' },
    nameContainer: { flex: 1, marginLeft: 12 },
    playerName: { fontSize: 16, fontWeight: 'bold' },
    teamName: { fontSize: 13, color: '#666' },
    divider: { marginVertical: 10, backgroundColor: '#f5f5f5' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
    value: { fontSize: 13, fontWeight: '500', color: '#333' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Modal Styles
    modalContent: { backgroundColor: 'white', padding: 25, margin: 20, borderRadius: 16, maxHeight: '80%', width: '100%', maxWidth: 600, alignSelf: 'center' },
    section: { marginVertical: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#304FFE', paddingLeft: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    detailLabel: { color: 'gray', fontSize: 13 },
    detailValue: { fontWeight: '500', fontSize: 13, flex: 1, textAlign: 'right', marginLeft: 10 },

    // Analytics Styles
    analyticsModal: { backgroundColor: 'white', padding: 25, margin: 20, borderRadius: 24, maxHeight: '85%', width: '100%', maxWidth: 500, alignSelf: 'center' },
    analyticsGrid: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    infoGrid: { gap: 5 },
    statCard: { flex: 1, padding: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#eee' },
    statLabel: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1 },
    statMainValue: { fontSize: 28, fontWeight: '900', marginVertical: 4 },
    statSubValue: { fontSize: 11, color: '#666' },
    analyticsSection: { marginBottom: 20 },
    analyticsSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A237E', marginBottom: 12 },
    roleChip: { backgroundColor: 'white', borderWidth: 1, borderColor: '#304FFE' },
    roleChipText: { color: '#304FFE', fontSize: 11, fontWeight: 'bold' }
});
