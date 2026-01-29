import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, KeyboardAvoidingView, TouchableOpacity, Image } from 'react-native';
import { TextInput, Button, Title, Text, Menu, Divider, useTheme, Surface, RadioButton, Searchbar, Portal, Modal, TouchableRipple, Avatar, SegmentedButtons, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { db, storage } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const GAMES_DATA = [
    {
        category: "Physical Sports",
        data: [
            "Cricket", "Football", "Kabaddi", "Badminton", "Volleyball", "Basketball",
            "Kho Kho", "Table Tennis", "Tennis", "Athletics", "Hockey", "Chess", "Carrom",
            "Boxing", "Wrestling", "Swimming", "Snooker", "Rugby", "Handball", "Squash",
            "Gymnastics", "Cycling", "Archery", "Shooting", "Polo", "Golf", "Pickleball"
        ]
    }
];


const TEAM_FORMATS = [
    { value: 'Solo', label: 'Solo' },
    { value: 'Duo', label: 'Duo' },
    { value: 'Team', label: 'Team' }
];

const TOURNAMENT_TYPES = [
    { value: 'Normal', label: 'Normal' },
    { value: 'Team', label: 'Team Based' },
    { value: 'Auction', label: 'Auction Based' }
];

const DEFAULT_RULES = {
    "Cricket": "1. 11 players per team.\n2. 20 overs per side.\n3. Umpire decision is final.\n4. Standard ICC rules apply.",
    "Football": "1. 11 players per team.\n2. 90 minutes match duration.\n3. Referee decision is final.\n4. Standard FIFA rules apply.",
    "Kabaddi": "1. 7 players per team.\n2. 40 minutes match duration (20-5-20).\n3. Standard AKFI rules apply.",
    "Badminton": "1. Best of 3 sets.\n2. 21 points per set.\n3. Standard BWF rules apply.",
    "Volleyball": "1. 6 players per team.\n2. Best of 5 sets.\n3. Rotation rules apply.",
    "Basketball": "1. 5 players per team.\n2. 4 quarters of 10 minutes.\n3. Standard FIBA rules apply.",
    "Kho Kho": "1. 9 players on field.\n2. 2 innings of 9 minutes each.\n3. Standard KKFI rules apply.",
    "Table Tennis": "1. Best of 5 or 7 games.\n2. 11 points per game.\n3. Standard ITTF rules apply.",
    "Tennis": "1. Best of 3 sets.\n2. Tie-break at 6-6.\n3. Standard ITF rules apply.",
    "Athletics": "1. Adhere to track lanes.\n2. False starts lead to disqualification.\n3. Standard WA rules apply.",
    "Hockey": "1. 11 players per team.\n2. 60 minutes match duration.\n3. Standard FIH rules apply.",
    "Chess": "1. Touch-move rule applies.\n2. Clock timer rules strict.\n3. Standard FIDE rules apply.",
    "Carrom": "1. Queen must be covered.\n2. Standard ICF rules apply.",
    "Boxing": "1. 3 rounds of 3 minutes.\n2. Protective gear mandatory.\n3. Standard IBA rules apply.",
    "Wrestling": "1. 2 periods of 3 minutes.\n2. Standard UWW rules apply.",
    "Swimming": "1. Standard FINA strokes and turns.\n2. False start leads to disqualification.",
    "Snooker": "1. Standard WPBSA rules apply.",
    "Rugby": "1. 15 or 7 players per team.\n2. Standard World Rugby rules apply.",
    "Handball": "1. 7 players per team.\n2. 60 minutes duration.\n3. Standard IHF rules apply.",
    "Squash": "1. Best of 5 games.\n2. 11 points (PAR) per game.\n3. Standard WSF rules apply.",
    "Gymnastics": "1. Standard FIG scoring system.",
    "Cycling": "1. Standard UCI rules apply.",
    "Archery": "1. Standard WA rules apply.",
    "Shooting": "1. Standard ISSF rules apply.",
    "Polo": "1. 4 players per team.\n2. 4-6 chukkas per match.",
    "Golf": "1. Standard R&A / USGA rules apply.",
    "Pickleball": "1. Best of 3 sets.\n2. 11 points (win by 2) per game.\n3. Standard IFP/USAPA rules apply."
};

const DEFAULT_TERMS = {
    "Cricket": "1. All teams must report 30 minutes before the match.\n2. Umpire's decision is final and binding.\n3. Misbehavior will lead to immediate disqualification.\n4. Entry fees are non-refundable.\n5. Standard ICC T20/ODI rules apply unless specified.",
    "Football": "1. All players must wear appropriate kits.\n2. Referee's decision is final.\n3. aggressive behavior will not be tolerated.\n4. Match duration and subs as per tournament rules.\n5. Entry fees are non-refundable.",
    "Kabaddi": "1. Weight limit must be strictly followed.\n2. Nails must be trimmed.\n3. Umpire decision is final.\n4. Standard AKFI rules apply.\n5. Entry fees are non-refundable.",
    "Badminton": "1. Non-marking shoes are mandatory.\n2. Bring your own racquets.\n3. Shuttles provided by organizer.\n4. Umpire decision is final.\n5. Entry fees are non-refundable.",
    "Volleyball": "1. Rotation rules must be followed.\n2. Net contact is a foul.\n3. Referee decision is final.\n4. Teams must be present on time.\n5. Entry fees are non-refundable.",
    "Basketball": "1. Personal fouls will be tracked.\n2. Referee decision is final.\n3. Standard FIBA rules apply.\n4. Teams must be on court on time.\n5. Entry fees are non-refundable.",
    "Kho Kho": "1. Chase and defend rules strictly applied.\n2. Umpire decision is final.\n3. Standard federation rules apply.\n4. Entry fees are non-refundable.",
    "Table Tennis": "1. ITTF service rules apply.\n2. 2 minutes timeout allowed.\n3. Respect the opponent and umpire.\n4. Entry fees are non-refundable.",
    "Tennis": "1. Standard ITF code of conduct applies.\n2. Players must handle their own calls if no umpire.\n3. Entry fees are non-refundable.",
    "Athletics": "1. Chest number is mandatory.\n2. Report to marshaling area on time.\n3. False start rules apply.\n4. Entry fees are non-refundable.",
    "Hockey": "1.  Shin guards and gum guards recommended.\n2. Dangerous play leads to cards (Green/Yellow/Red).\n3. FIH rules apply.\n4. Entry fees are non-refundable.",
    "Chess": "1. Touch-move rule is strict.\n2. Mobile phones must be switched off.\n3. FIDE laws of chess apply.\n4. Entry fees are non-refundable.",
    "Carrom": "1. Thumb stroke not allowed.\n2. Queen must be covered.\n3. ICF rules apply.\n4. Entry fees are non-refundable.",
    "Boxing": "1. Headgear and gum shield mandatory.\n2. Weigh-in 2 hours before bout.\n3. IBA rules apply.\n4. Entry fees are non-refundable.",
    "Wrestling": "1. Singlet is mandatory.\n2. Nails must be trimmed.\n3. UWW rules apply.\n4. Entry fees are non-refundable.",
    "Swimming": "1. Swimmers must stay in their lanes.\n2. One false start rule.\n3. FINA rules apply.\n4. Entry fees are non-refundable.",
    "Snooker": "1.  WPBSA foul and miss rules apply.\n2.  Dress code: Formals.\n3.  Entry fees are non-refundable.",
    "Rugby": "1.  Mouth guard mandatory.\n2.  High tackles are strictly prohibited.\n3.  World Rugby laws apply.\n4.  Entry fees are non-refundable.",
    "Handball": "1.  Steps and dribble rules apply.\n2.  Physical contact rules strict.\n3.  IHF rules apply.\n4.  Entry fees are non-refundable.",
    "Squash": "1.  Protective eyewear recommended.\n2.  WSF rules apply.\n3.  Entry fees are non-refundable.",
    "Gymnastics": "1.  Judges scoring is final.\n2.  Appropriate attire mandatory.\n3.  FIG code of points applies.",
    "Cycling": "1.  Helmet is mandatory.\n2.  Drafting rules depend on race type.\n3.  UCI rules apply.",
    "Archery": "1.  Safety rules are paramount.\n2.  Do not cross the shooting line.\n3.  WA rules apply.",
    "Shooting": "1.  Gun safety is the priority.\n2.  ISSF rules apply.\n3.  Entry fees are non-refundable.",
    "Polo": "1.  Safety gear for rider and horse mandatory.\n2.  Right of way rules strict.\n3.  Entry fees are non-refundable.",
    "Golf": "1.  Repair divots and pitch marks.\n2.  Pace of play must be maintained.\n3.  R&A rules apply.",
    "Pickleball": "1.  Non-volley zone (kitchen) rules apply.\n2.  Serve must be underhand.\n3.  USAPA rules apply."


};

// Helper for Web rendering
const WebDatePicker = ({ value, mode, onChange }) => {
    if (Platform.OS !== 'web') return null;

    const handleChange = (e) => {
        const strVal = e.target.value;
        if (!strVal) return;

        const newDate = new Date(value);
        if (mode === 'time') {
            const [h, m] = strVal.split(':');
            newDate.setHours(parseInt(h), parseInt(m));
        } else {
            // Date input gives YYYY-MM-DD. We need to preserve time or just set date.
            // Simple parsing:
            const parts = strVal.split('-');
            newDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        onChange(null, newDate);
    };

    const strValue = mode === 'time'
        ? value.toTimeString().slice(0, 5)
        : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

    return React.createElement('input', {
        type: mode === 'time' ? 'time' : 'date',
        value: strValue,
        onChange: handleChange,
        style: {
            height: '100%',
            flex: 1,
            marginLeft: 10,
            padding: 0,
            fontSize: 14,
            border: 'none',
            backgroundColor: 'transparent',
            color: 'black',
            outline: 'none',
            fontFamily: 'inherit'
        }
    });
};

const GAME_ENTRY_CONFIG = {
    // Team Only Games
    "Cricket": ["Team"],
    "Football": ["Team"],
    "Kabaddi": ["Team"],
    "Volleyball": ["Team"],
    "Basketball": ["Team"],
    "Kho Kho": ["Team"],
    "Hockey": ["Team"],
    "Rugby": ["Team"],
    "Handball": ["Team"],
    "Polo": ["Team"],

    // Solo & Duo Games
    "Badminton": ["Solo", "Duo"],
    "Table Tennis": ["Solo", "Duo"],
    "Tennis": ["Solo", "Duo"],
    "Carrom": ["Solo", "Duo"],
    "Squash": ["Solo", "Duo"],

    // Solo Only Games
    "Chess": ["Solo"],
    "Boxing": ["Solo"],
    "Wrestling": ["Solo"],
    "Swimming": ["Solo"],
    "Gymnastics": ["Solo"],
    "Cycling": ["Solo"],
    "Archery": ["Solo"],
    "Shooting": ["Solo"],
    "Golf": ["Solo"],
    "Athletics": ["Solo"],
    "Snooker": ["Solo"],
};

export default function TournamentDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const theme = useTheme();
    const { user } = useAuth(); // Owner

    const [name, setName] = useState('');
    const [gameName, setGameName] = useState('Cricket');
    const [customGameName, setCustomGameName] = useState('');
    const [gameCategory, setGameCategory] = useState('physical');
    const [tournamentType, setTournamentType] = useState('Normal'); // Normal, Auction
    const [entryType, setEntryType] = useState('Team'); // Solo, Duo, Team (Default Team for Cricket)
    const [teamSize, setTeamSize] = useState(''); // For 'Team' entry
    const [maxTeams, setMaxTeams] = useState('0'); // Limit for Team-Based tournaments
    const [termsAndConditions, setTermsAndConditions] = useState(''); // Custom T&C Policy

    // Logic: Enforce Entry Types based on Game and Tournament Type
    useEffect(() => {
        if (tournamentType === 'Auction') {
            setEntryType('Solo');
            return;
        }

        if (tournamentType === 'Team') {
            setEntryType('Team');
            return;
        }

        // Normal Tournament Type: Check Game Constraints
        if (gameName !== 'Other' && GAME_ENTRY_CONFIG[gameName]) {
            const allowedFormats = GAME_ENTRY_CONFIG[gameName];

            // If current selection is not allowed, switch to the first allowed option
            if (!allowedFormats.includes(entryType)) {
                setEntryType(allowedFormats[0]);
            }
        }
    }, [gameName, tournamentType, entryType]);

    const [entryFee, setEntryFee] = useState('');
    const [maxParticipants, setMaxParticipants] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState(''); // Venue Address
    const [rules, setRules] = useState(DEFAULT_RULES['Cricket']);
    const [winningPrize, setWinningPrize] = useState('');
    const [bannerImage, setBannerImage] = useState(null);

    // Date Pickers
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [startTime, setStartTime] = useState(new Date());
    const [regDate, setRegDate] = useState(new Date());

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showRegPicker, setShowRegPicker] = useState(false);
    const [showAccessPicker, setShowAccessPicker] = useState(false);

    const [accessExpiryDate, setAccessExpiryDate] = useState(new Date(new Date().setMonth(new Date().getMonth() + 1)));

    // Menus
    const [gameMenuVisible, setGameMenuVisible] = useState(false);

    // Organizer Selection
    const [organizers, setOrganizers] = useState([]);
    const [selectedOrganizer, setSelectedOrganizer] = useState(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [gameSearchQuery, setGameSearchQuery] = useState('');

    // Team Definitions (for Auction/League)
    const [teamsData, setTeamsData] = useState([]); // For Team Based Tournament Type
    // Logic: Resize teamsData when maxParticipants/maxTeams changes (if Team mode)
    useEffect(() => {
        const sourceVal = (tournamentType === 'Team') ? maxTeams : maxParticipants;
        if (entryType === 'Team' && sourceVal) {
            const count = parseInt(sourceVal, 10);
            if (!isNaN(count) && count >= 0 && count <= 100) {
                setTeamsData(prev => {
                    if (prev.length === count) return prev;
                    if (prev.length < count) {
                        // Add more
                        const newSlots = Array(count - prev.length).fill(null).map(() => ({ name: '', logo: null }));
                        return [...prev, ...newSlots];
                    } else {
                        // Trim
                        return prev.slice(0, count);
                    }
                });
            }
        } else if (entryType === 'Team' && !sourceVal) {
            setTeamsData([]);
        }
    }, [maxParticipants, maxTeams, entryType, tournamentType]);

    const pickTeamLogo = async (index) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            const newTeams = [...teamsData];
            let uri = result.assets[0].uri;
            if (Platform.OS === 'web' && result.assets[0].base64) {
                uri = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
            }
            newTeams[index] = { ...newTeams[index], logo: uri };
            setTeamsData(newTeams);
        }
    };

    const updateTeamName = (index, text) => {
        const newTeams = [...teamsData];
        newTeams[index] = { ...newTeams[index], name: text };
        setTeamsData(newTeams);
    };

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchOrganizers();
        if (params.id) {
            fetchTournamentDetails(params.id);
        } else {
            // Reset form for fresh create
            setName('');
            setGameName('Cricket');
            setCustomGameName('');
            setGameCategory('physical');
            setTournamentType('Normal');
            setEntryType('Team');
            setTeamSize('');
            setMaxTeams('0');
            setTermsAndConditions('');
            setEntryFee('');
            setMaxParticipants('');
            setDescription('');
            setAddress('');
            setRules(DEFAULT_RULES['Cricket']);
            setWinningPrize('');
            setBannerImage(null);
            setStartDate(new Date());
            setEndDate(new Date());
            setStartTime(new Date());
            setRegDate(new Date());
            setAccessExpiryDate(new Date(new Date().setMonth(new Date().getMonth() + 1)));
            setTeamsData([]);

            // Only clear organizer if not pre-assigned via params
            if (!params.organizerId) {
                setSelectedOrganizer(null);
            }
        }
    }, [params.id, params.organizerId]);

    const fetchTournamentDetails = async (id) => {
        try {
            const docRef = doc(db, 'tournaments', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setName(data.name);
                setGameName(data.gameName);
                if (data.gameName === 'Other') setCustomGameName(data.gameName); // Logic might differ if original was custom
                setTournamentType(data.tournamentType || 'Normal');
                setEntryType(data.entryType || 'Solo');
                setTeamSize(String(data.teamSize || ''));
                setBannerImage(data.bannerUrl || null);
                setEntryFee(String(data.entryFee));
                setMaxParticipants(String(data.maxParticipants));
                setDescription(data.description);
                setAddress(data.address);
                setRules(data.rules);
                setTermsAndConditions(data.termsAndConditions || '');
                setWinningPrize(data.winningPrize);
                setMaxTeams(String(data.maxTeams || '0'));

                // Dates
                if (data.startDate) setStartDate(new Date(data.startDate));
                if (data.endDate) setEndDate(new Date(data.endDate));
                if (data.registrationLastDate) setRegDate(new Date(data.registrationLastDate));
                if (data.accessExpiryDate) setAccessExpiryDate(new Date(data.accessExpiryDate));
                // Time (Complex parsing, assuming simple for now or keeping default if fail)
                if (data.startTime) {
                    try {
                        const d = new Date();
                        const [time, modifier] = data.startTime.split(' ');
                        let [hours, minutes] = time.split(':');
                        if (hours === '12') hours = '00';
                        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
                        d.setHours(hours, minutes);
                        setStartTime(d);
                    } catch (e) { console.log('Time parse error', e); }
                }

                if (data.organizerId) {
                    // We need to ensure organizers are loaded or just set the object
                    // We will wait for fetchOrganizers or just partial set
                    setSelectedOrganizer({
                        id: data.organizerId,
                        name: data.organizerName,
                        phone: data.organizerPhone || ''
                    });
                }

                // Load Teams
                if (data.teams && Array.isArray(data.teams)) {
                    // Normalize teams to {name, logo} objects if they are just strings
                    const normalizedTeams = data.teams.map(t => typeof t === 'string' ? { name: t, logo: null } : { name: t.name || '', logo: t.logoUrl || null });
                    setTeamsData(normalizedTeams);
                }
            }
        } catch (error) {
            console.error("Error fetching details:", error);
            Alert.alert("Error", "Could not load tournament details.");
        }
    };

    const fetchOrganizers = async () => {
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'organizer'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setOrganizers(list);

            if (params.organizerId) {
                const preSelected = list.find(o => o.id === params.organizerId);
                if (preSelected) {
                    setSelectedOrganizer(preSelected);
                } else {
                    // Fallback: Fetch organizer directly if not in list
                    try {
                        const orgDoc = await getDoc(doc(db, 'users', params.organizerId));
                        if (orgDoc.exists()) {
                            const orgData = { id: orgDoc.id, ...orgDoc.data() };
                            setSelectedOrganizer(orgData);
                        }
                    } catch (err) {
                        console.error('Error fetching organizer:', err);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            // aspect: [16, 9], // Allowed any aspect ratio (e.g. Poster)
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            let uri = result.assets[0].uri;
            if (Platform.OS === 'web' && result.assets[0].base64) {
                uri = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
            }
            setBannerImage(uri);
        }
    };

    const uploadImage = async (uri, pathSuffix = '') => {
        if (!uri) return null;
        try {
            let storagePath = pathSuffix;
            if (!storagePath) {
                storagePath = `tournament_banners/${Date.now()}.jpg`;
            }

            const storageRef = ref(storage, storagePath);

            if (uri.startsWith('data:')) {
                await uploadString(storageRef, uri, 'data_url');
                return await getDownloadURL(storageRef);
            }

            const response = await fetch(uri);
            const blob = await response.blob();
            await uploadBytes(storageRef, blob);
            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Image upload failed:", error);
            throw error;
        }
    };


    const handleCreate = async () => {
        const finalGameName = gameName === 'Other' ? customGameName : gameName;

        if (!name || !finalGameName || !entryFee || !selectedOrganizer) {
            Alert.alert('Error', 'Please fill all required fields (Name, Game, Entry Fee, Organizer).');
            return;
        }

        setLoading(true);
        try {
            let bannerUrl = bannerImage;
            if (bannerImage && !bannerImage.startsWith('http')) {
                bannerUrl = await uploadImage(bannerImage);
            }

            // Process Teams based on Tournament Type
            let finalTeams = [];
            if (entryType === 'Team') {
                if (tournamentType === 'Normal' || tournamentType === 'Team') {
                    // Upload logos for teams if they are local URIs
                    finalTeams = await Promise.all(teamsData.map(async (team, index) => {
                        let logoUrl = team.logo;
                        if (team.logo && !team.logo.startsWith('http')) {
                            logoUrl = await uploadImage(team.logo, `tournaments/teams/${Date.now()}_${index}.jpg`);
                        }
                        return {
                            name: team.name || `Team ${index + 1}`,
                            logoUrl: logoUrl || null
                        };
                    }));
                }
            }

            const payload = {
                name,
                gameName: finalGameName,
                gameCategory,
                tournamentType, // Normal / Auction / Team
                entryType,      // Solo / Duo / Team
                teamSize: entryType === 'Team' ? Number(teamSize) : (entryType === 'Duo' ? 2 : 1),
                maxTeams: tournamentType === 'Team' ? Number(maxTeams) : 0,
                bannerUrl: bannerUrl || null,
                entryFee: Number(entryFee),
                maxParticipants: tournamentType === 'Team' ? Number(maxTeams) : (maxParticipants ? Number(maxParticipants) : 100),
                description,
                address,
                rules,
                termsAndConditions,
                winningPrize,
                startDate: startDate.toDateString(),
                endDate: endDate.toDateString(),
                startTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                registrationLastDate: regDate.toDateString(),
                accessExpiryDate: accessExpiryDate.toISOString(),
                organizerId: selectedOrganizer.id,
                organizerName: selectedOrganizer.name,
                organizerPhone: selectedOrganizer.phone || '',
                teams: finalTeams,
                status: 'upcoming'
            };

            if (params.id) {
                // Update
                const docRef = doc(db, 'tournaments', params.id);
                const updatePayload = { ...payload };
                delete updatePayload.createdBy; // Never update creator
                delete updatePayload.createdAt; // Never update creation time
                delete updatePayload.status;    // Status managed elsewhere

                await updateDoc(docRef, updatePayload);
                Alert.alert('Success', 'Tournament Updated!');
            } else {
                // Create
                payload.createdBy = user.uid;
                payload.createdAt = new Date().toISOString();
                await addDoc(collection(db, 'tournaments'), payload);
                Alert.alert('Success', 'Tournament Created and Assigned!');
            }

            router.back();
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const isEditMode = !!params.id;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={[styles.container, { backgroundColor: '#F5F7FA' }]} contentContainerStyle={styles.contentContainer}>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Button icon="arrow-left" mode="text" onPress={() => router.back()} compact style={{ marginRight: 10 }}>Back</Button>
                        <Title style={styles.title}>{isEditMode ? 'Tournament Details' : 'Create Tournament'}</Title>
                    </View>
                </View>

                {/* 0. Banner Image */}
                <TouchableOpacity onPress={pickImage} style={styles.bannerContainer}>
                    {bannerImage ? (
                        <Image source={{ uri: bannerImage }} style={styles.bannerImage} />
                    ) : (
                        <View style={styles.bannerPlaceholder}>
                            <MaterialCommunityIcons name="camera-plus" size={40} color="gray" />
                            <Text style={{ color: 'gray', marginTop: 10 }}>Add Banner / Poster</Text>
                            <Text style={{ color: 'gray', fontSize: 10 }}>Max 5MB • Any Aspect Ratio</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Tournament Type */}


                {/* 1. Basic Details */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="trophy" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Basic Information</Title>
                    </View>
                    <TextInput
                        label="Tournament Name"
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="format-title" size={20} color="gray" />} />}
                    />



                    <Button
                        mode="outlined"
                        onPress={() => setGameMenuVisible(true)}
                        style={[styles.input, { borderColor: 'gray' }]} // Removed Menu anchor prop
                        contentStyle={{ justifyContent: 'flex-start', paddingVertical: 5 }}
                        textColor="black"
                        icon="controller-classic"
                    >
                        {gameName || "Select Game"}
                    </Button>
                    <Divider style={{ marginVertical: 15 }} />


                    <Portal>
                        <Modal visible={gameMenuVisible} onDismiss={() => { setGameMenuVisible(false); setGameSearchQuery(''); }} contentContainerStyle={styles.modalContent}>
                            <Title style={{ marginBottom: 15, textAlign: 'center' }}>Select Game</Title>
                            <Searchbar
                                placeholder="Search Game"
                                onChangeText={setGameSearchQuery}
                                value={gameSearchQuery}
                                style={{ marginBottom: 15, backgroundColor: '#f0f0f0' }}
                                inputStyle={{ minHeight: 0 }}
                                autoFocus={Platform.OS === 'web'} // Auto focus on web to fix aria-hidden error
                            />
                            <ScrollView style={{ maxHeight: 300 }}>
                                {GAMES_DATA.map((section) => {
                                    const filteredGames = section.data.filter(g => g.toLowerCase().includes(gameSearchQuery.toLowerCase()));
                                    if (filteredGames.length === 0) return null;
                                    return (
                                        <View key={section.category}>
                                            <List.Subheader style={{ fontWeight: 'bold', color: theme.colors.primary }}>{section.category}</List.Subheader>
                                            {filteredGames.map(game => (
                                                <TouchableRipple
                                                    key={game}
                                                    onPress={() => {
                                                        setGameName(game);
                                                        setRules(DEFAULT_RULES[game] || '');
                                                        setTermsAndConditions(DEFAULT_TERMS[game] || '');
                                                        setGameMenuVisible(false);
                                                        setGameSearchQuery('');
                                                    }}
                                                >
                                                    <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                                                        <Text>{game}</Text>
                                                    </View>
                                                </TouchableRipple>
                                            ))}
                                            <Divider />
                                        </View>
                                    );
                                })}

                                {(gameSearchQuery === '' || 'other'.includes(gameSearchQuery.toLowerCase())) && (
                                    <TouchableRipple
                                        onPress={() => { setGameName('Other'); setRules(''); setTermsAndConditions(''); setGameMenuVisible(false); setGameSearchQuery(''); }}
                                    >
                                        <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                                            <Text>Other</Text>
                                        </View>
                                    </TouchableRipple>
                                )}

                                {GAMES_DATA.every(section => section.data.filter(g => g.toLowerCase().includes(gameSearchQuery.toLowerCase())).length === 0) &&
                                    !('other'.includes(gameSearchQuery.toLowerCase())) && (
                                        <Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>No game found</Text>
                                    )}
                            </ScrollView>
                            <Button mode="text" onPress={() => setGameMenuVisible(false)} style={{ marginTop: 10 }}>Close</Button>
                        </Modal>
                    </Portal>

                    {gameName === 'Other' && (
                        <TextInput
                            label="Specify Game Name"
                            value={customGameName}
                            onChangeText={setCustomGameName}
                            mode="outlined"
                            style={styles.input}
                        />
                    )}


                    <Text style={styles.label}>Tournament Type</Text>
                    <SegmentedButtons
                        value={tournamentType}
                        onValueChange={setTournamentType}
                        buttons={TOURNAMENT_TYPES}
                        style={{ marginBottom: 20 }}
                    />

                    {/* Entry Format: Solo / Duo / Team */}
                    <Text style={styles.label}>Entry Format</Text>
                    <SegmentedButtons
                        value={entryType}
                        onValueChange={setEntryType}
                        buttons={[
                            {
                                value: 'Solo',
                                label: 'Solo',
                                disabled: tournamentType === 'Team' || (tournamentType === 'Normal' && gameName !== 'Other' && !GAME_ENTRY_CONFIG[gameName]?.includes('Solo'))
                            },
                            {
                                value: 'Duo',
                                label: 'Duo',
                                disabled: tournamentType === 'Auction' || tournamentType === 'Team' || (tournamentType === 'Normal' && gameName !== 'Other' && !GAME_ENTRY_CONFIG[gameName]?.includes('Duo'))
                            },
                            {
                                value: 'Team',
                                label: 'Team',
                                disabled: tournamentType === 'Auction' || (tournamentType === 'Normal' && gameName !== 'Other' && !GAME_ENTRY_CONFIG[gameName]?.includes('Team'))
                            },
                        ]}
                        style={{ marginBottom: (entryType === 'Team') ? 15 : 0 }}
                    />

                    {/* Team Size Input (Only for Team) */}
                    {entryType === 'Team' && (
                        <TextInput
                            label="Players per Team"
                            value={teamSize}
                            onChangeText={setTeamSize}
                            keyboardType="numeric"
                            left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="account-group" size={20} color="gray" />} />}
                        />
                    )}

                    {/* Max Teams Input - ONLY for Team Based tournaments */}
                    {tournamentType === 'Team' && (
                        <TextInput
                            label="Max Number of Teams"
                            value={maxTeams}
                            onChangeText={setMaxTeams}
                            keyboardType="numeric"
                            mode="outlined"
                            style={[styles.input, { marginBottom: 15 }]}
                            placeholder="e.g. 10"
                            left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="numeric" size={20} color="gray" />} />}
                        />
                    )}



                    {tournamentType !== 'Team' && (
                        <TextInput
                            label={entryType === 'Team' ? "Max Teams (Total Slots)" : (entryType === 'Duo' ? "Max Duo Players (Total Slots)" : "Max Solo Players (Total Slots)")}
                            value={maxParticipants}
                            onChangeText={setMaxParticipants}
                            keyboardType="numeric"
                            mode="outlined"
                            style={[styles.input, { marginBottom: 15 }]}
                            placeholder={entryType === 'Team' ? "Ex: 16 Teams" : (entryType === 'Duo' ? "Ex: 32 Pairs" : "Ex: 64 Players")}
                            left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="account-group" size={20} color="gray" />} />}
                        />
                    )}

                    {/* Team Configuration (For Normal + Team and Team-Based Type) */}
                    {entryType === 'Team' && (tournamentType === 'Team' || tournamentType === 'Normal') && teamsData.length > 0 && (
                        <View style={{ marginBottom: 15 }}>
                            <Text style={styles.label}>Team Configuration ({teamsData.length} Teams)</Text>
                            <Text style={{ fontSize: 12, color: 'gray', marginBottom: 10 }}>Configure team names and logos. These will be selectable by participants.</Text>
                            {teamsData.map((team, index) => (
                                <Surface key={index} style={{ padding: 10, marginBottom: 10, borderRadius: 8, backgroundColor: '#f9f9f9', elevation: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => pickTeamLogo(index)} style={{ marginRight: 10 }}>
                                            {team.logo ? (
                                                <Image source={{ uri: team.logo }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                                            ) : (
                                                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }}>
                                                    <MaterialCommunityIcons name="camera" size={24} color="gray" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                        <TextInput
                                            label={`Team ${index + 1} Name (Pre-fill)`}
                                            value={team.name}
                                            onChangeText={(text) => updateTeamName(index, text)}
                                            mode="outlined"
                                            style={{ flex: 1, backgroundColor: 'white' }}
                                            dense
                                        />
                                    </View>
                                </Surface>
                            ))}
                        </View>
                    )}

                    <TextInput
                        label="Description"
                        value={description}
                        onChangeText={setDescription}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="file-document-edit" size={20} color="gray" />} />}
                    />

                    <TextInput
                        label="Venue / Address"
                        value={address}
                        onChangeText={setAddress}
                        mode="outlined"
                        multiline
                        numberOfLines={4}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="map-marker" size={20} color="gray" />} />}
                    />

                    <TextInput
                        label="Rules"
                        value={rules}
                        onChangeText={setRules}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="gavel" size={20} color="gray" />} />}
                    />

                    <TextInput
                        label="Terms & Conditions Policy"
                        value={termsAndConditions}
                        onChangeText={setTermsAndConditions}
                        mode="outlined"
                        multiline
                        numberOfLines={5}
                        style={styles.input}
                        placeholder="Specify rules regarding refunds, behavior, equipment, etc."
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="file-document-check" size={20} color="gray" />} />}
                    />
                </Surface>

                {/* 2. Financials & Slots */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="cash-multiple" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Prizes & Fees</Title>
                    </View>
                    <View style={styles.row}>
                        <TextInput
                            label="Entry Fee (₹)"
                            value={entryFee}
                            onChangeText={setEntryFee}
                            keyboardType="numeric"
                            mode="outlined"
                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                            left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="cash" size={20} color="gray" />} />}
                        />
                        <TextInput
                            label="Prize Pool (₹)"
                            value={winningPrize}
                            onChangeText={setWinningPrize}
                            mode="outlined"
                            style={[styles.input, { flex: 1, marginLeft: 8 }]}
                            left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="trophy-award" size={20} color="gray" />} />}
                        />
                    </View>

                </Surface>

                {/* 3. Schedule */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Schedule</Title>
                    </View>

                    {/* Row 1: Start Date & Start Time */}
                    <View style={[styles.row, { marginBottom: 15 }]}>
                        <View style={styles.dateField}>
                            <Text style={styles.dateLabel}>Start Date</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                    <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.primary} />
                                    <WebDatePicker
                                        value={startDate}
                                        mode="date"
                                        onChange={(e, d) => d && setStartDate(d)}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => setShowStartPicker(true)}>
                                    <View style={styles.dateValueContainer}>
                                        <MaterialCommunityIcons name="calendar" size={18} color={theme.colors.primary} />
                                        <Text style={styles.dateValue}>{startDate.toLocaleDateString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.dateField}>
                            <Text style={styles.dateLabel}>Start Time</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                    <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
                                    <WebDatePicker
                                        value={startTime}
                                        mode="time"
                                        onChange={(e, d) => d && setStartTime(d)}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                                    <View style={styles.dateValueContainer}>
                                        <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.primary} />
                                        <Text style={styles.dateValue}>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Row 2: End Date & Reg Deadline */}
                    <View style={styles.row}>
                        <View style={styles.dateField}>
                            <Text style={styles.dateLabel}>End Date</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                    <MaterialCommunityIcons name="calendar-end" size={20} color={theme.colors.primary} />
                                    <WebDatePicker
                                        value={endDate}
                                        mode="date"
                                        onChange={(e, d) => d && setEndDate(d)}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => setShowEndPicker(true)}>
                                    <View style={styles.dateValueContainer}>
                                        <MaterialCommunityIcons name="calendar-end" size={18} color={theme.colors.primary} />
                                        <Text style={styles.dateValue}>{endDate.toLocaleDateString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.dateField}>
                            <Text style={styles.dateLabel}>Registration Deadline</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                    <MaterialCommunityIcons name="calendar-alert" size={20} color={theme.colors.error} />
                                    <WebDatePicker
                                        value={regDate}
                                        mode="date"
                                        onChange={(e, d) => d && setRegDate(d)}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => setShowRegPicker(true)}>
                                    <View style={styles.dateValueContainer}>
                                        <MaterialCommunityIcons name="calendar-alert" size={18} color={theme.colors.error} />
                                        <Text style={styles.dateValue}>{regDate.toLocaleDateString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Access Expiry Date */}
                    <View style={{ marginTop: 20 }}>
                        <View style={[styles.dateField, { marginHorizontal: 0 }]}>
                            <Text style={styles.dateLabel}>Organizer Access Expiry Date</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                    <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#FF9800" />
                                    <WebDatePicker
                                        value={accessExpiryDate}
                                        mode="date"
                                        onChange={(e, d) => d && setAccessExpiryDate(d)}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => setShowAccessPicker(true)}>
                                    <View style={styles.dateValueContainer}>
                                        <MaterialCommunityIcons name="clock-alert-outline" size={18} color="#FF9800" />
                                        <Text style={styles.dateValue}>{accessExpiryDate.toLocaleDateString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            <Text style={{ fontSize: 10, color: 'gray', marginTop: 4 }}>Organizers can only manage the tournament until this date.</Text>
                        </View>
                    </View>

                    {/* Pickers */}
                    {/* Android Pickers (Native Dialogs) */}
                    {Platform.OS === 'android' && showStartPicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display="default"
                            onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                        />
                    )}
                    {Platform.OS === 'android' && showTimePicker && (
                        <DateTimePicker
                            value={startTime}
                            mode="time"
                            display="default"
                            onChange={(e, d) => { setShowTimePicker(false); if (d) setStartTime(d); }}
                        />
                    )}
                    {Platform.OS === 'android' && showEndPicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display="default"
                            onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                        />
                    )}
                    {Platform.OS === 'android' && showRegPicker && (
                        <DateTimePicker
                            value={regDate}
                            mode="date"
                            display="default"
                            onChange={(e, d) => { setShowRegPicker(false); if (d) setRegDate(d); }}
                        />
                    )}
                    {Platform.OS === 'android' && showAccessPicker && (
                        <DateTimePicker
                            value={accessExpiryDate}
                            mode="date"
                            display="default"
                            onChange={(e, d) => { setShowAccessPicker(false); if (d) setAccessExpiryDate(d); }}
                        />
                    )}

                    {/* iOS Pickers (Modal + Spinner) */}
                    {Platform.OS === 'ios' && (
                        <Portal>
                            <Modal visible={showStartPicker} onDismiss={() => setShowStartPicker(false)} contentContainerStyle={styles.iosDatePickerModal}>
                                <Title>Start Date</Title>
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={(e, d) => { if (d) setStartDate(d); }}
                                    style={{ height: 120, width: '100%' }}
                                />
                                <Button mode="contained" onPress={() => setShowStartPicker(false)}>Done</Button>
                            </Modal>
                        </Portal>
                    )}
                    {Platform.OS === 'ios' && (
                        <Portal>
                            <Modal visible={showTimePicker} onDismiss={() => setShowTimePicker(false)} contentContainerStyle={styles.iosDatePickerModal}>
                                <Title>Start Time</Title>
                                <DateTimePicker
                                    value={startTime}
                                    mode="time"
                                    display="spinner"
                                    onChange={(e, d) => { if (d) setStartTime(d); }}
                                    style={{ height: 120, width: '100%' }}
                                />
                                <Button mode="contained" onPress={() => setShowTimePicker(false)}>Done</Button>
                            </Modal>
                        </Portal>
                    )}
                    {Platform.OS === 'ios' && (
                        <Portal>
                            <Modal visible={showEndPicker} onDismiss={() => setShowEndPicker(false)} contentContainerStyle={styles.iosDatePickerModal}>
                                <Title>End Date</Title>
                                <DateTimePicker
                                    value={endDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={(e, d) => { if (d) setEndDate(d); }}
                                    style={{ height: 120, width: '100%' }}
                                />
                                <Button mode="contained" onPress={() => setShowEndPicker(false)}>Done</Button>
                            </Modal>
                        </Portal>
                    )}
                    {Platform.OS === 'ios' && (
                        <Portal>
                            <Modal visible={showRegPicker} onDismiss={() => setShowRegPicker(false)} contentContainerStyle={styles.iosDatePickerModal}>
                                <Title>Registration Deadline</Title>
                                <DateTimePicker
                                    value={regDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={(e, d) => { if (d) setRegDate(d); }}
                                    style={{ height: 120, width: '100%' }}
                                />
                                <Button mode="contained" onPress={() => setShowRegPicker(false)}>Done</Button>
                            </Modal>
                        </Portal>
                    )}
                    {Platform.OS === 'ios' && (
                        <Portal>
                            <Modal visible={showAccessPicker} onDismiss={() => setShowAccessPicker(false)} contentContainerStyle={styles.iosDatePickerModal}>
                                <Title>Access Expiry</Title>
                                <DateTimePicker
                                    value={accessExpiryDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={(e, d) => { if (d) setAccessExpiryDate(d); }}
                                    style={{ height: 120, width: '100%' }}
                                />
                                <Button mode="contained" onPress={() => setShowAccessPicker(false)}>Done</Button>
                            </Modal>
                        </Portal>
                    )}
                </Surface>

                {/* 4. Organizer Assignment */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="account-tie" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Assign Organizer</Title>
                    </View>

                    <Button
                        mode="outlined"
                        onPress={() => !params.organizerId && setMenuVisible(true)}
                        icon={params.organizerId ? "lock" : "account-search"}
                        disabled={!!params.organizerId}
                        style={{ borderColor: params.organizerId ? '#e0e0e0' : theme.colors.primary, borderRadius: 8 }}
                        contentStyle={{ height: 48, justifyContent: 'flex-start' }}
                        labelStyle={{ fontSize: 16 }}
                        textColor={params.organizerId ? 'gray' : theme.colors.primary}
                    >
                        {selectedOrganizer ? `${selectedOrganizer.name} (${selectedOrganizer.email})` : "Select an Organizer..."}
                    </Button>
                </Surface>

                <Portal>
                    <Modal visible={menuVisible} onDismiss={() => setMenuVisible(false)} contentContainerStyle={styles.modalContent}>
                        <Title style={{ marginBottom: 15, textAlign: 'center' }}>Select Organizer</Title>
                        <Searchbar
                            placeholder="Search by name or email"
                            onChangeText={setSearchQuery}
                            value={searchQuery}
                            style={{ marginBottom: 15, backgroundColor: '#f0f0f0' }}
                            autoFocus={Platform.OS === 'web'} // Accessiblity fix
                        />
                        <View style={{ height: 300 }}>
                            <ScrollView>
                                {organizers.filter(org =>
                                    (org.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (org.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                                ).map(org => (
                                    <View key={org.id}>
                                        <TouchableRipple onPress={() => { setSelectedOrganizer(org); setMenuVisible(false); }}>
                                            <View style={styles.organizerItem}>
                                                <Avatar.Text size={40} label={org.name?.[0] || 'O'} style={{ marginRight: 15, backgroundColor: theme.colors.primaryContainer }} />
                                                <View>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{org.name}</Text>
                                                    <Text style={{ color: 'gray', fontSize: 12 }}>{org.email}</Text>
                                                </View>
                                            </View>
                                        </TouchableRipple>
                                        <Divider />
                                    </View>
                                ))}
                                {organizers.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20 }}>No organizers found.</Text>}
                            </ScrollView>
                        </View>
                        <Button mode="text" onPress={() => setMenuVisible(false)} style={{ marginTop: 10 }}>Close</Button>
                    </Modal>
                </Portal>


                <Button mode="contained" onPress={handleCreate} loading={loading} style={styles.submitBtn} contentStyle={{ height: 50 }}>
                    {params.id ? 'Update Tournament' : 'Create & Assign'}
                </Button>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    contentContainer: {
        padding: 20,
        width: '100%',
        maxWidth: 700,
        alignSelf: 'center',
        flexGrow: 1
    },
    title: { fontSize: 24, fontWeight: 'bold' },

    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },

    row: { flexDirection: 'row', justifyContent: 'space-between' },
    input: { marginBottom: 15, backgroundColor: 'white' },

    dateField: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 5,
        backgroundColor: '#FAFAFA'
    },
    dateLabel: { fontSize: 12, color: 'gray', marginBottom: 4 },
    dateValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateValue: { fontSize: 14, fontWeight: '600' },

    submitBtn: { marginTop: 20, borderRadius: 10, marginBottom: 40 },

    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        margin: 20,
        borderRadius: 15,
        maxHeight: '80%'
    },
    organizerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10
    },
    bannerContainer: {
        width: '100%',
        aspectRatio: 16 / 9, // Standard banner aspect ratio
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    bannerPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    label: {
        marginBottom: 8,
        fontWeight: 'bold',
        color: 'gray'
    },
    iosDatePickerModal: {
        backgroundColor: 'white',
        padding: 20,
        margin: 20,
        borderRadius: 15,
        alignItems: 'center'
    }
});
