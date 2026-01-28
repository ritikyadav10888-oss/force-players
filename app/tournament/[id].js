import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, Dimensions, ImageBackground, TouchableOpacity, Linking, Share } from 'react-native';
import { TextInput, Button, Title, Text, Surface, useTheme, Avatar, Divider, Modal, Portal, RadioButton, ActivityIndicator, ProgressBar, Chip, SegmentedButtons, List, Menu, Badge, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, addDoc, setDoc, collection, query, where, getDocs, arrayUnion, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { db, storage, auth, functions } from '../../src/config/firebase';
import { httpsCallable } from 'firebase/functions';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import Toast from 'react-native-toast-message';

import { RazorpayService } from '../../src/services/RazorpayService';
import { TransactionService } from '../../src/services/TransactionService';
import DateTimePicker from '@react-native-community/datetimepicker';
// Sport Specific Constants
const GAME_CONFIG = {
    'Cricket': {
        roles: ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'],
        teamSize: 11,
        attributes: [
            { key: 'battingStyle', label: 'Batting Style', type: 'segment', options: ['Right-Hand', 'Left-Hand'], condition: (r) => ['Batsman', 'All-Rounder', 'Wicket Keeper'].includes(r) },
            { key: 'bowlingStyle', label: 'Bowling Style', type: 'chips', options: ['Right-Arm Fast', 'Right-Arm Medium', 'Right-Arm Spin', 'Left-Arm Fast', 'Left-Arm Medium', 'Left-Arm Spin'], condition: (r) => ['Bowler', 'All-Rounder'].includes(r) }
        ]
    },
    'Football': {
        roles: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
        teamSize: 11,
        attributes: [
            { key: 'preferredFoot', label: 'Preferred Foot', type: 'segment', options: ['Right', 'Left', 'Both'] }
        ]
    },
    'Kabaddi': {
        roles: ['Raider', 'Defender', 'All-Rounder'],
        teamSize: 7,
        attributes: [
            { key: 'position', label: 'Defensive Position', type: 'chips', options: ['Left Corner', 'Right Corner', 'Left Cover', 'Right Cover'], condition: (r) => ['Defender', 'All-Rounder'].includes(r) }
        ]
    },
    'Badminton': { roles: ['Single', 'Doubles - Front', 'Doubles - Back', 'Mixed'], attributes: [{ key: 'handedness', label: 'Handedness', type: 'segment', options: ['Right-Hand', 'Left-Hand'] }] },
    'Volleyball': { roles: ['Setter', 'Libero', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker'], attributes: [] },
    'Basketball': { roles: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'], attributes: [] },
    'Kho Kho': { roles: ['Chaser', 'Defender', 'All-Rounder'], attributes: [] },
    'Hockey': { roles: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'], attributes: [] },
    'Rugby': { roles: ['Forward', 'Back'], attributes: [] },
    'Handball': { roles: ['Goalkeeper', 'Court Player'], attributes: [] },
    'Polo': { roles: ['Attacker (No. 1)', 'Midfielder (No. 2/3)', 'Defender (No. 4)'], attributes: [] },

    // Individual/Dual Sports
    'Table Tennis': { roles: ['Single', 'Double'], attributes: [] },
    'Tennis': { roles: ['Single', 'Double'], attributes: [] },
    'Carrom': { roles: ['Single', 'Double'], attributes: [] },
    'Squash': { roles: ['Player'], attributes: [] },
    'Snooker': { roles: ['Player'], attributes: [] },

    // Combat Sports
    'Boxing': { roles: ['Boxer'], attributes: [{ key: 'stance', label: 'Stance', type: 'segment', options: ['Orthodox', 'Southpaw'] }] },
    'Wrestling': { roles: ['Wrestler'], attributes: [] },

    // Individual Performance
    'Athletics': { roles: ['Runner', 'Jumper', 'Thrower'], attributes: [] },
    'Swimming': { roles: ['Swimmer'], attributes: [{ key: 'stroke', label: 'Main Stroke', type: 'chips', options: ['Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly'] }], teamSize: 1 },
    'Gymnastics': { roles: ['Gymnast'], attributes: [], teamSize: 1 },
    'Cycling': { roles: ['Cyclist'], attributes: [], teamSize: 1 },
    'Archery': { roles: ['Archer'], attributes: [], teamSize: 1 },
    'Shooting': { roles: ['Shooter'], attributes: [], teamSize: 1 },
    'Golf': { roles: ['Golfer'], attributes: [], teamSize: 1 },
    'Chess': { roles: ['Player'], attributes: [], teamSize: 1 },
    'Pickleball': { roles: ['Single', 'Doubles - Front', 'Doubles - Back', 'Mixed'], attributes: [{ key: 'handedness', label: 'Handedness', type: 'segment', options: ['Right-Hand', 'Left-Hand'] }], teamSize: 1 },

    // Fallback
    'Default': {
        roles: ['Player', 'Captain', 'Vice-Captain', 'Substitute'],
        attributes: [],
        teamSize: 11 // Default fallback
    }
};

const GAME_TYPE_MAPPING = {
    'Cricket': 'Team', 'Football': 'Team', 'Kabaddi': 'Team', 'Volleyball': 'Team',
    'Basketball': 'Team', 'Kho Kho': 'Team', 'Hockey': 'Team', 'Rugby': 'Team',
    'Handball': 'Team', 'Polo': 'Team',
    'Badminton': 'Hybrid', 'Table Tennis': 'Hybrid', 'Tennis': 'Hybrid', 'Carrom': 'Hybrid',
    'Squash': 'Solo', 'Snooker': 'Solo', 'Boxing': 'Solo', 'Wrestling': 'Solo',
    'Athletics': 'Solo', 'Swimming': 'Solo', 'Gymnastics': 'Solo', 'Cycling': 'Solo',
    'Archery': 'Solo', 'Shooting': 'Solo', 'Golf': 'Solo', 'Chess': 'Solo', 'Pickleball': 'Hybrid'
};

const WAIST_SIZES = ['S (28)', 'M (30)', 'L (32)', 'XL (34)', 'XXL (36)', 'XXXL (38)', '26', '40', '42', 'Other'];
const JERSEY_SIZES = ['S (36)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)', 'XXXL (46)', '32', '34', '48', '50', 'Other'];

export default function TournamentRegistrationScreen() {
    const { id, duoId } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const APP_VERSION = "1.1.2-DEBUG";
    const { user } = useAuth();
    const { width } = Dimensions.get('window');
    const isMobile = width < 768;

    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [organizerInfo, setOrganizerInfo] = useState(null);
    const [existingRegistration, setExistingRegistration] = useState(null);
    const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
    const [partner1, setPartner1] = useState(null); // The first player of the duo
    const [registrationDocId, setRegistrationDocId] = useState(null); // Actual Firestore ID
    const [payForPartner, setPayForPartner] = useState(false); // Only for Duo

    // Diagnostic logging for registration state
    useEffect(() => {
        if (existingRegistration) {
            console.log("📋 Current Registration State:", {
                id: existingRegistration.id,
                docId: existingRegistration.docId,
                regNum: existingRegistration.registrationNumber,
                paid: existingRegistration.paid
            });
        }
    }, [existingRegistration]);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState({ type: 'main', index: -1 });

    const openDatePicker = (type, index = -1) => {
        setDatePickerTarget({ type, index });
        setShowDatePicker(true);
    };

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const d = selectedDate.getDate().toString().padStart(2, '0');
            const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
            const y = selectedDate.getFullYear();
            const formattedDate = `${d}-${m}-${y}`;

            // Calculate age
            const today = new Date();
            let age = today.getFullYear() - y;
            const monthDiff = today.getMonth() - selectedDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < selectedDate.getDate())) {
                age--;
            }

            if (datePickerTarget.type === 'main') {
                updateForm('dob', formattedDate);
                updateForm('age', age.toString());
            } else {
                updateMember(datePickerTarget.index, 'dob', formattedDate);
                updateMember(datePickerTarget.index, 'age', age.toString());
            }
        }
    };

    const calculateAgeFromStr = (dobStr) => {
        if (!dobStr || typeof dobStr !== 'string' || !dobStr.includes('-')) return '';
        const parts = dobStr.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return '';
        const [d, m, y] = parts;
        if (y < 1900 || y > 2100) return '';
        const today = new Date();
        let age = today.getFullYear() - y;
        const monthDiff = today.getMonth() - (m - 1);
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
            age--;
        }
        return age > 0 ? age.toString() : '0';
    };

    // Wizard State
    const [step, setStep] = useState(0); // 0: T&C, 1: Setup/Mode, 2: Details, 3: Review/Pay
    const totalSteps = 4; // Including T&C step
    const [activeDropdown, setActiveDropdown] = useState(null); // Tracks open menu, e.g., 'main_jersey'
    const [teamCounts, setTeamCounts] = useState({}); // Current enrollment per team
    const [fetchingCounts, setFetchingCounts] = useState(false);
    const [formErrors, setFormErrors] = useState({}); // Stores validation errors by field key
    const [agreedToTerms, setAgreedToTerms] = useState(false); // Player must agree to T&C to proceed

    // Unified Form State for Persistence
    const [formData, setFormData] = useState({
        // Personal
        email: '', name: '', phone: '', age: '', dob: '', gender: 'Male',
        address: '', adharId: '', emergencyPhone: '', bloodGroup: '',
        playerImage: null, adharImage: null,
        hasHealthIssues: 'No', healthIssueDetails: '',
        // Team
        // Team
        registrationMode: 'Solo', // 'Solo' | 'Team' | 'Duo'
        selectedPredefinedTeam: '',
        teamName: '',
        teamLogo: null,
        teamMembers: [],
        maxTeamSize: 0,
        // Kit
        jerseyName: '', jerseyNumber: '', jerseySize: '38',
        shortsSize: '32', trouserSize: '32',
        // Career & Profile
        careerLevel: 'Amateur',
        careerLevelDetails: '',
        role: '',
        sportAttributes: {}
    });

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        if (formErrors[key]) {
            const newErrors = { ...formErrors };
            delete newErrors[key];
            setFormErrors(newErrors);
        }
    };

    const updateMember = (index, key, value) => {
        const newMembers = [...formData.teamMembers];
        newMembers[index] = { ...newMembers[index], [key]: value };
        updateForm('teamMembers', newMembers);

        // Clear inline error if user types
        const errorKey = index === 0 ? key : `m${index}_${key}`;
        if (formErrors[errorKey]) {
            const newErrors = { ...formErrors };
            delete newErrors[errorKey];
            setFormErrors(newErrors);
        }
    };

    const addMember = () => {
        if (formData.teamMembers.length < formData.maxTeamSize) {
            updateForm('teamMembers', [...formData.teamMembers, {
                name: '', email: '', phone: '', age: '', dob: '', address: '',
                adharId: '', emergencyPhone: '', bloodGroup: '',
                playerImage: null, adharImage: null,
                hasHealthIssues: 'No', healthIssueDetails: '',
                jerseyName: '', jerseyNumber: '', jerseySize: '38',
                shortsSize: '32', trouserSize: '32',
                careerLevel: 'Amateur',
                careerLevelDetails: '',
                role: '',
                experience: '' // Keeping as it might be used somewhere else, but added details
            }]);
            setExpandedMember(formData.teamMembers.length);
        }
    };

    const removeMember = (index) => {
        const newMembers = [...formData.teamMembers];
        newMembers.splice(index, 1);
        updateForm('teamMembers', newMembers);
    };

    // UI State for Team Accordions
    const [expandedMember, setExpandedMember] = useState(0);

    // Helper to get current config
    const getGameConfig = () => {
        if (!tournament) return GAME_CONFIG['Default'];
        return GAME_CONFIG[tournament.gameName] || GAME_CONFIG['Default'];
    };

    const pickImage = async (field, memberIndex = -1) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true, // Request base64 for reliable Web handling
        });

        if (!result.canceled) {
            let imageUri = result.assets[0].uri;

            // WEB FIX: Prioritize Base64 to avoid Blob URL expiration issues
            if (Platform.OS === 'web' && result.assets[0].base64) {
                // Determine mime type if possible, default to jpeg
                const mimeType = result.assets[0].mimeType || 'image/jpeg';
                imageUri = `data:${mimeType};base64,${result.assets[0].base64}`;
            }

            if (memberIndex === -1) {
                updateForm(field, imageUri);
            } else {
                updateMember(memberIndex, field, imageUri);
            }
        }
    };

    const uploadImage = async (uri, path) => {
        if (!uri) return null;
        const storageRef = ref(storage, path);
        const metadata = { customMetadata: { uploaderUid: auth.currentUser?.uid || user?.uid } };

        try {
            // Optimization for Web: Handle Data URLs directly
            if (uri.startsWith('data:')) {
                await uploadString(storageRef, uri, 'data_url', metadata);
                return await getDownloadURL(storageRef);
            }

            // Fallback for Blob URLs (Mobile/Web)
            let response;
            try {
                response = await fetch(uri);
            } catch (networkErr) {
                console.error("Image fetch error:", networkErr);
                throw new Error("Failed to load image file. Please try selecting the photo again.");
            }

            const blob = await response.blob();
            await uploadBytes(storageRef, blob, metadata);
            return await getDownloadURL(storageRef);
        } catch (e) {
            console.error("Upload failed", e);
            throw e;
        }
    };

    // Payment State
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [registrationId, setRegistrationId] = useState(null);
    const [posterVisible, setPosterVisible] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, success, failed, pending
    const [errorMessage, setErrorMessage] = useState('');
    const [visibleTeamMenu, setVisibleTeamMenu] = useState(false);

    // Network status
    const { isOnline } = useNetworkStatus();

    useEffect(() => {
        const init = async () => {
            if (id) {
                // 1. Handle Auth First
                if (!auth.currentUser) {
                    try {
                        await signInAnonymously(auth);
                        console.log("✅ Authenticated as guest");
                    } catch (e) {
                        if (e.code === 'auth/admin-restricted-operation') {
                            console.error("❌ Anonymous Auth is DISABLED in Firebase Dashboard.");
                        } else {
                            console.error("❌ Auth failed:", e.message);
                        }
                    }
                }

                // 2. Load Data
                fetchTournament();
                loadDraft();
            }
        };
        init();
    }, [id]);

    // Load Draft
    const loadDraft = async () => {
        try {
            // Check for local device "memory" of enrollment
            const localEnrolled = await AsyncStorage.getItem(`enrolled_${id}`);
            if (localEnrolled) {
                const data = JSON.parse(localEnrolled);

                // Fetch actual registration from Firestore to get current payment status
                try {
                    const playersQuery = query(
                        collection(db, 'tournaments', id, 'players'),
                        where('email', '==', data.email)
                    );
                    const playersSnap = await getDocs(playersQuery);

                    if (!playersSnap.empty) {
                        const regDoc = playersSnap.docs[0];
                        const regData = { ...regDoc.data(), id: regDoc.id };
                        setExistingRegistration(regData);
                        setIsAlreadyRegistered(true);
                        console.log("✅ Recovered registration from Firestore:", regDoc.id);
                    } else {
                        // Registration not found in Firestore, clean local storage
                        await AsyncStorage.removeItem(`enrolled_${id}`);
                    }
                } catch (firestoreError) {
                    console.log('Error fetching registration from Firestore:', firestoreError);
                    // Fallback to local data without paid status
                    const fallbackId = data.registrationId || data.id || 'RECOVERY_MISSING_ID';
                    setExistingRegistration({
                        ...data,
                        registrationNumber: fallbackId,
                        id: fallbackId,
                        docId: fallbackId
                    });
                    setIsAlreadyRegistered(true);
                }
            }

            const draft = await AsyncStorage.getItem(`draft_${id}`);
            if (draft) {
                setFormData(JSON.parse(draft));
            }
        } catch (e) { console.log('Error loading draft', e); }
    };

    // Save Draft on Change
    useEffect(() => {
        if (id) {
            const timeout = setTimeout(() => {
                AsyncStorage.setItem(`draft_${id}`, JSON.stringify(formData));
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [formData, id]);

    useEffect(() => {
        if (tournament) {
            // Smart Defaults based on Tournament Type and Game Type
            if (tournament.tournamentType === 'Auction') {
                if (formData.registrationMode !== 'Solo') updateForm('registrationMode', 'Solo');
            } else if (tournament.tournamentType === 'Team') {
                if (formData.registrationMode !== 'Team') updateForm('registrationMode', 'Team');
            } else {
                // Normal Tournament
                const defaultType = GAME_TYPE_MAPPING[tournament.gameName] || 'Solo';

                if (defaultType === 'Team') {
                    if (formData.registrationMode !== 'Team') updateForm('registrationMode', 'Team');
                } else if (defaultType === 'Solo') {
                    if (formData.registrationMode !== 'Solo') updateForm('registrationMode', 'Solo');
                } else if (defaultType === 'Hybrid') {
                    if (!['Solo', 'Duo'].includes(formData.registrationMode)) updateForm('registrationMode', 'Solo');
                } else {
                    if (tournament.entryType === 'Team') updateForm('registrationMode', 'Team');
                }
            }

            // Init Team Members Logic
            let targetSize = 0;
            if (tournament.entryType === 'Duo' || formData.registrationMode === 'Duo') targetSize = 2; // Respect Duo mode
            else if (['Solo', 'Single'].includes(formData.registrationMode)) targetSize = 1; // Explicit Solo
            else if (tournament.entryType === 'Team' || (tournament.tournamentType === 'Team') || formData.registrationMode === 'Team') {
                targetSize = tournament.teamSize > 0 ? tournament.teamSize : (GAME_CONFIG[tournament.gameName]?.teamSize || 11);
            }

            if (targetSize > 0) {
                if (formData.maxTeamSize !== targetSize) updateForm('maxTeamSize', targetSize);

                let currentMembers = [...formData.teamMembers];
                let changed = false;

                // Ensure Captain Exists
                if (currentMembers.length === 0) {
                    currentMembers.push({ name: formData.name || '', phone: formData.phone || '', email: formData.email || '', role: '' });
                    changed = true;
                }

                // Enforce Size for Duo (Add Partner Slot)
                if (targetSize === 2 && currentMembers.length < 2) {
                    currentMembers.push({ name: '', phone: '', email: '', role: '' });
                    changed = true;
                }

                // Enforce Size for Solo (Trim)
                if (targetSize === 1 && currentMembers.length > 1) {
                    currentMembers = [currentMembers[0]];
                    changed = true;
                }

                if (changed) updateForm('teamMembers', currentMembers);
            }
        }
    }, [tournament, formData.registrationMode]);

    const fetchTournament = async () => {
        try {
            const docRef = doc(db, 'tournaments', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTournament(data);

                // Removed per-team count query as it requires elevated permissions and causes console noise for guests.
                // Registrations will still work; this data is only for UI decorators.

                if (data.organizerId) {
                    try {
                        const orgDoc = await getDoc(doc(db, 'users', data.organizerId));
                        if (orgDoc.exists()) setOrganizerInfo(orgDoc.data());
                    } catch (orgErr) {
                        console.warn("⚠️ Could not fetch organizer info (Permissions):", orgErr.message);
                    }
                }
            } else {
                Alert.alert('Error', 'Tournament not found');
            }
        } catch (error) {
            console.error("Error fetching tournament:", error);
        } finally {
            if (duoId) {
                try {
                    const getPartnerPublicInfo = httpsCallable(functions, 'getPartnerPublicInfo');
                    const result = await getPartnerPublicInfo({ tournamentId: id, playerId: duoId });

                    if (result.data && result.data.success) {
                        const dData = result.data;
                        setPartner1(dData);
                        // Force Duo mode and inherit team name
                        setFormData(prev => ({
                            ...prev,
                            registrationMode: 'Duo',
                            teamName: dData.teamName || ''
                        }));
                    }
                } catch (e) {
                    console.error("Duo lookup failed:", e.message);
                }
            }
            setLoading(false);
        }
    };

    const performEmailLookup = async (checkEmail) => {
        try {
            // 1. Check for duplicate registration in this tournament (Email)
            const emailQuery = query(
                collection(db, 'tournaments', id, 'players'),
                where('email', '==', checkEmail)
            );
            const emailSnap = await getDocs(emailQuery);

            let regDoc = !emailSnap.empty ? emailSnap.docs[0] : null;
            let regData = regDoc ? { ...regDoc.data(), id: regDoc.id } : null;

            // 2. Check by Phone if not found by email
            if (!regData && formData.phone) {
                const phoneQuery = query(
                    collection(db, 'tournaments', id, 'players'),
                    where('phone', '==', formData.phone.trim())
                );
                const phoneSnap = await getDocs(phoneQuery);
                if (!phoneSnap.empty) {
                    regDoc = phoneSnap.docs[0];
                    regData = { ...regDoc.data(), id: regDoc.id };
                }
            }

            if (regData) {
                // Show registration status regardless of payment
                setExistingRegistration(regData);
                setIsAlreadyRegistered(true);

                if (regData.paid === true) {
                    // Block if already paid
                    Alert.alert(
                        "Already Registered",
                        `You are already registered for this tournament.\n\n` +
                        `Registration ID: ${regData.registrationNumber}\n` +
                        `Tournament: ${tournament?.name}\n\n` +
                        `Organizer: ${organizerInfo?.name || 'N/A'}\n` +
                        `Contact: ${organizerInfo?.phone || 'N/A'}`,
                        [{ text: "OK", onPress: () => setStep(0) }]
                    );
                    return;
                } else {
                    // Payment is pending - allow to proceed to payment
                    Alert.alert(
                        "Pending Registration Found",
                        `You have a pending registration for this tournament.\n\n` +
                        `Registration ID: ${regData.registrationNumber}\n` +
                        `Status: Payment Pending\n\n` +
                        `You can proceed to complete the payment now.`,
                        [
                            { text: "Cancel", style: "cancel" },
                            {
                                text: "Complete Payment", onPress: () => {
                                    // Allow user to proceed - they can complete payment
                                    setIsAlreadyRegistered(false); // Temporarily allow form access
                                }
                            }
                        ]
                    );
                    return;
                }
            }

            // 2. Clear block if not registered
            setIsAlreadyRegistered(false);
            setExistingRegistration(null);

            // 3. Fetch Master Profile to autofill (Wrapped in try-catch, only works if permissions allow)
            try {
                const q = query(collection(db, 'master_players'), where('email', '==', checkEmail));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    const updates = {};
                    if (data.personal) {
                        updates.name = data.personal.name || '';
                        updates.phone = data.personal.phone || '';
                        updates.age = data.personal.age || '';
                        updates.dob = data.personal.dob || '';
                        updates.address = data.personal.address || '';
                        updates.adharId = data.personal.adharId || '';
                        updates.emergencyPhone = data.personal.emergencyPhone || '';
                        updates.bloodGroup = data.personal.bloodGroup || '';
                    }
                    if (data.kit) {
                        updates.jerseyName = data.kit.jerseyName || '';
                        updates.jerseyNumber = data.kit.jerseyNumber || '';
                        updates.jerseySize = data.kit.jerseySize || 'L';
                    }
                    if (data.career) updates.careerLevel = data.career.level || 'Amateur';
                    if (data.gameProfiles && data.gameProfiles[tournament?.gameName]) {
                        const sportData = data.gameProfiles[tournament?.gameName];
                        updates.role = sportData.role || '';
                        updates.sportAttributes = { ...sportData };
                        delete updates.sportAttributes.role; // already set
                    }
                    setFormData(prev => ({ ...prev, ...updates }));
                }
            } catch (masterLookupErr) {
                console.log("Master profile lookup skipped (Permissions)");
            }
        } catch (e) { console.log("Email blur check error:", e); }
    };

    const handleEmailBlur = async () => {
        const emailLower = formData.email.toLowerCase().trim();
        if (!emailLower.includes('@')) return;

        const domain = emailLower.split('@')[1];
        const typoDomains = {
            'gamil.com': 'gmail.com',
            'gmial.com': 'gmail.com',
            'gnail.com': 'gmail.com',
            'gmai.com': 'gmail.com',
            'gmil.com': 'gmail.com',
            'yaho.com': 'yahoo.com',
            'yahooo.com': 'yahoo.com',
            'hotmial.com': 'hotmail.com',
            'outlok.com': 'outlook.com'
        };

        if (typoDomains[domain]) {
            Alert.alert(
                "Check Email Spelling",
                `You entered @${domain}. Did you mean @${typoDomains[domain]}?`,
                [
                    { text: "No, keep it", onPress: () => performEmailLookup(emailLower) },
                    { text: "Yes, fix it", onPress: () => updateForm('email', emailLower.replace(domain, typoDomains[domain])) }
                ]
            );
            return;
        }

        performEmailLookup(emailLower);
    };

    const validateStep = () => {
        setFormErrors({}); // Reset errors
        // Only block if registration is already paid
        if (isAlreadyRegistered && existingRegistration?.paid === true) {
            Alert.alert("Action Blocked", "You are already registered for this tournament with payment completed.");
            return false;
        }
        if (step === 0) return true;

        if (step === 1) {
            if (formData.registrationMode === 'Team') {
                if (tournament.tournamentType === 'Team') {
                    if (!formData.selectedPredefinedTeam) { Alert.alert("Required", "Please select a team."); return false; }
                    return true;
                }
                if (formData.selectedPredefinedTeam && formData.selectedPredefinedTeam !== 'Custom Team') return true;
                if (!formData.teamName.trim()) {
                    setFormErrors({ teamName: 'Team Name is required' });
                    return false;
                }
            }
            return true;
        }

        if (step === 2) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^\d{10}$/;
            const aadharRegex = /^\d{12}$/;
            const dobRegex = /^\d{2}-\d{2}-\d{4}$/;

            const errors = {};

            const validatePlayer = (data, prefix = "") => {
                let isValid = true;
                const checkField = (key, label, rules = {}) => {
                    const val = data[key];
                    if (!val || (typeof val === 'string' && !val.trim())) {
                        errors[`${prefix}${key}`] = `${label} is required`;
                        isValid = false;
                    } else if (rules.regex && !rules.regex.test(val)) {
                        errors[`${prefix}${key}`] = rules.errMsg;
                        isValid = false;
                    } else if (rules.check && !rules.check(val)) {
                        errors[`${prefix}${key}`] = rules.errMsg;
                        isValid = false;
                    }
                };

                checkField('name', 'Name');
                checkField('email', 'Email', { regex: emailRegex, errMsg: 'Invalid email format' });
                checkField('phone', 'Phone', { regex: phoneRegex, errMsg: 'Phone must be 10 digits' });
                checkField('address', 'Address');
                checkField('age', 'Age', { check: (v) => !isNaN(v) && Number(v) > 0, errMsg: 'Age must be a valid number' });
                checkField('dob', 'DOB', { regex: dobRegex, errMsg: 'Use DD-MM-YYYY' });
                checkField('adharId', 'Aadhar Number', { regex: aadharRegex, errMsg: 'Must be 12 digits' });
                checkField('emergencyPhone', 'Emergency Contact', { regex: phoneRegex, errMsg: 'Must be 10 digits' });
                checkField('playerImage', 'Photo');
                checkField('adharImage', 'Aadhar Photo');
                checkField('role', 'Primary Role');
                checkField('jerseySize', 'Jersey Size');
                checkField('shortsSize', 'Shorts Size');
                checkField('trouserSize', 'Trouser Size');

                if (data.careerLevel === 'District') {
                    checkField('careerLevelDetails', 'District Name');
                } else if (data.careerLevel === 'State') {
                    checkField('careerLevelDetails', 'State Name');
                }

                if (data.hasHealthIssues === 'Yes' && !data.healthIssueDetails?.trim()) {
                    errors[`${prefix}healthIssueDetails`] = 'Please mention health issues';
                    isValid = false;
                }

                if (prefix === "") { // Only for main player
                    if (!data.jerseyName?.trim()) { errors.jerseyName = 'Required'; isValid = false; }
                    if (!data.jerseyNumber?.trim()) { errors.jerseyNumber = 'Required'; isValid = false; }
                }

                return isValid;
            };

            const mainValid = validatePlayer(formData, "");

            let rosterValid = true;
            if (!(formData.registrationMode === 'Team' && formData.selectedPredefinedTeam && formData.selectedPredefinedTeam !== 'Custom Team')) {
                if (formData.registrationMode === 'Team' || (tournament.entryType === 'Duo' && formData.registrationMode !== 'Solo')) {
                    if (formData.teamMembers.length < (tournament.entryType === 'Duo' ? 2 : 1)) {
                        Alert.alert("Roster", "Please add team members.");
                        return false;
                    }
                    formData.teamMembers.forEach((m, i) => {
                        if (i > 0) { // Skip captain as already done
                            // Skip validation for Partner (index 1) in Duo mode as they are invited
                            if (tournament.entryType === 'Duo' && i === 1) return;

                            if (!validatePlayer(m, `m${i}_`)) {
                                rosterValid = false;
                                setExpandedMember(i);
                            }
                        }
                    });
                }
            }

            if (!mainValid || !rosterValid) {
                setFormErrors(errors);
                Alert.alert("Form Error", "Please check the highlighted fields and fill all mandatory details.");
                return false;
            }
            return true;
        }
        return true;
    };

    // Unified Payment Handler
    const processPayment = async (playerId, amount, playerName) => {
        console.log(`💳 processPayment call: playerId param=${playerId}, amount=${amount}`);

        // Resolve playerId from existingRegistration if parameter is missing/null/undefined
        let resolvedPlayerId = playerId;
        if (!resolvedPlayerId || resolvedPlayerId === 'undefined' || resolvedPlayerId === 'null') {
            if (existingRegistration) {
                resolvedPlayerId = existingRegistration.id || existingRegistration.docId || existingRegistration.registrationNumber;
                console.log(`🔍 Resolved playerId from State: ${resolvedPlayerId} (Source: ${existingRegistration.id ? 'id' : (existingRegistration.docId ? 'docId' : 'regNum')})`);
            }
        }

        // Final safety check before proceeding
        if (!resolvedPlayerId || String(resolvedPlayerId) === 'undefined' || String(resolvedPlayerId) === 'null') {
            console.error("❌ ABORTING: No record ID found for this registration.", {
                passedId: playerId,
                state: existingRegistration
            });
            Alert.alert(
                "System Error",
                "We couldn't link your payment to your registration ID. Please refresh the page and try again.",
                [{ text: "Refresh", onPress: () => router.replace(`/tournament/${id}`) }]
            );
            setPaymentStatus('failed');
            return false;
        }

        const finalPlayerIdStr = String(resolvedPlayerId).trim();
        console.log(`✅ Proceeding with resolvedPlayerId: "${finalPlayerIdStr}"`);

        setPaymentStatus('pending');
        setPaymentModalVisible(true);
        setErrorMessage('');

        let transactionId = null;
        try {
            // 1. Create a transaction record in Firestore via Backend
            console.log("Creating transaction record...");
            transactionId = await TransactionService.initiatePlayerPayment({
                tournamentId: id,
                amount: amount,
                playerName: playerName,
                playerId: finalPlayerIdStr,
                source: 'tournament_registration',
                isDuoJoining: !!duoId
            });
            console.log("Transaction ID created:", transactionId);

            // 2. Open Razorpay Checkout (uses Razorpay Route internally)
            console.log("Opening Razorpay checkout...");
            const paymentResponse = await RazorpayService.openCheckout({
                tournamentId: String(id),
                playerId: finalPlayerIdStr,
                amount: amount,
                playerName: playerName,
                transactionId: transactionId,
                name: tournament.name,
                description: `Registration for ${tournament.gameName}`,
                prefill: {
                    name: playerName,
                    email: formData.email,
                    contact: formData.phone
                },
                theme: { color: '#1a237e' }
            });

            console.log("Checkout complete, response received:", paymentResponse);

            // 3. Server-side Verification (CRITICAL for confirmation)
            console.log("Verifying payment on server...");
            const verificationResult = await TransactionService.verifyPayment({
                ...paymentResponse,
                tournamentId: id,
                playerId: playerId,
                transactionId: transactionId
            });

            if (verificationResult.success || verificationResult.status === 'captured') {
                console.log("✅ Payment Verified Successfully");
                setPaymentStatus('success');
                setRegistrationId(playerId); // Using document ID as registration ID reference

                // Show success poster after short delay
                setTimeout(() => {
                    setPaymentModalVisible(false);
                    setPosterVisible(true);
                }, 1500);

                return true;
            } else {
                throw new Error("Payment verification failed on server. Please contact support if amount was debited.");
            }
        } catch (error) {
            console.error("❌ Payment Process Error:", error);
            setPaymentStatus('failed');

            // Map common error messages
            let msg = error.message || "Payment failed or cancelled.";
            if (msg.includes("cancelled")) msg = "Payment was cancelled. You can retry from your dashboard.";
            if (msg.includes("verification")) msg = "We couldn't verify your payment. Please check your bank statement and contact us if money was deducted.";

            setErrorMessage(msg);
            return false;
        }
    };

    const nextStep = () => {
        if (validateStep()) setStep(step + 1);
    };

    const prevStep = () => setStep(step - 1);

    // Payment Recovery Functions
    const savePendingPayment = async (paymentData) => {
        try {
            await AsyncStorage.setItem(`pending_payment_${id}`, JSON.stringify({
                tournamentId: id,
                registrationId: paymentData.registrationId,
                amount: tournament.entryFee,
                timestamp: Date.now(),
                playerEmail: formData.email,
                playerPhone: formData.phone
            }));
        } catch (error) {
            console.error('Error saving pending payment:', error);
        }
    };

    const clearPendingPayment = async () => {
        try {
            await AsyncStorage.removeItem(`pending_payment_${id}`);
        } catch (error) {
            console.error('Error clearing pending payment:', error);
        }
    };

    const checkPendingPayments = async () => {
        try {
            const pendingPayment = await AsyncStorage.getItem(`pending_payment_${id}`);
            if (!pendingPayment) return;

            const paymentData = JSON.parse(pendingPayment);

            // Check if payment was completed (query Firestore)
            if (paymentData.registrationId && paymentData.registrationId !== 'new') {
                const playerDoc = await getDoc(doc(db, 'tournaments', id, 'players', paymentData.registrationId));

                if (playerDoc.exists()) {
                    const data = playerDoc.data();

                    if (data.paid === true) {
                        // Payment was successful!
                        await clearPendingPayment();
                        setExistingRegistration({ ...data, id: playerDoc.id });
                        setRegistrationId(data.registrationNumber);
                        Alert.alert(
                            "Payment Confirmed!",
                            `Your payment was successfully processed.\n\nRegistration ID: ${data.registrationNumber}`
                        );
                    } else {
                        // Payment still pending - offer to retry
                        Alert.alert(
                            "Pending Payment Found",
                            "We found an incomplete payment. Would you like to verify the status or retry?",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Verify Status",
                                    onPress: () => verifyPaymentStatus(paymentData)
                                },
                                {
                                    text: "Retry Payment",
                                    onPress: () => {
                                        clearPendingPayment();
                                        setStep(3); // Go to payment step
                                    }
                                }
                            ]
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Error checking pending payments:', error);
        }
    };

    const verifyPaymentStatus = async (paymentData) => {
        setLoading(true);
        try {
            const playerDoc = await getDoc(doc(db, 'tournaments', id, 'players', paymentData.registrationId));

            if (playerDoc.exists() && playerDoc.data().paid === true) {
                await clearPendingPayment();
                Alert.alert("Success", "Payment confirmed! Your registration is complete.");
                setExistingRegistration({ ...playerDoc.data(), id: playerDoc.id });
                setRegistrationId(playerDoc.data().registrationNumber);
            } else {
                Alert.alert(
                    "Payment Pending",
                    "Payment is still being processed. This may take a few minutes. Please check back shortly or contact support."
                );
            }
        } catch (error) {
            Alert.alert("Error", "Unable to verify payment status. Please check your internet connection.");
        } finally {
            setLoading(false);
        }
    };

    // Check pending payments when online
    useEffect(() => {
        if (isOnline && id) {
            checkPendingPayments();
        }
    }, [isOnline, id]);

    const confirmPayment = async () => {
        // Check internet connection before payment
        if (!isOnline) {
            Alert.alert(
                "No Internet Connection",
                "Payment processing requires an active internet connection. Please check your connection and try again."
            );
            return;
        }

        // Only block if registration is already paid
        if (isAlreadyRegistered && existingRegistration?.paid === true) {
            Alert.alert("Error", "You are already registered for this tournament with payment completed.");
            return;
        }
        setPaymentModalVisible(true);
        setPaymentProcessing(true);
        setPaymentStatus('pending');
        setErrorMessage('');

        // Save pending payment before creating registration
        await savePendingPayment({
            registrationId: 'new',
            playerEmail: formData.email,
            playerPhone: formData.phone
        });

        try {
            // 0. Ensure Authentication (Vital for DB/Storage Permissions)
            // MOVED TO TOP: Must happen before any DB reads (like duplicate checks)
            let currentUser = auth.currentUser || user;
            if (!currentUser) {
                console.log("Not signed in, forcing anonymous login...");
                try {
                    const result = await signInAnonymously(auth);
                    currentUser = result.user;
                    // FORCED DELAY: Ensure session propagates before the next write
                    console.log("Wait for session sync...");
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) {
                    console.error("Auth Error details:", e);
                    if (e.code === 'auth/admin-restricted-operation' || e.message?.includes('400')) {
                        throw new Error("CRITICAL: Anonymous Login is DISABLED in Firebase. Go to Authentication > Sign-in method > Enable Anonymous & Save.");
                    }
                    throw new Error(`Authentication failed: ${e.message}`);
                }
            }

            if (!currentUser) throw new Error("Could not establish a secure connection (Auth failed).");
            console.log("Authenticated as:", currentUser.uid);
            console.log("Proceeding with User ID:", currentUser?.uid);

            // Final check just in case (Email & Phone)
            const playerCol = collection(db, 'tournaments', id, 'players');
            const emailQ = query(playerCol, where('email', '==', formData.email.toLowerCase().trim()));
            const phoneQ = query(playerCol, where('phone', '==', formData.phone.trim()));

            const [eSnap, pSnap] = await Promise.all([getDocs(emailQ), getDocs(phoneQ)]);
            const existing = !eSnap.empty ? eSnap.docs[0] : (!pSnap.empty ? pSnap.docs[0] : null);

            let existingData = existing ? existing.data() : null;
            let existingDocId = existing ? existing.id : null;

            if (existingData) {
                // Block if payment is already completed
                if (existingData.paid === true) {
                    setExistingRegistration({ ...existingData, id: existingDocId });
                    setIsAlreadyRegistered(true);
                    throw new Error(`You are already registered (ID: ${existingData.registrationNumber}). Payment completed. Please contact the organizer if you have questions.`);
                } else {
                    // Payment is pending - allow retry payment with existing registration
                    console.log('Pending registration found. Allowing payment retry with existing registration:', existingData.registrationNumber);

                    // Set the registration ID so user can see it
                    setRegistrationId(existingData.registrationNumber);

                    // Save pending payment for recovery
                    await savePendingPayment({
                        registrationId: existingDocId
                    });

                    // Step A: Check Status for existing transactions to prevent double-charging
                    const transactionsCol = collection(db, 'transactions');
                    const existingTxQ = query(
                        transactionsCol,
                        where('playerId', '==', existingDocId),
                        where('tournamentId', '==', id),
                        where('status', 'in', ['PENDING', 'SUCCESS'])
                    );
                    const txSnap = await getDocs(existingTxQ);

                    if (!txSnap.empty) {
                        const activeTx = txSnap.docs[0].data();
                        if (activeTx.status === 'SUCCESS') {
                            Alert.alert("Already Paid", "This registration is already paid. It may take a minute to update.");
                            setPaymentProcessing(false);
                            setPaymentModalVisible(false);
                            return;
                        } else {
                            // PENDING - suggest waiting or provide transaction ID
                            Alert.alert("Payment Pending", "There is already a pending payment for this registration. Please wait 1-2 minutes or check your bank statement.");
                            setPaymentProcessing(false);
                            setPaymentModalVisible(false);
                            return;
                        }
                    }

                    // 1. Initiate Transaction
                    const transactionId = await TransactionService.initiatePlayerPayment({
                        tournamentId: id,
                        amount: tournament.entryFee,
                        playerName: existingData.playerName || formData.name,
                        playerId: existingDocId,
                        source: Platform.OS === 'web' ? 'Web' : 'Mobile'
                    });

                    // 2. Open Checkout with Razorpay Route (automatic 95/5 split)
                    const paymentResponse = await RazorpayService.openCheckout({
                        tournamentId: String(id),
                        playerId: String(existingDocId),
                        amount: tournament.entryFee,
                        playerName: existingData.playerName || formData.name,
                        transactionId: transactionId,
                        name: tournament.name,
                        description: `Registration for ${tournament.gameName}`,
                        prefill: {
                            name: existingData.playerName || formData.name,
                            email: existingData.email || formData.email,
                            contact: existingData.phone || formData.phone
                        },
                        theme: { color: '#1a237e' }
                    });

                    if (!paymentResponse || !paymentResponse.razorpay_payment_id) {
                        setPaymentProcessing(false);
                        return; // Handle cancellation/dismissal - polling will catch if webhook arrives late
                    }

                    // 3. Subscribe to Transaction Status (Polling/Real-time)
                    const unsubscribe = TransactionService.subscribeToTransaction(transactionId, (data) => {
                        console.log("💰 Transaction Update:", data.status);
                        if (data.status === 'SUCCESS') {
                            setPaymentStatus('success');
                            clearPendingPayment();
                            setTimeout(() => {
                                setPaymentModalVisible(false);
                                setPosterVisible(true);
                                unsubscribe();
                            }, 1500);
                        } else if (data.status === 'FAILED') {
                            setPaymentStatus('failed');
                            setErrorMessage(data.failureReason || 'Payment failed. Please try again.');
                            unsubscribe();
                        }
                    });

                    // Set timeout to stop polling after some time
                    setTimeout(() => unsubscribe(), 60000);

                    setPaymentProcessing(false);
                    return; // Exit early, don't create new registration
                }
            }

            // Check Team Members for duplicates
            if (formData.registrationMode === 'Team' && formData.teamMembers.length > 0) {
                for (const member of formData.teamMembers) {
                    if (!member.email && !member.phone) continue;

                    const mEmailQ = member.email ? query(playerCol, where('email', '==', member.email.toLowerCase().trim())) : null;
                    const mPhoneQ = member.phone ? query(playerCol, where('phone', '==', member.phone.trim())) : null;

                    const [meSnap, mpSnap] = await Promise.all([
                        mEmailQ ? getDocs(mEmailQ) : Promise.resolve({ empty: true }),
                        mPhoneQ ? getDocs(mPhoneQ) : Promise.resolve({ empty: true })
                    ]);

                    if (!meSnap.empty || !mpSnap.empty) {
                        const mData = !meSnap.empty ? meSnap.docs[0].data() : mpSnap.docs[0].data();
                        // Block ANY existing registration for team members
                        if (mData.paid === true) {
                            throw new Error(`Team member ${member.name} is already registered (ID: ${mData.registrationNumber}). Payment completed.`);
                        } else {
                            throw new Error(`Team member ${member.name} already has a pending registration (ID: ${mData.registrationNumber}). Please complete that payment first.`);
                        }
                    }
                }
            }


            // 1. Pre-flight Validation & Sanitization (Vital for DB/Storage Permissions)
            const sanitizedPhone = (formData.phone || '').replace(/[^0-9]/g, '').slice(-10);
            const sanitizedEmail = (formData.email || '').toLowerCase().trim();
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

            if (sanitizedPhone.length !== 10) throw new Error("Validation Error: Phone must be 10 digits (0-9 only).");
            if (!emailRegex.test(sanitizedEmail)) throw new Error("Validation Error: Invalid email format.");

            // 2. Determine Payable Amount
            let payableAmount = tournament.entryFee;

            // If joining a duo that was already paid for
            if (duoId && partner1?.paidForPartner) {
                payableAmount = 0;
                console.log("💰 Partner already paid for this duo. Entry fee set to 0.");
            } else if (formData.registrationMode === 'Duo' && payForPartner && !duoId) {
                payableAmount = tournament.entryFee * 2;
                console.log(`💰 Captain paying for both: ${payableAmount}`);
            }

            // 3. Upload Images First (Preparation)
            // Ensure unique filenames every time to hit 'resource == null' rule
            const timestamp = Date.now();
            const playerImgUrl = await uploadImage(formData.playerImage, `players/${sanitizedEmail}/profile_${timestamp}.jpg`);
            const adharImgUrl = await uploadImage(formData.adharImage, `players/${sanitizedEmail}/adhar_${timestamp}.jpg`);

            let finalTeamLogo = null;
            if (formData.teamLogo && !formData.teamLogo.startsWith('http')) {
                finalTeamLogo = await uploadImage(formData.teamLogo, `tournaments/${id}/teams/${Date.now()}_logo.jpg`);
            }

            const processedMembers = [];
            if ((formData.registrationMode === 'Team' || tournament.entryType === 'Duo') && formData.teamMembers.length > 0) {
                for (const member of formData.teamMembers) {
                    if (member.name && (member.email || member.phone)) {
                        let memberProfile = { ...member };
                        if (member.playerImage && !member.playerImage.startsWith('http')) {
                            memberProfile.playerImgUrl = await uploadImage(member.playerImage, `players/${member.email || member.phone}/profile_${Date.now()}.jpg`);
                        }
                        if (member.adharImage && !member.adharImage.startsWith('http')) {
                            memberProfile.adharImgUrl = await uploadImage(member.adharImage, `players/${member.email || member.phone}/adhar_${Date.now()}.jpg`);
                        }
                        processedMembers.push(memberProfile);
                    }
                }
            }

            // Step 3 & 4 logic follows...


            // 3. Prepare Registration Data
            const profileData = {
                email: sanitizedEmail,
                userId: currentUser.uid,
                personal: {
                    name: formData.name, phone: formData.phone, age: formData.age, dob: formData.dob,
                    gender: formData.gender, address: formData.address, adharId: formData.adharId,
                    emergencyPhone: formData.emergencyPhone, bloodGroup: formData.bloodGroup,
                    playerImgUrl, adharImgUrl
                },
                kit: { jerseyName: formData.jerseyName, jerseyNumber: formData.jerseyNumber, jerseySize: formData.jerseySize },
                career: { level: formData.careerLevel },
                gameProfiles: {
                    [tournament.gameName]: {
                        role: formData.role,
                        ...formData.sportAttributes
                    }
                },
                lastActive: new Date().toISOString()
            };

            // 4. Create Registration Doc
            const uniqueNum = `REG-${Date.now().toString().slice(-6)}`;
            const registrationDoc = {
                registrationNumber: uniqueNum,
                playerName: formData.name,
                email: sanitizedEmail,
                phone: sanitizedPhone,
                userId: currentUser?.uid || null,
                teamName: (formData.registrationMode === 'Team' && formData.selectedPredefinedTeam && formData.selectedPredefinedTeam !== 'Custom Team') ? formData.selectedPredefinedTeam : (formData.teamName || 'Solo'),
                teamLogo: finalTeamLogo,
                teamMembers: processedMembers.length > 0 ? processedMembers : null,
                entryType: formData.registrationMode,
                partnerDuoId: duoId || null, // Link to partner if joining
                isDuoSource: formData.registrationMode === 'Duo' && !duoId, // Mark as first of duo
                paidForPartner: (formData.registrationMode === 'Duo' && payForPartner && !duoId),
                data: profileData,
                paid: payableAmount === 0, // Paid if free, otherwise false
                paidAmount: payableAmount,
                registeredAt: new Date().toISOString(),
                status: payableAmount === 0 ? 'approved' : 'pending'
            };

            console.log("📝 Step 1: Writing to Player Subcollection...");
            let docRef;
            try {
                docRef = await addDoc(collection(db, 'tournaments', id, 'players'), registrationDoc);
                setRegistrationDocId(docRef.id);
                console.log("✅ Registration initialised:", docRef.id);
            } catch (playerWriteErr) {
                console.error("❌ Player Write Failed:", playerWriteErr);
                throw new Error(`Permission Denied at Player creation: ${playerWriteErr.message}`);
            }

            // Increment playerCount skip for now (security rules block direct player updates)
            // This should be done via Cloud Functions or Triggers

            // Set registration ID immediately so user can see it
            setRegistrationId(uniqueNum);

            // Save enrollment record for device memory
            await AsyncStorage.setItem(`enrolled_${id}`, JSON.stringify({
                registrationId: uniqueNum,
                tournamentId: id,
                email: formData.email
            }));

            console.log("🔍 DEBUG: About to send registration email...");
            // Send Registration Confirmation Email
            try {
                const emailData = {
                    to: sanitizedEmail,
                    message: {
                        subject: `Registration Confirmed - ${tournament.name}`,
                        html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            </head>
                            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
                                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
                                    <tr>
                                        <td align="center">
                                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                                <!-- Header -->
                                                <tr>
                                                    <td style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); padding: 40px 30px; text-align: center;">
                                                        <div style="width: 80px; height: 80px; background-color: white; border-radius: 50%; margin: 0 auto 20px; display: inline-flex; align-items: center; justify-content: center;">
                                                            <span style="font-size: 40px;">🎮</span>
                                                        </div>
                                                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Registration Confirmed!</h1>
                                                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Welcome to ${tournament.name}</p>
                                                    </td>
                                                </tr>
                                                <!-- Content -->
                                                <tr>
                                                    <td style="padding: 40px 30px;">
                                                        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                                            Hello <strong>${formData.name}</strong>,
                                                        </p>
                                                        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                                            Thank you for registering for <strong>${tournament.name}</strong>! Your registration has been received.
                                                        </p>
                                                        <!-- Registration Details Box -->
                                                        <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%); border-radius: 12px; padding: 25px; margin: 30px 0; border: 2px solid #1a237e;">
                                                            <h3 style="color: #1a237e; margin: 0 0 20px 0; font-size: 18px; text-align: center;">📋 Registration Details</h3>
                                                            <table width="100%" cellpadding="10" cellspacing="0">
                                                                <tr>
                                                                    <td style="color: #666; font-size: 14px; font-weight: 600; width: 50%;">Registration ID:</td>
                                                                    <td style="color: #333; font-size: 14px; font-family: 'Courier New', monospace; text-align: right;">${uniqueNum}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td style="color: #666; font-size: 14px; font-weight: 600;">Player Name:</td>
                                                                    <td style="color: #333; font-size: 14px; text-align: right;">${formData.name}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td style="color: #666; font-size: 14px; font-weight: 600;">Email:</td>
                                                                    <td style="color: #333; font-size: 14px; text-align: right;">${formData.email}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td style="color: #666; font-size: 14px; font-weight: 600;">Phone:</td>
                                                                    <td style="color: #333; font-size: 14px; text-align: right;">${formData.phone}</td>
                                                                </tr>
                                                                ${formData.teamName ? `
                                                                <tr>
                                                                    <td style="color: #666; font-size: 14px; font-weight: 600;">Team:</td>
                                                                    <td style="color: #333; font-size: 14px; text-align: right;">${formData.teamName}</td>
                                                                </tr>
                                                                ` : ''}
                                                                <tr style="border-top: 2px solid #e0e0e0;">
                                                                    <td style="color: #1a237e; font-size: 16px; font-weight: 700; padding-top: 15px;">Entry Fee:</td>
                                                                    <td style="color: #1a237e; font-size: 18px; font-weight: 700; text-align: right; padding-top: 15px;">₹${payableAmount}</td>
                                                                </tr>
                                                            </table>
                                                        </div>
                                                        <!-- Payment Status -->
                                                        <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                                            <p style="color: #e65100; font-size: 14px; margin: 0; line-height: 1.6;">
                                                                <strong>⏳ Payment Pending:</strong><br>
                                                                Please complete your payment to confirm your spot. You will receive a payment confirmation email once the payment is successful.
                                                            </p>
                                                        </div>
                                                        <!-- Tournament Info -->
                                                        <h3 style="color: #1a237e; margin: 30px 0 15px 0; font-size: 18px;">🎮 Tournament Information</h3>
                                                        <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #f9f9f9; border-radius: 8px;">
                                                            <tr>
                                                                <td style="color: #666; font-size: 14px; padding: 10px;">📋 Tournament:</td>
                                                                <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournament.name}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="color: #666; font-size: 14px; padding: 10px;">🎮 Game:</td>
                                                                <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournament.gameName}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="color: #666; font-size: 14px; padding: 10px;">📅 Date:</td>
                                                                <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournament.startDate || 'TBA'}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="color: #666; font-size: 14px; padding: 10px;">📍 Venue:</td>
                                                                <td style="color: #333; font-size: 14px; font-weight: 600; padding: 10px;">${tournament.venue || 'TBA'}</td>
                                                            </tr>
                                                        </table>
                                                        <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center; font-style: italic;">
                                                            Keep this email for your records. Your registration ID is: <strong>${uniqueNum}</strong>
                                                        </p>
                                                        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 10px 0;">
                                                            See you at the tournament!
                                                        </p>
                                                        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                                                            <strong>Force Player Register Team</strong>
                                                        </p>
                                                    </td>
                                                </tr>
                                                <!-- Footer -->
                                                <tr>
                                                    <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                                                        <p style="color: #666; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Force Player Register</p>
                                                        <p style="color: #999; font-size: 12px; margin: 0 0 15px 0;">Tournament Management System</p>
                                                        <p style="color: #999; font-size: 11px; margin: 0; line-height: 1.5;">© 2026 Force Player Register. All rights reserved.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </body>
                            </html>
                        `
                    }
                };

                console.log("📧 Step 2: Attempting to queue registration email...");
                // Queue email via Firebase Extension
                const mailRef = await addDoc(collection(db, 'mail'), emailData);
                console.log("✅ Registration confirmation email queued successfully!", mailRef.id);
            } catch (emailError) {
                console.warn("⚠️ Failed to queue registration email (ignoring):", emailError.message);
                // Don't block registration if email fails
            }

            // 5. Handle Payment
            if (payableAmount > 0) {
                const success = await processPayment(docRef.id, payableAmount, formData.name);
                if (!success) {
                    setLoading(false);
                    return;
                }
            } else {
                console.log("Free entry registration confirmed.");
                setRegistrationId(uniqueNum);
                setPosterVisible(true);
            }


            // 7. Update Master Records (Optional - might fail for guests)
            try {
                const masterRef = doc(db, 'master_players', formData.email.toLowerCase().trim());
                await setDoc(masterRef, {
                    ...profileData,
                    enrolledTournaments: arrayUnion({
                        tournamentId: id,
                        tournamentName: tournament.name,
                        gameName: tournament.gameName,
                        date: new Date().toISOString().split('T')[0],
                        role: formData.registrationMode === 'Team' ? 'Captain' : 'Player'
                    })
                }, { merge: true });
            } catch (masterErr) {
                console.warn("⚠️ Master profile update skipped:", masterErr.message);
            }

            await AsyncStorage.removeItem(`draft_${id}`);

            // Registration ID already set above,
            // Payment successful
            setPaymentStatus('success');

            // Clear pending payment on success or set existing registration for UI
            await clearPendingPayment();
            setExistingRegistration({ ...registrationDoc, id: docRef.id });
            setIsAlreadyRegistered(true);

            setTimeout(() => {
                setPaymentModalVisible(false);
                setPosterVisible(true);
            }, 1000);

        } catch (error) {
            console.error("❌ Full Registration Failure Details:", error);

            if (error.message && error.message.includes('Payment Cancelled')) {
                setPaymentStatus('idle');
                setPaymentModalVisible(false);
            } else {
                setPaymentStatus('failed');
                let userFriendlyMsg = error.message || "An unexpected error occurred.";

                if (userFriendlyMsg.includes("Missing or insufficient permissions")) {
                    userFriendlyMsg = "Permission Denied: Either you aren't signed in properly (Anonymous Auth) or your data (Phone/Email) violated security rules. Please check your inputs and try again.";
                }

                const fullError = `${error.code ? '[' + error.code + '] ' : ''}${userFriendlyMsg}`;
                setErrorMessage(fullError);
                Alert.alert("Registration Error", fullError);
            }
        } finally {
            setPaymentProcessing(false);
        }
    };




    // --- RENDERERS ---

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
    if (!tournament) return <View style={styles.center}><Title>Tournament not found.</Title></View>;

    // Check for "Registration Closed" (Completed, Access Expired, or Reg Deadline Passed)
    const isRegistrationClosed = () => {
        if (tournament.status === 'completed') return true;
        const now = new Date();

        // Access Expiry (Exact Timestamp)
        if (tournament.accessExpiryDate && now > new Date(tournament.accessExpiryDate)) return true;

        // Registration Deadline (Date Only - Inclusive)
        if (tournament.registrationLastDate) {
            const regDeadline = new Date(tournament.registrationLastDate);
            // Allow registration until the end of the deadline day
            regDeadline.setHours(23, 59, 59, 999);
            if (now > regDeadline) return true;
        }
        return false;
    };

    if (isRegistrationClosed()) {
        return (
            <LinearGradient colors={['#eee', '#ddd']} style={styles.center}>
                <Surface style={[styles.successCard, { padding: 30 }]} elevation={5}>
                    <Avatar.Icon size={80} icon="lock-clock" style={{ backgroundColor: '#757575' }} />
                    <Title style={[styles.successTitle, { color: '#616161' }]}>Registration Closed</Title>
                    <Text style={{ textAlign: 'center', marginBottom: 20, color: '#616161', fontSize: 16 }}>
                        This tournament has ended or is no longer accepting new registrations.
                    </Text>
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>{tournament.name}</Text>
                        <Text style={{ textAlign: 'center', color: 'gray' }}>{tournament.gameName}</Text>
                    </View>
                    <Button mode="outlined" style={{ marginTop: 10, width: '100%', borderRadius: 8 }} onPress={() => router.replace('/')}>
                        Home
                    </Button>
                </Surface>
            </LinearGradient>
        );
    }

    // Only show success screen if payment is completed
    if (registrationId && paymentStatus === 'success') return (
        <LinearGradient colors={['#1a237e', '#4527a0']} style={styles.center}>
            <Surface style={styles.successCard} elevation={5}>
                <Avatar.Icon size={80} icon="check-all" style={{ backgroundColor: '#4CAF50' }} />
                <Title style={styles.successTitle}>Registration Confirmed!</Title>
                <Text style={{ textAlign: 'center', marginBottom: 20, color: 'gray', paddingHorizontal: 20 }}>
                    {formData.registrationMode === 'Duo'
                        ? (payForPartner
                            ? `Full Team Entry Confirmed. You have paid for both players in ${tournament.name}.`
                            : `Individual Entry Confirmed. You have paid your share for ${tournament.name}. Your partner still needs to register.`)
                        : `Welcome to ${tournament.name}. Your entry is confirmed.`
                    }
                </Text>
                <View style={styles.ticket}>
                    <Text style={styles.ticketLabel}>ENTRY NUMBER</Text>
                    <Title style={{ fontSize: 28, letterSpacing: 2 }}>{registrationId}</Title>
                </View>

                {/* Duo Share Link */}
                {formData.registrationMode === 'Duo' && !duoId && (
                    <View style={{ marginTop: 25, width: '100%', padding: 15, backgroundColor: '#E8EAF6', borderRadius: 12, borderLeftWidth: 5, borderLeftColor: '#3F51B5' }}>
                        <Text style={{ fontWeight: 'bold', color: '#1A237E', marginBottom: 5 }}>Duo Partner Link</Text>
                        <Text style={{ fontSize: 13, color: '#555', marginBottom: 15 }}>
                            {payForPartner
                                ? "You have paid for both players. Share this link with your partner so they can register for free."
                                : "Share this link with your partner so they can register and pay their share."
                            }
                        </Text>
                        <Button
                            mode="contained"
                            icon="share-variant"
                            onPress={() => {
                                const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
                                const shareUrl = `${domain}/tournament/${id}?duoId=${registrationDocId}`;
                                Share.share({
                                    message: payForPartner
                                        ? `Hey! I've paid for our Duo in ${tournament.name}. Register yourself for FREE here: ${shareUrl}`
                                        : `Hey! I've registered for ${tournament.name}. Join my duo/team here: ${shareUrl}`,
                                    url: shareUrl
                                });
                            }}
                            style={{ borderRadius: 8 }}
                        >
                            Share with Partner
                        </Button>
                    </View>
                )}

                <Button mode="contained" style={{ marginTop: 20, width: '100%', borderRadius: 8 }} onPress={() => router.replace('/')}>
                    Return to Home
                </Button>
            </Surface>
        </LinearGradient>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                <View style={styles.webContainer}>

                    {/* Header */}
                    <Surface style={styles.headerContainer} elevation={4}>
                        {/* ... (Header code remains mostly same, keeping simplified for length, assume unchanged functionality) ... */}
                        <LinearGradient colors={['#311b92', '#6200ea']} style={styles.headerGradient}>
                            <View style={styles.headerTop}>
                                <Button icon="arrow-left" mode="text" textColor="white" onPress={() => router.back()}>Back</Button>
                                <Chip icon="trophy" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} textStyle={{ color: 'white' }}>{tournament.tournamentType}</Chip>
                            </View>
                            <Title style={styles.headerTitle}>{tournament.name}</Title>
                            <Text style={styles.headerSubtitle}><MaterialCommunityIcons name="gamepad-variant" /> {tournament.gameName} · {tournament.entryType} Entry</Text>
                        </LinearGradient>
                    </Surface>

                    {/* Joining Duo Partner Info */}
                    {partner1 && !isAlreadyRegistered && (
                        <Surface style={{ margin: 15, padding: 15, borderRadius: 12, backgroundColor: '#E3F2FD', borderLeftWidth: 5, borderLeftColor: '#1976D2' }} elevation={2}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Avatar.Text size={40} label={partner1.playerName?.charAt(0) || 'P'} style={{ backgroundColor: '#1976D2' }} />
                                <View style={{ marginLeft: 15 }}>
                                    <Text style={{ fontSize: 10, color: '#1976D2', fontWeight: 'bold' }}>JOINING DUO PARTNER</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{partner1.playerName}</Text>
                                        <Chip style={{ height: 20, marginLeft: 8, backgroundColor: '#BBDEFB' }} textStyle={{ fontSize: 9 }}>PARTNER 1</Chip>
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#666' }}>Team: {partner1.teamName || 'Duo'}</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 11, color: '#1976D2', marginTop: 10, fontStyle: 'italic' }}>
                                You are registering as the partner for this duo. Your registration will be linked to {partner1.playerName}'s team.
                            </Text>
                        </Surface>
                    )}

                    {/* Already Registered Warning */}
                    {isAlreadyRegistered && (
                        <Surface style={{
                            margin: 15,
                            padding: 20,
                            borderRadius: 12,
                            backgroundColor: existingRegistration?.paid ? '#E8F5E9' : '#FFF3E0',
                            borderWidth: 1,
                            borderColor: existingRegistration?.paid ? '#C8E6C9' : '#FFE0B2'
                        }} elevation={2}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <MaterialCommunityIcons
                                    name={existingRegistration?.paid ? "check-circle" : "clock-alert-outline"}
                                    size={24}
                                    color={existingRegistration?.paid ? "#2E7D32" : "#E65100"}
                                />
                                <Title style={{
                                    marginLeft: 10,
                                    color: existingRegistration?.paid ? "#2E7D32" : "#E65100",
                                    fontSize: 18
                                }}>
                                    {existingRegistration?.paid ? "Already Registered" : "Registration Pending"}
                                </Title>
                            </View>
                            <Text style={{ fontSize: 14, color: '#5D4037', marginBottom: 15, lineHeight: 20 }}>
                                {existingRegistration?.paid
                                    ? "Our records show you are already enrolled in this tournament. Please find your registration details below."
                                    : "Your registration is pending payment. Please complete the payment to confirm your spot."}
                            </Text>
                            <View style={{
                                backgroundColor: 'white',
                                padding: 15,
                                borderRadius: 8,
                                borderLeftWidth: 4,
                                borderLeftColor: existingRegistration?.paid ? "#2E7D32" : "#E65100"
                            }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ fontWeight: 'bold' }}>Reg ID:</Text>
                                    <Text style={{
                                        color: existingRegistration?.paid ? "#2E7D32" : "#E65100",
                                        fontWeight: 'bold'
                                    }}>
                                        {existingRegistration?.registrationNumber}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ fontWeight: 'bold' }}>Status:</Text>
                                    <Chip
                                        mode="flat"
                                        style={{
                                            backgroundColor: existingRegistration?.paid ? "#C8E6C9" : "#FFE0B2",
                                            height: 24
                                        }}
                                        textStyle={{
                                            fontSize: 12,
                                            fontWeight: 'bold',
                                            color: existingRegistration?.paid ? "#2E7D32" : "#E65100"
                                        }}
                                    >
                                        {existingRegistration?.paid
                                            ? (existingRegistration?.registrationMode === 'Duo'
                                                ? (existingRegistration?.paidForPartner ? "PAID (FULL DUO)" : "PAID (INDIVIDUAL)")
                                                : "PAID")
                                            : "PENDING"}
                                    </Chip>
                                </View>
                                <Divider style={{ marginVertical: 8 }} />
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'gray', marginBottom: 4 }}>ORGANIZER CONTACT</Text>
                                <Text style={{ fontSize: 15, fontWeight: '600' }}>{organizerInfo?.name || 'N/A'}</Text>
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${organizerInfo?.phone}`)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                                    <MaterialCommunityIcons name="phone" size={16} color={theme.colors.primary} />
                                    <Text style={{ marginLeft: 5, color: theme.colors.primary, fontWeight: 'bold' }}>{organizerInfo?.phone || 'N/A'}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Complete Payment Button for Pending Registrations */}
                            {!existingRegistration?.paid && (
                                <Button
                                    mode="contained"
                                    style={{ marginTop: 15, borderRadius: 8 }}
                                    buttonColor="#E65100"
                                    onPress={() => processPayment(
                                        existingRegistration.id || existingRegistration.docId,
                                        tournament.entryFee,
                                        existingRegistration.playerName
                                    )}
                                >
                                    Complete Payment Now
                                </Button>
                            )}

                            {/* EMERGENCY RESET BUTTON */}
                            <TouchableOpacity
                                onPress={async () => {
                                    Alert.alert("Reset Registration?", "This will clear your local registration status. Use only if payment is failing.", [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Reset", onPress: async () => {
                                                await AsyncStorage.removeItem(`enrolled_${id}`);
                                                await AsyncStorage.removeItem(`pending_payment_${id}`);
                                                setIsAlreadyRegistered(false);
                                                setExistingRegistration(null);
                                                setStep(0);
                                                Alert.alert("Success", "Local status cleared. Please try registering again.");
                                            }
                                        }
                                    ]);
                                }}
                                style={{ marginTop: 20, alignSelf: 'center' }}
                            >
                                <Text style={{ color: 'gray', fontSize: 12, textDecorationLine: 'underline' }}>
                                    Having issues? Click here to Reset (v{APP_VERSION})
                                </Text>
                            </TouchableOpacity>
                        </Surface>
                    )}

                    {/* DEBUGGER (Only visible in dev/if needed) */}
                    <View style={{ padding: 10, opacity: 0.5 }}>
                        <Text style={{ fontSize: 10, textAlign: 'center' }}>
                            PlayerID: {existingRegistration?.id || 'null'} | Status: {paymentStatus} | Version: {APP_VERSION}
                        </Text>
                    </View>

                    {/* Stepper Indicator */}
                    {!isAlreadyRegistered && step > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 20, paddingHorizontal: 20 }}>
                            {[1, 2, 3].map((s) => (
                                <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{
                                        width: 30, height: 30, borderRadius: 15,
                                        backgroundColor: step >= s ? theme.colors.primary : '#E0E0E0',
                                        justifyContent: 'center', alignItems: 'center'
                                    }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>{s}</Text>
                                    </View>
                                    {s < 3 && <View style={{ width: 40, height: 2, backgroundColor: step > s ? theme.colors.primary : '#E0E0E0', marginHorizontal: 5 }} />}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Form Content Steps */}
                    {!isAlreadyRegistered && (
                        <View style={styles.content}>

                            {step === 0 && (
                                <View>
                                    {/* Tournament Overview Card */}
                                    <Surface style={[styles.sectionCard, { padding: 0, overflow: 'hidden' }]} elevation={3}>
                                        {tournament.bannerUrl ? (
                                            <Image source={{ uri: tournament.bannerUrl }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
                                        ) : (
                                            <View style={{ width: '100%', height: 160, backgroundColor: '#1A237E', justifyContent: 'center', alignItems: 'center' }}>
                                                <MaterialCommunityIcons name="trophy-variant" size={80} color="rgba(255,255,255,0.2)" />
                                            </View>
                                        )}

                                        <View style={{ padding: 24 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <View style={{ flex: 1 }}>
                                                    <Title style={{ fontSize: 24, fontWeight: '900', color: '#1A237E', lineHeight: 28 }}>{tournament.name}</Title>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                        <Chip compact style={{ height: 24, backgroundColor: '#E8EAF6' }} textStyle={{ fontSize: 10, color: '#303F9F' }}>{tournament.gameName}</Chip>
                                                        <Text style={{ color: '#777', fontSize: 13, marginLeft: 10 }}>{tournament.gameCategory}</Text>
                                                    </View>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Surface style={{ padding: 12, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', minWidth: 100 }}>
                                                        <Text style={{ fontSize: 10, color: '#2E7D32', fontWeight: 'bold', letterSpacing: 1 }}>GRAND PRIZE</Text>
                                                        <Text style={{ fontSize: 20, color: '#1B5E20', fontWeight: '900' }}>₹{tournament.winningPrize || 'N/A'}</Text>
                                                    </Surface>
                                                    <IconButton
                                                        icon="share-variant"
                                                        size={20}
                                                        iconColor="#3F51B5"
                                                        onPress={() => {
                                                            const domain = Platform.OS === 'web' ? window.location.origin : 'https://force-player-register-ap-ade3a.web.app';
                                                            const url = `${domain}/tournament/${id}`;
                                                            Share.share({ message: `Join ${tournament.name}! Register here: ${url}`, url });
                                                        }}
                                                    />
                                                </View>
                                            </View>



                                            <View style={[styles.detailsGrid, { marginTop: 25 }]}>
                                                <View style={styles.detailCard}>
                                                    <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                                                        <MaterialCommunityIcons name="calendar-check" size={20} color="#1976D2" />
                                                    </View>
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={styles.detailLabel}>TOURNAMENT DATE</Text>
                                                        <Text style={styles.detailValue}>{tournament.startDate}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.detailCard}>
                                                    <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
                                                        <MaterialCommunityIcons name="clock-time-four-outline" size={20} color="#F57C00" />
                                                    </View>
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={styles.detailLabel}>START TIME</Text>
                                                        <Text style={styles.detailValue}>{tournament.startTime}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={styles.detailsGrid}>
                                                <View style={styles.detailCard}>
                                                    <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
                                                        <MaterialCommunityIcons name="account-group" size={20} color="#7B1FA2" />
                                                    </View>
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={styles.detailLabel}>PLAYER SLOTS</Text>
                                                        <Text style={styles.detailValue}>{tournament.maxParticipants} Capacity</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.detailCard}>
                                                    <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                                                        <MaterialCommunityIcons name="currency-inr" size={20} color="#2E7D32" />
                                                    </View>
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={styles.detailLabel}>ENTRY FEE</Text>
                                                        <Text style={styles.detailValue}>₹{tournament.entryFee}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <Divider style={{ marginVertical: 20 }} />

                                            <View style={{ marginBottom: 20 }}>
                                                <Text style={[styles.label, { fontSize: 14, color: '#1A237E' }]}>Venue Details</Text>
                                                <View style={[styles.row, { marginTop: 8, alignItems: 'flex-start' }]}>
                                                    <MaterialCommunityIcons name="map-marker-radius" size={22} color="#E91E63" style={{ marginTop: 2 }} />
                                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                                        <Text style={{ fontSize: 15, color: '#333', lineHeight: 22 }}>{tournament.address}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={{ marginBottom: 20 }}>
                                                <Text style={[styles.label, { fontSize: 14, color: '#1A237E' }]}>Tournament Description</Text>
                                                <Text style={{ fontSize: 14, color: '#555', lineHeight: 22, marginTop: 5 }}>
                                                    {tournament.description || "No description provided for this event."}
                                                </Text>
                                            </View>

                                            {tournament.rules && (
                                                <View style={{ marginBottom: 20 }}>
                                                    <Text style={[styles.label, { fontSize: 14, color: '#1A237E' }]}>Game Rules</Text>
                                                    <View style={{ marginTop: 8, padding: 12, backgroundColor: '#FFFDE7', borderRadius: 8, borderWidth: 1, borderColor: '#FFF59D' }}>
                                                        <Text style={{ fontSize: 14, color: '#5D4037', lineHeight: 22 }}>
                                                            {tournament.rules}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            <View style={{ marginTop: 20, padding: 15, backgroundColor: '#ECEFF1', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Avatar.Text size={36} label={tournament.organizerName?.charAt(0) || 'O'} style={{ backgroundColor: '#546E7A' }} />
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={{ fontSize: 10, color: '#78909C', fontWeight: 'bold' }}>ORGANIZED BY</Text>
                                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#37474F' }}>{tournament.organizerName}</Text>
                                                        {tournament.organizerPhone && (
                                                            <Text style={{ fontSize: 12, color: '#546E7A' }}>{tournament.organizerPhone}</Text>
                                                        )}
                                                    </View>
                                                </View>
                                                {tournament.organizerPhone && (
                                                    <IconButton
                                                        icon="phone"
                                                        mode="contained"
                                                        containerColor="#546E7A"
                                                        iconColor="white"
                                                        size={20}
                                                        onPress={() => Linking.openURL(`tel:${tournament.organizerPhone}`)}
                                                    />
                                                )}
                                            </View>
                                        </View>
                                    </Surface>

                                    {/* Terms & Conditions Card */}
                                    <Surface style={styles.sectionCard} elevation={2}>
                                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                            <View style={[styles.iconCircle, { backgroundColor: '#E8EAF6', width: 64, height: 64, borderRadius: 32 }]}>
                                                <MaterialCommunityIcons name="file-document-edit-outline" size={32} color="#3F51B5" />
                                            </View>
                                            <Title style={{ marginTop: 12, fontSize: 20, color: '#1A237E', fontWeight: 'bold' }}>Terms & Participation Rules</Title>
                                        </View>

                                        <ScrollView style={{ maxHeight: 300, backgroundColor: '#F5F5F5', padding: 15, borderRadius: 12, marginBottom: 20 }}>
                                            {tournament.termsAndConditions ? (
                                                <Text style={{ fontSize: 14, color: '#444', lineHeight: 22 }}>
                                                    {tournament.termsAndConditions}
                                                </Text>
                                            ) : (
                                                <Text style={{ fontSize: 14, color: '#444', lineHeight: 20 }}>
                                                    <Text style={{ fontWeight: 'bold' }}>1. Eligibility:</Text> Players must meet the age and skill requirements specified for this tournament. Misrepresentation of age or identity may lead to disqualification.{"\n\n"}
                                                    <Text style={{ fontWeight: 'bold' }}>2. Conduct:</Text> All participants are expected to maintain sportsmanship on and off the field. Any form of abuse, foul language, or violence will result in immediate expulsion without refund.{"\n\n"}
                                                    <Text style={{ fontWeight: 'bold' }}>3. Equipment & Kit:</Text> Participants must wear the designated kit/jersey provided or approved by the organizer. Proper safety gear (e.g., helmets, guards) is mandatory where applicable.{"\n\n"}
                                                    <Text style={{ fontWeight: 'bold' }}>4. Health & Safety:</Text> By registering, you confirm that you are physically fit to participate. The organizers are not liable for any injuries sustained during the event.{"\n\n"}
                                                    <Text style={{ fontWeight: 'bold' }}>5. Refunds:</Text> Registration fees are generally non-refundable unless the event is cancelled by the organizer.{"\n\n"}
                                                    <Text style={{ fontWeight: 'bold' }}>6. Media Rights:</Text> Organizers reserve the right to use photos and videos of the event for promotional purposes.{"\n\n"}
                                                    <Text style={{ fontWeight: 'bold' }}>7. Decision Finality:</Text> The referee’s and organizer's decisions are binding and non-contestable.
                                                </Text>
                                            )}
                                        </ScrollView>

                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', backgroundColor: agreedToTerms ? '#E3F2FD' : '#F5F5F5', padding: 12, borderRadius: 8, marginBottom: 20, alignItems: 'center' }}
                                            onPress={() => setAgreedToTerms(!agreedToTerms)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialCommunityIcons
                                                name={agreedToTerms ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                                                size={24}
                                                color={agreedToTerms ? "#1565C0" : "#78909C"}
                                                style={{ marginRight: 10 }}
                                            />
                                            <Text style={{ fontSize: 13, flex: 1, color: agreedToTerms ? '#0D47A1' : '#546E7A', lineHeight: 18, fontWeight: agreedToTerms ? '600' : '400' }}>
                                                I have read and agree to all the rules, terms, and conditions of {tournament.name}. I also acknowledge that I have read the official
                                                <Text onPress={() => router.push('/policies/terms')} style={{ color: '#1A237E', fontWeight: 'bold', textDecorationLine: 'underline' }}> Terms & Conditions</Text>,
                                                <Text onPress={() => router.push('/policies/privacy')} style={{ color: '#1A237E', fontWeight: 'bold', textDecorationLine: 'underline' }}> Privacy Policy</Text>,
                                                <Text onPress={() => router.push('/policies/refund')} style={{ color: '#1A237E', fontWeight: 'bold', textDecorationLine: 'underline' }}> Refund Policy</Text>, and
                                                <Text onPress={() => router.push('/policies/contact')} style={{ color: '#1A237E', fontWeight: 'bold', textDecorationLine: 'underline' }}> Contact Us</Text> of Force Player Field Pvt. Ltd.
                                            </Text>
                                        </TouchableOpacity>

                                        <Button
                                            mode="contained"
                                            onPress={() => {
                                                if (agreedToTerms) setStep(1);
                                                else Alert.alert("Agreement Required", "Please read and agree to the tournament rules and terms to proceed.");
                                            }}
                                            style={{ borderRadius: 12, backgroundColor: agreedToTerms ? '#1A237E' : '#9E9E9E' }}
                                            contentStyle={{ height: 50 }}
                                            labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                                            disabled={!agreedToTerms}
                                        >
                                            Agree & Proceed to Register
                                        </Button>
                                    </Surface>
                                </View>
                            )}

                            {step === 1 && (
                                <Surface style={styles.sectionCard} elevation={2}>
                                    <Title style={styles.formHeader}>1. Setup Participation</Title>

                                    {/* Mode Selection */}
                                    <Text style={styles.label}>Participation Mode</Text>
                                    <SegmentedButtons
                                        value={formData.registrationMode}
                                        onValueChange={(val) => {
                                            if (duoId) return;
                                            updateForm('registrationMode', val);
                                            // Reset team stuff if switching modes
                                            if (val !== 'Team') {
                                                updateForm('selectedPredefinedTeam', '');
                                                updateForm('teamName', '');
                                            }
                                        }}
                                        buttons={[
                                            {
                                                value: 'Solo',
                                                label: 'Solo',
                                                icon: 'account',
                                                disabled: !!duoId || tournament.tournamentType === 'Team' || GAME_TYPE_MAPPING[tournament.gameName] === 'Team'
                                            },
                                            {
                                                value: 'Duo',
                                                label: 'Duo',
                                                icon: 'account-multiple',
                                                disabled: (!!duoId && formData.registrationMode !== 'Duo') || tournament.tournamentType === 'Team' || tournament.tournamentType === 'Auction' || GAME_TYPE_MAPPING[tournament.gameName] === 'Solo' || GAME_TYPE_MAPPING[tournament.gameName] === 'Team'
                                            },
                                            {
                                                value: 'Team',
                                                label: 'Team',
                                                icon: 'account-group',
                                                disabled: !!duoId || tournament.tournamentType === 'Auction' || (tournament.tournamentType === 'Normal' && GAME_TYPE_MAPPING[tournament.gameName] !== 'Team')
                                            }
                                        ]}
                                        style={{ marginBottom: 20 }}
                                    />

                                    {/* Team Name for Duo / Custom Team */}
                                    {(formData.registrationMode === 'Duo' || (formData.registrationMode === 'Team' && (!tournament.teams?.length || formData.selectedPredefinedTeam === 'Custom Team'))) && (
                                        <View style={{ marginTop: 10, marginBottom: 20 }}>
                                            <TextInput
                                                label={formData.registrationMode === 'Duo' ? "Duo / Team Name" : "Team Name"}
                                                value={formData.teamName}
                                                onChangeText={(t) => updateForm('teamName', t)}
                                                mode="outlined"
                                                editable={!duoId}
                                                style={styles.input}
                                                left={<TextInput.Icon icon="account-group" />}
                                                placeholder="Enter a unique name for your duo"
                                                error={!!formErrors.teamName}
                                            />
                                            {formErrors.teamName ? <Text style={styles.errorText}>{formErrors.teamName}</Text> : null}
                                            {duoId && <Text style={{ fontSize: 11, color: '#1976D2', marginTop: 5, fontWeight: 'bold' }}>✓ Joining Partner's Team</Text>}
                                        </View>
                                    )}

                                    {/* Payment Preference for Duo */}
                                    {formData.registrationMode === 'Duo' && !duoId && (
                                        <Surface style={{ padding: 15, borderRadius: 12, backgroundColor: '#FFF9C4', marginBottom: 20, borderLeftWidth: 5, borderLeftColor: '#FBC02D' }} elevation={1}>
                                            <Text style={{ fontWeight: 'bold', color: '#827717', marginBottom: 10 }}>Payment Preference</Text>
                                            <TouchableOpacity
                                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                                                onPress={() => setPayForPartner(false)}
                                            >
                                                <MaterialCommunityIcons
                                                    name={!payForPartner ? "radiobox-marked" : "radiobox-blank"}
                                                    size={24}
                                                    color={!payForPartner ? "#FBC02D" : "gray"}
                                                />
                                                <View style={{ marginLeft: 10 }}>
                                                    <Text style={{ fontSize: 14, fontWeight: 'bold' }}>Pay Individually (Standard)</Text>
                                                    <Text style={{ fontSize: 11, color: '#666' }}>You pay ₹{tournament.entryFee} now. Your partner pays ₹{tournament.entryFee} later.</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={{ flexDirection: 'row', alignItems: 'center' }}
                                                onPress={() => setPayForPartner(true)}
                                            >
                                                <MaterialCommunityIcons
                                                    name={payForPartner ? "radiobox-marked" : "radiobox-blank"}
                                                    size={24}
                                                    color={payForPartner ? "#FBC02D" : "gray"}
                                                />
                                                <View style={{ marginLeft: 10 }}>
                                                    <Text style={{ fontSize: 14, fontWeight: 'bold' }}>Pay for Both Now (Full Team)</Text>
                                                    <Text style={{ fontSize: 11, color: '#666' }}>You pay ₹{tournament.entryFee * 2} now. Your partner joins for FREE.</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <View style={{ marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ fontWeight: 'bold' }}>Total Payable:</Text>
                                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#DD2C00' }}>₹{payForPartner ? tournament.entryFee * 2 : tournament.entryFee}</Text>
                                            </View>
                                        </Surface>
                                    )}

                                    <Divider style={{ marginBottom: 15 }} />

                                    {/* Team Selection Grid (Unified for Normal & Team-Based) */}
                                    {formData.registrationMode === 'Team' && (
                                        <View>
                                            <Text style={styles.label}>Select Your Team</Text>
                                            {tournament.teams && tournament.teams.length > 0 ? (
                                                <View style={styles.teamGrid}>
                                                    {tournament.teams.map((team, index) => {
                                                        const teamName = typeof team === 'string' ? team : (team.name || `Team ${index + 1}`);
                                                        const teamLogo = typeof team === 'string' ? null : team.logoUrl;
                                                        const count = teamCounts[teamName] || 0;
                                                        const isFull = count >= tournament.teamSize;
                                                        const isSelected = formData.selectedPredefinedTeam === teamName;

                                                        return (
                                                            <TouchableOpacity
                                                                key={index}
                                                                disabled={isFull}
                                                                onPress={() => updateForm('selectedPredefinedTeam', teamName)}
                                                                style={[
                                                                    styles.teamSelectCard,
                                                                    isSelected && { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: '#E3F2FD' },
                                                                    isFull && { opacity: 0.6, backgroundColor: '#f0f0f0' }
                                                                ]}
                                                            >
                                                                {teamLogo ? (
                                                                    <Image
                                                                        source={{ uri: teamLogo }}
                                                                        style={styles.teamSelectLogo}
                                                                        resizeMode="cover"
                                                                    />
                                                                ) : (
                                                                    <Avatar.Text size={50} label={teamName.charAt(0)} style={{ marginBottom: 10, backgroundColor: isSelected ? theme.colors.primary : '#E0E0E0' }} labelStyle={{ color: isSelected ? 'white' : 'gray' }} />
                                                                )}
                                                                <Title style={[styles.teamSelectName, { marginBottom: 2 }]} numberOfLines={1}>{teamName}</Title>
                                                                <Badge
                                                                    style={{
                                                                        backgroundColor: isFull ? '#D32F2F' : (isSelected ? theme.colors.primary : '#757575'),
                                                                        marginTop: 2
                                                                    }}
                                                                >
                                                                    {isFull ? 'FULL' : `${count}/${tournament.teamSize}`}
                                                                </Badge>
                                                                {!isFull && <Text style={{ fontSize: 9, color: 'gray', marginTop: 2 }}>{tournament.teamSize - count} Required</Text>}
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            ) : (
                                                <View style={[styles.infoBox, { borderColor: 'orange', backgroundColor: '#FFF3E0' }]}>
                                                    <MaterialCommunityIcons name="alert" size={20} color="#E65100" style={{ marginRight: 8 }} />
                                                    <Text style={{ fontSize: 13, flex: 1, color: '#E65100' }}>
                                                        {tournament.tournamentType === 'Team' ? "Waiting for organizer to configure team slots." : "No teams have been configured by the owner."}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Info Section moved here */}
                                    <View style={styles.infoBox}>
                                        <MaterialCommunityIcons name="information-outline" size={20} color="#1565C0" style={{ marginRight: 8 }} />
                                        <Text style={{ fontSize: 13, flex: 1, color: '#0D47A1' }}>
                                            {formData.registrationMode === 'Team' ?
                                                (tournament.tournamentType === 'Normal' ? "Predefined Team: You only need to register yourself as Captain." : "Create Team: You will need to add all player details.")
                                                : "Complete your personal profile and proceed."}
                                        </Text>
                                    </View>
                                </Surface>
                            )}

                            {step === 2 && (
                                <>
                                    {/* Personal Details */}
                                    <Surface style={styles.sectionCard} elevation={2}>
                                        <Title style={styles.formHeader}>Personal Details (You)</Title>
                                        <View style={{ marginBottom: 12 }}>
                                            <TextInput label="Email" value={formData.email} onChangeText={(t) => updateForm('email', t)} onBlur={handleEmailBlur} mode="outlined" style={styles.input} keyboardType="email-address" left={<TextInput.Icon icon="email" />} error={!!formErrors.email} />
                                            {formErrors.email ? <Text style={styles.errorText}>{formErrors.email}</Text> : null}
                                        </View>
                                        <View style={{ marginBottom: 12 }}>
                                            <TextInput label="Full Name" value={formData.name} onChangeText={(t) => updateForm('name', t)} mode="outlined" style={styles.input} left={<TextInput.Icon icon="account" />} error={!!formErrors.name} />
                                            {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}
                                        </View>
                                        <View style={{ marginBottom: 12 }}>
                                            <TextInput label="Phone Number" value={formData.phone} onChangeText={(t) => updateForm('phone', t)} keyboardType="phone-pad" mode="outlined" style={styles.input} left={<TextInput.Icon icon="phone" />} error={!!formErrors.phone} />
                                            {formErrors.phone ? <Text style={styles.errorText}>{formErrors.phone}</Text> : null}
                                        </View>
                                        <View style={{ marginBottom: 12 }}>
                                            <TextInput label="Address" value={formData.address} onChangeText={(t) => updateForm('address', t)} mode="outlined" style={styles.input} multiline numberOfLines={3} left={<TextInput.Icon icon="map-marker" />} error={!!formErrors.address} />
                                            {formErrors.address ? <Text style={styles.errorText}>{formErrors.address}</Text> : null}
                                        </View>
                                        <View style={styles.row}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                {Platform.OS === 'web' ? (
                                                    <View style={{ marginBottom: 12 }}>
                                                        <View style={{
                                                            height: 55,
                                                            borderWidth: 1,
                                                            borderColor: '#ccc',
                                                            borderRadius: 8,
                                                            paddingHorizontal: 12,
                                                            backgroundColor: 'white',
                                                            justifyContent: 'center',
                                                            position: 'relative'
                                                        }}>
                                                            <Text style={{
                                                                position: 'absolute',
                                                                top: -10,
                                                                left: 10,
                                                                backgroundColor: 'white',
                                                                paddingHorizontal: 4,
                                                                fontSize: 12,
                                                                color: '#666',
                                                                zIndex: 1
                                                            }}>DOB</Text>
                                                            <input
                                                                type="date"
                                                                value={(() => {
                                                                    if (!formData.dob || !formData.dob.includes('-')) return '';
                                                                    const p = formData.dob.split('-');
                                                                    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
                                                                })()}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val && val.includes('-')) {
                                                                        const [y, m, d] = val.split('-');
                                                                        const formatted = `${d}-${m}-${y}`;
                                                                        updateForm('dob', formatted);
                                                                        updateForm('age', calculateAgeFromStr(formatted));
                                                                    }
                                                                }}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    outline: 'none',
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    fontSize: 16,
                                                                    fontFamily: 'inherit',
                                                                    color: '#333'
                                                                }}
                                                            />
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        activeOpacity={0.7}
                                                        onPress={() => openDatePicker('main')}
                                                    >
                                                        <View pointerEvents="none">
                                                            <TextInput
                                                                label="DOB"
                                                                value={formData.dob}
                                                                mode="outlined"
                                                                style={styles.input}
                                                                placeholder="DD-MM-YYYY"
                                                                error={!!formErrors.dob}
                                                                right={<TextInput.Icon icon="calendar" />}
                                                            />
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                                {formErrors.dob ? <Text style={styles.errorText}>{formErrors.dob}</Text> : null}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    label="Age"
                                                    value={formData.age}
                                                    mode="outlined"
                                                    style={styles.input}
                                                    error={!!formErrors.age}
                                                    editable={false}
                                                />
                                                {formErrors.age ? <Text style={styles.errorText}>{formErrors.age}</Text> : null}
                                            </View>
                                        </View>
                                        <View style={{ marginBottom: 12 }}>
                                            <TextInput label="Emergency Contact" value={formData.emergencyPhone} onChangeText={(t) => updateForm('emergencyPhone', t)} keyboardType="phone-pad" mode="outlined" style={styles.input} left={<TextInput.Icon icon="alert-circle" />} error={!!formErrors.emergencyPhone} />
                                            {formErrors.emergencyPhone ? <Text style={styles.errorText}>{formErrors.emergencyPhone}</Text> : null}
                                        </View>
                                        <View style={styles.row}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <TextInput label="Blood Group" value={formData.bloodGroup} onChangeText={(t) => updateForm('bloodGroup', t)} mode="outlined" style={styles.input} error={!!formErrors.bloodGroup} />
                                                {formErrors.bloodGroup ? <Text style={styles.errorText}>{formErrors.bloodGroup}</Text> : null}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={[styles.dropdownTrigger, formErrors.gender && { borderColor: '#B00020' }, { marginTop: 0, height: 56, justifyContent: 'center', borderRadius: 4, borderColor: '#79747E', marginBottom: 12, borderWidth: 1 }]}>
                                                    <Menu
                                                        visible={activeDropdown === 'gender'}
                                                        onDismiss={() => setActiveDropdown(null)}
                                                        anchor={
                                                            <TouchableOpacity onPress={() => setActiveDropdown('gender')} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Text style={{ fontSize: 16, color: formData.gender ? '#333' : '#666' }}>{formData.gender || 'Select Gender'}</Text>
                                                                <MaterialCommunityIcons name="chevron-down" size={24} color="gray" />
                                                            </TouchableOpacity>
                                                        }
                                                    >
                                                        {['Male', 'Female', 'Other'].map(g => (
                                                            <Menu.Item key={g} onPress={() => { updateForm('gender', g); setActiveDropdown(null); }} title={g} />
                                                        ))}
                                                    </Menu>
                                                </View>
                                                {formErrors.gender ? <Text style={styles.errorText}>{formErrors.gender}</Text> : null}
                                            </View>
                                        </View>

                                        <View style={{ marginVertical: 10 }}>
                                            <Text style={styles.label}>Any Health Issues?</Text>
                                            <SegmentedButtons
                                                value={formData.hasHealthIssues}
                                                onValueChange={(v) => updateForm('hasHealthIssues', v)}
                                                buttons={[
                                                    { value: 'Yes', label: 'Yes' },
                                                    { value: 'No', label: 'No' },
                                                ]}
                                                style={{ marginBottom: 5 }}
                                            />
                                            {formData.hasHealthIssues === 'Yes' && (
                                                <>
                                                    <TextInput
                                                        label="Mention Health Issues"
                                                        value={formData.healthIssueDetails}
                                                        onChangeText={(t) => updateForm('healthIssueDetails', t)}
                                                        mode="outlined"
                                                        multiline
                                                        numberOfLines={2}
                                                        placeholder="Describe any medical conditions..."
                                                        error={!!formErrors.healthIssueDetails}
                                                    />
                                                    {formErrors.healthIssueDetails ? <Text style={styles.errorText}>{formErrors.healthIssueDetails}</Text> : null}
                                                </>
                                            )}
                                        </View>

                                        <Text style={styles.label}>Identity Documents</Text>
                                        <View style={{ marginBottom: 12 }}>
                                            <TextInput label="Aadhar Number" value={formData.adharId} onChangeText={(t) => updateForm('adharId', t)} keyboardType="numeric" mode="outlined" style={styles.input} maxLength={12} left={<TextInput.Icon icon="card-account-details-outline" />} error={!!formErrors.adharId} />
                                            {formErrors.adharId ? <Text style={styles.errorText}>{formErrors.adharId}</Text> : null}
                                        </View>
                                        <View style={styles.row}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <TouchableOpacity onPress={() => pickImage('playerImage')} style={{ flex: 1 }}>
                                                    <View style={[styles.uploadBox, formErrors.playerImage && { borderColor: '#B00020', borderStyle: 'solid' }]}>
                                                        {formData.playerImage ? <Image source={{ uri: formData.playerImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <><MaterialCommunityIcons name="camera-plus" size={32} color={formErrors.playerImage ? "#B00020" : "#7986CB"} /><Text style={[styles.uploadLabel, formErrors.playerImage && { color: '#B00020' }]}>Photo</Text></>}
                                                    </View>
                                                </TouchableOpacity>
                                                {formErrors.playerImage ? <Text style={[styles.errorText, { marginTop: 4 }]}>{formErrors.playerImage}</Text> : null}
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <TouchableOpacity onPress={() => pickImage('adharImage')} style={{ flex: 1 }}>
                                                    <View style={[styles.uploadBox, formErrors.adharImage && { borderColor: '#B00020', borderStyle: 'solid' }]}>
                                                        {formData.adharImage ? <Image source={{ uri: formData.adharImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <><MaterialCommunityIcons name="card-account-details-outline" size={32} color={formErrors.adharImage ? "#B00020" : "#7986CB"} /><Text style={[styles.uploadLabel, formErrors.adharImage && { color: '#B00020' }]}>Aadhar Photo</Text></>}
                                                    </View>
                                                </TouchableOpacity>
                                                {formErrors.adharImage ? <Text style={[styles.errorText, { marginTop: 4 }]}>{formErrors.adharImage}</Text> : null}
                                            </View>
                                        </View>
                                    </Surface>

                                    {/* Partner / Team Roster - Hide if joining an existing duo */}
                                    {(formData.registrationMode === 'Team' || (tournament.entryType === 'Duo' && !duoId)) && (!formData.selectedPredefinedTeam || formData.selectedPredefinedTeam === 'Custom Team') && (
                                        <Surface style={styles.sectionCard} elevation={2}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                                <Title style={[styles.formHeader, { marginBottom: 0 }]}>{tournament.entryType === 'Duo' ? 'Partner Details' : 'Team Roster'}</Title>
                                                <Chip icon="account-group" mode="outlined">{formData.teamMembers.length} / {formData.maxTeamSize}</Chip>
                                            </View>

                                            {formData.teamMembers.map((member, index) => (
                                                <List.Accordion
                                                    key={index}
                                                    title={`Player ${index + 1}: ${index === 0 ? (formData.name || 'You') : (member.name || (tournament.entryType === 'Duo' ? 'Partner' : 'Empty Slot'))}`}
                                                    expanded={expandedMember === index}
                                                    onPress={() => setExpandedMember(index === expandedMember ? null : index)}
                                                    style={styles.accordionHeader}
                                                    left={props => <Avatar.Text {...props} size={24} label={String(index + 1)} />}
                                                >
                                                    <Surface style={styles.rosterForm}>
                                                        {index === 0 ? (
                                                            <Text style={{ color: 'gray', fontStyle: 'italic', marginBottom: 10 }}>Captain details are managed in the Personal Section above.</Text>
                                                        ) : (
                                                            <>
                                                                {tournament.entryType === 'Duo' && index === 1 ? (
                                                                    <View style={{ padding: 20 }}>
                                                                        <View style={{ marginBottom: 12 }}>
                                                                            <TextInput label="Partner Name" value={member.name} onChangeText={(t) => updateMember(index, 'name', t)} mode="outlined" style={styles.input} dense />
                                                                        </View>
                                                                        <View style={{ marginBottom: 20 }}>
                                                                            <TextInput label="Partner Phone" value={member.phone} onChangeText={(t) => updateMember(index, 'phone', t)} keyboardType="phone-pad" mode="outlined" style={styles.input} dense />
                                                                        </View>

                                                                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                                                            <MaterialCommunityIcons name="account-plus-outline" size={48} color={theme.colors.primary} />
                                                                            <Title style={{ marginTop: 10, textAlign: 'center' }}>Invite Your Partner</Title>
                                                                            <Text style={{ textAlign: 'center', color: 'gray', marginBottom: 20 }}>
                                                                                Register yourself and share the tournament link with them to join!
                                                                            </Text>

                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, width: '100%', marginBottom: 15 }}>
                                                                                <Text numberOfLines={1} style={{ flex: 1, color: '#333' }}>
                                                                                    {`https://force-player-registration.web.app/tournament/${id}`}
                                                                                </Text>
                                                                                <TouchableOpacity onPress={() => {
                                                                                    Linking.openURL(`whatsapp://send?text=Hey! Join me in the ${tournament.name} tournament. Register here: https://force-player-registration.web.app/tournament/${id}`);
                                                                                }}>
                                                                                    <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" style={{ marginLeft: 10 }} />
                                                                                </TouchableOpacity>
                                                                            </View>

                                                                            <Text style={{ fontSize: 12, color: 'gray', fontStyle: 'italic' }}>
                                                                                *Or enter their details above if you have them.
                                                                            </Text>
                                                                        </View>
                                                                    </View>
                                                                ) : (
                                                                    <>
                                                                        <Text style={styles.label}>Personal Details</Text>
                                                                        <View style={{ marginBottom: 12 }}>
                                                                            <TextInput label="Full Name" value={member.name} onChangeText={(t) => updateMember(index, 'name', t)} mode="outlined" style={styles.input} dense error={!!formErrors[`m${index}_name`]} />
                                                                            {formErrors[`m${index}_name`] ? <Text style={styles.errorText}>{formErrors[`m${index}_name`]}</Text> : null}
                                                                        </View>
                                                                        <View style={{ marginBottom: 12 }}>
                                                                            <TextInput label="Email" value={member.email} onChangeText={(t) => updateMember(index, 'email', t)} keyboardType="email-address" mode="outlined" style={styles.input} dense error={!!formErrors[`m${index}_email`]} />
                                                                            {formErrors[`m${index}_email`] ? <Text style={styles.errorText}>{formErrors[`m${index}_email`]}</Text> : null}
                                                                        </View>
                                                                        <View style={{ marginBottom: 12 }}>
                                                                            <TextInput label="Phone" value={member.phone} onChangeText={(t) => updateMember(index, 'phone', t)} keyboardType="phone-pad" mode="outlined" style={styles.input} dense error={!!formErrors[`m${index}_phone`]} />
                                                                            {formErrors[`m${index}_phone`] ? <Text style={styles.errorText}>{formErrors[`m${index}_phone`]}</Text> : null}
                                                                        </View>

                                                                        {/* Other Fields (Hidden for Duo Partner, Shown for Team) */}
                                                                        {tournament.entryType !== 'Duo' && (
                                                                            <>
                                                                                <View style={{ marginBottom: 12 }}>
                                                                                    <TextInput label="Address" value={member.address} onChangeText={(t) => updateMember(index, 'address', t)} mode="outlined" style={[styles.input, { height: 80 }]} multiline numberOfLines={3} dense error={!!formErrors[`m${index}_address`]} />
                                                                                    {formErrors[`m${index}_address`] ? <Text style={styles.errorText}>{formErrors[`m${index}_address`]}</Text> : null}
                                                                                </View>

                                                                                <View style={styles.row}>
                                                                                    <View style={{ flex: 1, marginRight: 5 }}>
                                                                                        {Platform.OS === 'web' ? (
                                                                                            <View style={{ marginBottom: 12 }}>
                                                                                                <View style={{
                                                                                                    height: 45,
                                                                                                    borderWidth: 1,
                                                                                                    borderColor: '#ccc',
                                                                                                    borderRadius: 8,
                                                                                                    paddingHorizontal: 8,
                                                                                                    backgroundColor: 'white',
                                                                                                    justifyContent: 'center',
                                                                                                    position: 'relative'
                                                                                                }}>
                                                                                                    <Text style={{
                                                                                                        position: 'absolute',
                                                                                                        top: -10,
                                                                                                        left: 8,
                                                                                                        backgroundColor: 'white',
                                                                                                        paddingHorizontal: 4,
                                                                                                        fontSize: 10,
                                                                                                        color: '#666',
                                                                                                        zIndex: 1
                                                                                                    }}>DOB</Text>
                                                                                                    <input
                                                                                                        type="date"
                                                                                                        value={(() => {
                                                                                                            if (!member.dob || !member.dob.includes('-')) return '';
                                                                                                            const p = member.dob.split('-');
                                                                                                            return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
                                                                                                        })()}
                                                                                                        onChange={(e) => {
                                                                                                            const val = e.target.value;
                                                                                                            if (val && val.includes('-')) {
                                                                                                                const [y, m, d] = val.split('-');
                                                                                                                const formatted = `${d}-${m}-${y}`;
                                                                                                                updateMember(index, 'dob', formatted);
                                                                                                                updateMember(index, 'age', calculateAgeFromStr(formatted));
                                                                                                            }
                                                                                                        }}
                                                                                                        style={{
                                                                                                            border: 'none',
                                                                                                            background: 'transparent',
                                                                                                            outline: 'none',
                                                                                                            width: '100%',
                                                                                                            height: '100%',
                                                                                                            fontSize: 14,
                                                                                                            fontFamily: 'inherit',
                                                                                                            color: '#333'
                                                                                                        }}
                                                                                                    />
                                                                                                </View>
                                                                                            </View>
                                                                                        ) : (
                                                                                            <TouchableOpacity
                                                                                                activeOpacity={0.7}
                                                                                                onPress={() => openDatePicker('member', index)}
                                                                                            >
                                                                                                <View pointerEvents="none">
                                                                                                    <TextInput
                                                                                                        label="DOB"
                                                                                                        value={member.dob}
                                                                                                        mode="outlined"
                                                                                                        style={styles.input}
                                                                                                        placeholder="DD-MM-YYYY"
                                                                                                        dense
                                                                                                        error={!!formErrors[`m${index}_dob`]}
                                                                                                        right={<TextInput.Icon icon="calendar" size={18} />}
                                                                                                    />
                                                                                                </View>
                                                                                            </TouchableOpacity>
                                                                                        )}
                                                                                        {formErrors[`m${index}_dob`] ? <Text style={styles.errorText}>{formErrors[`m${index}_dob`]}</Text> : null}
                                                                                    </View>
                                                                                    <View style={{ flex: 1, marginLeft: 5 }}>
                                                                                        <TextInput
                                                                                            label="Age"
                                                                                            value={member.age}
                                                                                            onChangeText={(t) => updateMember(index, 'age', t)}
                                                                                            keyboardType="numeric"
                                                                                            mode="outlined"
                                                                                            style={styles.input}
                                                                                            dense
                                                                                            error={!!formErrors[`m${index}_age`]}
                                                                                            editable={false}
                                                                                        />
                                                                                        {formErrors[`m${index}_age`] ? <Text style={styles.errorText}>{formErrors[`m${index}_age`]}</Text> : null}
                                                                                    </View>
                                                                                </View>

                                                                                <View style={{ marginBottom: 12 }}>
                                                                                    <TextInput label="Emergency Contact" value={member.emergencyPhone} onChangeText={(t) => updateMember(index, 'emergencyPhone', t)} keyboardType="phone-pad" mode="outlined" style={styles.input} dense error={!!formErrors[`m${index}_emergencyPhone`]} />
                                                                                    {formErrors[`m${index}_emergencyPhone`] ? <Text style={styles.errorText}>{formErrors[`m${index}_emergencyPhone`]}</Text> : null}
                                                                                </View>
                                                                                <TextInput label="Blood Group" value={member.bloodGroup} onChangeText={(t) => updateMember(index, 'bloodGroup', t)} mode="outlined" style={styles.input} dense />

                                                                                <View style={{ marginTop: 10 }}>
                                                                                    <Text style={{ fontSize: 12, color: 'gray', marginBottom: 5 }}>Any Health Issues?</Text>
                                                                                    <SegmentedButtons
                                                                                        value={member.hasHealthIssues || 'No'}
                                                                                        onValueChange={(v) => updateMember(index, 'hasHealthIssues', v)}
                                                                                        buttons={[
                                                                                            { value: 'Yes', label: 'Yes', style: { paddingVertical: 0 } },
                                                                                            { value: 'No', label: 'No', style: { paddingVertical: 0 } },
                                                                                        ]}
                                                                                        density="compact"
                                                                                    />
                                                                                    {member.hasHealthIssues === 'Yes' && (
                                                                                        <>
                                                                                            <TextInput
                                                                                                label="Mention Health Issues"
                                                                                                value={member.healthIssueDetails}
                                                                                                onChangeText={(t) => updateMember(index, 'healthIssueDetails', t)}
                                                                                                mode="outlined"
                                                                                                dense
                                                                                                multiline
                                                                                                numberOfLines={2}
                                                                                                style={{ marginTop: 5 }}
                                                                                                error={!!formErrors[`m${index}_healthIssueDetails`]}
                                                                                            />
                                                                                            {formErrors[`m${index}_healthIssueDetails`] ? <Text style={styles.errorText}>{formErrors[`m${index}_healthIssueDetails`]}</Text> : null}
                                                                                        </>
                                                                                    )}
                                                                                </View>

                                                                                <Text style={styles.label}>Identity Documents</Text>
                                                                                <View style={{ marginBottom: 12 }}>
                                                                                    <TextInput label="Aadhar Number" value={member.adharId} onChangeText={(t) => updateMember(index, 'adharId', t)} keyboardType="numeric" mode="outlined" style={styles.input} maxLength={12} dense error={!!formErrors[`m${index}_adharId`]} />
                                                                                    {formErrors[`m${index}_adharId`] ? <Text style={styles.errorText}>{formErrors[`m${index}_adharId`]}</Text> : null}
                                                                                </View>
                                                                                <View style={styles.row}>
                                                                                    <View style={{ flex: 1, marginRight: 5 }}>
                                                                                        <TouchableOpacity onPress={() => pickImage('playerImage', index)} style={{ flex: 1 }}>
                                                                                            <View style={[styles.uploadBox, { height: 100 }, formErrors[`m${index}_playerImage`] && { borderColor: '#B00020', borderStyle: 'solid' }]}>
                                                                                                {member.playerImage ? <Image source={{ uri: member.playerImage }} style={{ width: '100%', height: '100%' }} /> : <><MaterialCommunityIcons name="camera-plus" size={24} color={formErrors[`m${index}_playerImage`] ? "#B00020" : "#7986CB"} /><Text style={[styles.uploadLabel, { fontSize: 10 }, formErrors[`m${index}_playerImage`] && { color: '#B00020' }]}>Photo</Text></>}
                                                                                            </View>
                                                                                        </TouchableOpacity>
                                                                                        {formErrors[`m${index}_playerImage`] ? <Text style={[styles.errorText, { fontSize: 10, marginTop: 4 }]}>{formErrors[`m${index}_playerImage`]}</Text> : null}
                                                                                    </View>
                                                                                    <View style={{ flex: 1, marginLeft: 5 }}>
                                                                                        <TouchableOpacity onPress={() => pickImage('adharImage', index)} style={{ flex: 1 }}>
                                                                                            <View style={[styles.uploadBox, { height: 100 }, formErrors[`m${index}_adharImage`] && { borderColor: '#B00020', borderStyle: 'solid' }]}>
                                                                                                {member.adharImage ? <Image source={{ uri: member.adharImage }} style={{ width: '100%', height: '100%' }} /> : <><MaterialCommunityIcons name="card-account-details-outline" size={24} color={formErrors[`m${index}_adharImage`] ? "#B00020" : "#7986CB"} /><Text style={[styles.uploadLabel, { fontSize: 10 }, formErrors[`m${index}_adharImage`] && { color: '#B00020' }]}>Aadhar Photo</Text></>}
                                                                                            </View>
                                                                                        </TouchableOpacity>
                                                                                        {formErrors[`m${index}_adharImage`] ? <Text style={[styles.errorText, { fontSize: 10, marginTop: 4 }]}>{formErrors[`m${index}_adharImage`]}</Text> : null}
                                                                                    </View>
                                                                                </View>

                                                                                <Divider style={{ marginVertical: 15 }} />

                                                                                <Text style={styles.label}>Kit Details</Text>
                                                                                <View style={styles.row}>
                                                                                    <TextInput label="Jersey Name" value={member.jerseyName} onChangeText={(t) => updateMember(index, 'jerseyName', t)} mode="outlined" style={[styles.input, { flex: 1.5, marginRight: 5 }]} dense />
                                                                                    <TextInput label="No." value={member.jerseyNumber} onChangeText={(t) => updateMember(index, 'jerseyNumber', t)} keyboardType="numeric" mode="outlined" style={[styles.input, { flex: 1 }]} dense />
                                                                                </View>
                                                                                <Text style={styles.label}>Jersey Size</Text>
                                                                                <View style={[styles.dropdownTrigger, formErrors[`m${index}_jerseySize`] && { borderColor: '#B00020' }]}>
                                                                                    <Menu
                                                                                        visible={activeDropdown === `member_${index}_jersey`}
                                                                                        onDismiss={() => setActiveDropdown(null)}
                                                                                        anchor={
                                                                                            <TouchableOpacity onPress={() => setActiveDropdown(`member_${index}_jersey`)} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                                <Text style={{ fontSize: 14 }}>{member.jerseySize || 'Select Size'}</Text>
                                                                                                <MaterialCommunityIcons name="chevron-down" size={20} color="gray" />
                                                                                            </TouchableOpacity>
                                                                                        }
                                                                                    >
                                                                                        <ScrollView style={{ maxHeight: 300 }}>
                                                                                            {JERSEY_SIZES.map(s => (
                                                                                                <Menu.Item key={s} onPress={() => { updateMember(index, 'jerseySize', s === 'Other' ? '' : s); setActiveDropdown(null); }} title={s} />
                                                                                            ))}
                                                                                        </ScrollView>
                                                                                    </Menu>
                                                                                </View>
                                                                                {formErrors[`m${index}_jerseySize`] ? <Text style={[styles.errorText, { fontSize: 10 }]}>{formErrors[`m${index}_jerseySize`]}</Text> : null}
                                                                                {(!JERSEY_SIZES.includes(member.jerseySize) && member.jerseySize !== undefined) && (
                                                                                    <TextInput label="Enter Jersey Size" value={member.jerseySize} onChangeText={(t) => updateMember(index, 'jerseySize', t)} mode="outlined" style={[styles.input, { marginTop: 5 }]} placeholder="e.g. 52" dense error={!!formErrors[`m${index}_jerseySize`]} />
                                                                                )}

                                                                                <Text style={styles.label}>Shorts Size</Text>
                                                                                <View style={[styles.dropdownTrigger, formErrors[`m${index}_shortsSize`] && { borderColor: '#B00020' }]}>
                                                                                    <Menu
                                                                                        visible={activeDropdown === `member_${index}_shorts`}
                                                                                        onDismiss={() => setActiveDropdown(null)}
                                                                                        anchor={
                                                                                            <TouchableOpacity onPress={() => setActiveDropdown(`member_${index}_shorts`)} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                                <Text style={{ fontSize: 14 }}>{member.shortsSize || 'Select Size'}</Text>
                                                                                                <MaterialCommunityIcons name="chevron-down" size={20} color="gray" />
                                                                                            </TouchableOpacity>
                                                                                        }
                                                                                    >
                                                                                        <ScrollView style={{ maxHeight: 300 }}>
                                                                                            {WAIST_SIZES.map(s => (
                                                                                                <Menu.Item key={s} onPress={() => { updateMember(index, 'shortsSize', s === 'Other' ? '' : s); setActiveDropdown(null); }} title={s} />
                                                                                            ))}
                                                                                        </ScrollView>
                                                                                    </Menu>
                                                                                </View>
                                                                                {formErrors[`m${index}_shortsSize`] ? <Text style={[styles.errorText, { fontSize: 10 }]}>{formErrors[`m${index}_shortsSize`]}</Text> : null}
                                                                                {(!WAIST_SIZES.includes(member.shortsSize) && member.shortsSize !== undefined) && (
                                                                                    <TextInput label="Enter Shorts Size" value={member.shortsSize} onChangeText={(t) => updateMember(index, 'shortsSize', t)} mode="outlined" style={[styles.input, { marginTop: 5 }]} placeholder="e.g. 44" dense error={!!formErrors[`m${index}_shortsSize`]} />
                                                                                )}

                                                                                <Text style={styles.label}>Trouser Size</Text>
                                                                                <View style={[styles.dropdownTrigger, formErrors[`m${index}_trouserSize`] && { borderColor: '#B00020' }]}>
                                                                                    <Menu
                                                                                        visible={activeDropdown === `member_${index}_trouser`}
                                                                                        onDismiss={() => setActiveDropdown(null)}
                                                                                        anchor={
                                                                                            <TouchableOpacity onPress={() => setActiveDropdown(`member_${index}_trouser`)} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                                <Text style={{ fontSize: 14 }}>{member.trouserSize || 'Select Size'}</Text>
                                                                                                <MaterialCommunityIcons name="chevron-down" size={20} color="gray" />
                                                                                            </TouchableOpacity>
                                                                                        }
                                                                                    >
                                                                                        <ScrollView style={{ maxHeight: 300 }}>
                                                                                            {WAIST_SIZES.map(s => (
                                                                                                <Menu.Item key={s} onPress={() => { updateMember(index, 'trouserSize', s === 'Other' ? '' : s); setActiveDropdown(null); }} title={s} />
                                                                                            ))}
                                                                                        </ScrollView>
                                                                                    </Menu>
                                                                                </View>
                                                                                {formErrors[`m${index}_trouserSize`] ? <Text style={[styles.errorText, { fontSize: 10 }]}>{formErrors[`m${index}_trouserSize`]}</Text> : null}
                                                                                {(!WAIST_SIZES.includes(member.trouserSize) && member.trouserSize !== undefined) && (
                                                                                    <TextInput label="Enter Trouser Size" value={member.trouserSize} onChangeText={(t) => updateMember(index, 'trouserSize', t)} mode="outlined" style={[styles.input, { marginTop: 5 }]} placeholder="e.g. 44" dense error={!!formErrors[`m${index}_trouserSize`]} />
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}

                                                                <Text style={styles.label}>Game Profile</Text>
                                                                <Text style={{ fontSize: 12, color: 'gray', marginBottom: 5 }}>Experience Level</Text>
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                                                    {['Amateur', 'District', 'State', 'Pro'].map(level => (
                                                                        <Chip key={level} selected={member.careerLevel === level} onPress={() => updateMember(index, 'careerLevel', level)} style={{ marginRight: 5 }} showSelectedOverlay compact>{level}</Chip>
                                                                    ))}
                                                                </ScrollView>
                                                                {(member.careerLevel === 'District' || member.careerLevel === 'State') && (
                                                                    <View style={{ marginBottom: 10 }}>
                                                                        <TextInput
                                                                            label={member.careerLevel === 'District' ? "District Played For" : "State Played For"}
                                                                            value={member.careerLevelDetails}
                                                                            onChangeText={(t) => updateMember(index, 'careerLevelDetails', t)}
                                                                            mode="outlined"
                                                                            dense
                                                                            style={styles.input}
                                                                            placeholder={member.careerLevel === 'District' ? "e.g. Pune" : "e.g. Maharashtra"}
                                                                            error={!!formErrors[`m${index}_careerLevelDetails`]}
                                                                        />
                                                                        {formErrors[`m${index}_careerLevelDetails`] ? <Text style={styles.errorText}>{formErrors[`m${index}_careerLevelDetails`]}</Text> : null}
                                                                    </View>
                                                                )}

                                                                <Text style={{ fontSize: 12, color: 'gray', marginBottom: 5 }}>Role</Text>
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
                                                                    {getGameConfig().roles.map(r => (
                                                                        <Chip key={r} selected={member.role === r} onPress={() => updateMember(index, 'role', r)} style={{ marginRight: 5 }} showSelectedOverlay compact>{r}</Chip>
                                                                    ))}
                                                                </ScrollView>
                                                                {formErrors[`m${index}_role`] ? <Text style={[styles.errorText, { marginBottom: 10 }]}>{formErrors[`m${index}_role`]}</Text> : null}
                                                            </>
                                                        )}
                                                    </Surface>
                                                </List.Accordion>
                                            ))}

                                            {formData.teamMembers.length < formData.maxTeamSize && tournament.entryType !== 'Duo' && (
                                                <Button mode="outlined" icon="plus" onPress={addMember} style={{ marginTop: 15 }}>Add Player</Button>
                                            )}
                                        </Surface>
                                    )}

                                    {/* Kit & Profile */}
                                    <Surface style={styles.sectionCard}>
                                        <Title style={styles.formHeader}>Game Profile & Kit</Title>
                                        <View style={styles.row}>
                                            <View style={{ flex: 1.5, marginRight: 10 }}>
                                                <TextInput label="Jersey Name" value={formData.jerseyName} onChangeText={(t) => updateForm('jerseyName', t)} mode="outlined" style={styles.input} placeholder="Name on back" error={!!formErrors.jerseyName} />
                                                {formErrors.jerseyName ? <Text style={styles.errorText}>{formErrors.jerseyName}</Text> : null}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <TextInput label="No." value={formData.jerseyNumber} onChangeText={(t) => updateForm('jerseyNumber', t)} mode="outlined" style={styles.input} keyboardType="numeric" placeholder="10" error={!!formErrors.jerseyNumber} />
                                                {formErrors.jerseyNumber ? <Text style={styles.errorText}>{formErrors.jerseyNumber}</Text> : null}
                                            </View>
                                        </View>

                                        <Text style={styles.label}>Jersey Size</Text>
                                        <View style={[styles.dropdownTrigger, formErrors.jerseySize && { borderColor: '#B00020' }]}>
                                            <Menu
                                                visible={activeDropdown === 'main_jersey'}
                                                onDismiss={() => setActiveDropdown(null)}
                                                anchor={
                                                    <TouchableOpacity onPress={() => setActiveDropdown('main_jersey')} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 16 }}>{formData.jerseySize || 'Select Size'}</Text>
                                                        <MaterialCommunityIcons name="chevron-down" size={24} color="gray" />
                                                    </TouchableOpacity>
                                                }
                                            >
                                                <ScrollView style={{ maxHeight: 300 }}>
                                                    {JERSEY_SIZES.map(s => (
                                                        <Menu.Item key={s} onPress={() => { updateForm('jerseySize', s === 'Other' ? '' : s); setActiveDropdown(null); }} title={s} />
                                                    ))}
                                                </ScrollView>
                                            </Menu>
                                        </View>
                                        {formErrors.jerseySize ? <Text style={styles.errorText}>{formErrors.jerseySize}</Text> : null}
                                        {(!JERSEY_SIZES.includes(formData.jerseySize) && formData.jerseySize !== undefined) && (
                                            <TextInput label="Enter Custom Jersey Size" value={formData.jerseySize} onChangeText={(t) => updateForm('jerseySize', t)} mode="outlined" style={[styles.input, { marginTop: 5 }]} placeholder="e.g. 52" error={!!formErrors.jerseySize} />
                                        )}

                                        <Text style={styles.label}>Shorts Size</Text>
                                        <View style={[styles.dropdownTrigger, formErrors.shortsSize && { borderColor: '#B00020' }]}>
                                            <Menu
                                                visible={activeDropdown === 'main_shorts'}
                                                onDismiss={() => setActiveDropdown(null)}
                                                anchor={
                                                    <TouchableOpacity onPress={() => setActiveDropdown('main_shorts')} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 16 }}>{formData.shortsSize || 'Select Size'}</Text>
                                                        <MaterialCommunityIcons name="chevron-down" size={24} color="gray" />
                                                    </TouchableOpacity>
                                                }
                                            >
                                                <ScrollView style={{ maxHeight: 300 }}>
                                                    {WAIST_SIZES.map(s => (
                                                        <Menu.Item key={s} onPress={() => { updateForm('shortsSize', s === 'Other' ? '' : s); setActiveDropdown(null); }} title={s} />
                                                    ))}
                                                </ScrollView>
                                            </Menu>
                                        </View>
                                        {formErrors.shortsSize ? <Text style={styles.errorText}>{formErrors.shortsSize}</Text> : null}
                                        {(!WAIST_SIZES.includes(formData.shortsSize) && formData.shortsSize !== undefined) && (
                                            <TextInput label="Enter Custom Shorts Size" value={formData.shortsSize} onChangeText={(t) => updateForm('shortsSize', t)} mode="outlined" style={[styles.input, { marginTop: 5 }]} placeholder="e.g. 44" error={!!formErrors.shortsSize} />
                                        )}

                                        <Text style={styles.label}>Trouser Size</Text>
                                        <View style={[styles.dropdownTrigger, formErrors.trouserSize && { borderColor: '#B00020' }]}>
                                            <Menu
                                                visible={activeDropdown === 'main_trouser'}
                                                onDismiss={() => setActiveDropdown(null)}
                                                anchor={
                                                    <TouchableOpacity onPress={() => setActiveDropdown('main_trouser')} style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 16 }}>{formData.trouserSize || 'Select Size'}</Text>
                                                        <MaterialCommunityIcons name="chevron-down" size={24} color="gray" />
                                                    </TouchableOpacity>
                                                }
                                            >
                                                <ScrollView style={{ maxHeight: 300 }}>
                                                    {WAIST_SIZES.map(s => (
                                                        <Menu.Item key={s} onPress={() => { updateForm('trouserSize', s === 'Other' ? '' : s); setActiveDropdown(null); }} title={s} />
                                                    ))}
                                                </ScrollView>
                                            </Menu>
                                        </View>
                                        {formErrors.trouserSize ? <Text style={styles.errorText}>{formErrors.trouserSize}</Text> : null}
                                        {(!WAIST_SIZES.includes(formData.trouserSize) && formData.trouserSize !== undefined) && (
                                            <TextInput label="Enter Custom Trouser Size" value={formData.trouserSize} onChangeText={(t) => updateForm('trouserSize', t)} mode="outlined" style={[styles.input, { marginTop: 5 }]} placeholder="e.g. 44" error={!!formErrors.trouserSize} />
                                        )}

                                        <Text style={styles.label}>Experience Level</Text>
                                        <View style={styles.wrapRow}>
                                            {['Amateur', 'District', 'State', 'Pro'].map(level => (
                                                <Chip key={level} selected={formData.careerLevel === level} onPress={() => updateForm('careerLevel', level)} style={{ marginRight: 5, marginBottom: 5 }} showSelectedOverlay icon={formData.careerLevel === level ? "check" : undefined}>{level}</Chip>
                                            ))}
                                        </View>
                                        {(formData.careerLevel === 'District' || formData.careerLevel === 'State') && (
                                            <View style={{ marginTop: 5 }}>
                                                <TextInput
                                                    label={formData.careerLevel === 'District' ? "Which District did you play for?" : "Which State did you play for?"}
                                                    value={formData.careerLevelDetails}
                                                    onChangeText={(t) => updateForm('careerLevelDetails', t)}
                                                    mode="outlined"
                                                    style={styles.input}
                                                    placeholder={formData.careerLevel === 'District' ? "e.g. Pune" : "e.g. Maharashtra"}
                                                    error={!!formErrors.careerLevelDetails}
                                                />
                                                {formErrors.careerLevelDetails ? <Text style={styles.errorText}>{formErrors.careerLevelDetails}</Text> : null}
                                            </View>
                                        )}

                                        <Divider style={{ marginVertical: 15 }} />

                                        <Text style={styles.label}>Primary Role</Text>
                                        <View style={styles.wrapRow}>
                                            {getGameConfig().roles.map(r => (
                                                <Chip key={r} selected={formData.role === r} onPress={() => updateForm('role', r)} style={styles.chip} showSelectedOverlay>{r}</Chip>
                                            ))}
                                        </View>
                                        {formErrors.role ? <Text style={styles.errorText}>{formErrors.role}</Text> : null}

                                        {/* Dynamic Attributes */}
                                        {getGameConfig().attributes.map((attr) => {
                                            if (attr.condition && !attr.condition(formData.role)) return null;
                                            return (
                                                <View key={attr.key} style={{ marginTop: 15 }}>
                                                    <Text style={styles.label}>{attr.label}</Text>
                                                    {attr.type === 'segment' ? (
                                                        <SegmentedButtons
                                                            value={formData.sportAttributes[attr.key] || ''}
                                                            onValueChange={(val) => updateForm('sportAttributes', { ...formData.sportAttributes, [attr.key]: val })}
                                                            buttons={attr.options.map(o => ({ value: o, label: o }))}
                                                        />
                                                    ) : (
                                                        <View style={styles.wrapRow}>
                                                            {attr.options.map(o => (
                                                                <Chip key={o} selected={formData.sportAttributes[attr.key] === o} onPress={() => updateForm('sportAttributes', { ...formData.sportAttributes, [attr.key]: o })} style={styles.chip} showSelectedOverlay>{o}</Chip>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </Surface>
                                </>
                            )}

                            {step === 3 && (
                                <Surface style={styles.sectionCard}>
                                    <Title style={styles.formHeader}>Review & Pay</Title>
                                    <View style={styles.invoiceCard}>
                                        <Text style={{ fontSize: 16 }}>Total Entry Fee</Text>
                                        <Title style={{ fontSize: 36, color: '#2E7D32', fontWeight: 'bold' }}>₹{tournament.entryFee}</Title>
                                    </View>

                                    <List.Item title="Registration Type" description={formData.registrationMode} left={props => <List.Icon {...props} icon="account-details" />} />
                                    {formData.selectedPredefinedTeam || formData.teamName ? <List.Item title="Team Name" description={formData.selectedPredefinedTeam || formData.teamName} left={props => <List.Icon {...props} icon="shield-account" />} /> : null}
                                    <List.Item title="Player Name" description={formData.name} left={props => <List.Icon {...props} icon="account" />} />
                                    <List.Item title="Contact" description={`${formData.email} | ${formData.phone}`} left={props => <List.Icon {...props} icon="phone" />} />

                                    <Divider style={{ marginVertical: 15 }} />

                                    <View style={{ gap: 12 }}>
                                        <Button
                                            mode="contained"
                                            onPress={confirmPayment}
                                            contentStyle={{ height: 50 }}
                                            style={{ borderRadius: 12, backgroundColor: '#1A237E' }}
                                            icon="qrcode-scan"
                                        >
                                            Pay with UPI / QR
                                        </Button>


                                    </View>

                                    <View style={{ marginTop: 25, alignItems: 'center', backgroundColor: '#F8F9FE', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#E8EAF6' }}>
                                        <Text style={{ fontSize: 11, color: '#7986CB', fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 }}>SECURE PAYMENT GATEWAY</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                                            <View style={{ alignItems: 'center' }}>
                                                <MaterialCommunityIcons name="google" size={30} color="#5F6368" />
                                                <Text style={{ fontSize: 9, color: '#666', marginTop: 4 }}>GPay</Text>
                                            </View>
                                            <View style={{ alignItems: 'center' }}>
                                                <MaterialCommunityIcons name="alpha-p-circle" size={28} color="#673AB7" />
                                                <Text style={{ fontSize: 9, color: '#666', marginTop: 4 }}>PhonePe</Text>
                                            </View>
                                            <View style={{ alignItems: 'center' }}>
                                                <MaterialCommunityIcons name="qrcode-scan" size={26} color="#1A237E" />
                                                <Text style={{ fontSize: 9, color: '#666', marginTop: 4 }}>Any UPI</Text>
                                            </View>
                                        </View>
                                        <Divider style={{ width: '100%', marginVertical: 12 }} />
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <MaterialCommunityIcons name="shield-check" size={16} color="#2E7D32" style={{ marginRight: 6 }} />
                                            <Text style={{ fontSize: 11, color: '#2E7D32', fontWeight: '500' }}>100% Encrypted & Secure Payments</Text>
                                        </View>
                                    </View>
                                </Surface>
                            )}

                            {/* Navigation Buttons */}
                            <View style={styles.navRow}>
                                {step > 1 && <Button mode="outlined" onPress={prevStep} style={styles.navBtn}>Back</Button>}
                                {step < 3 && <Button mode="contained" onPress={nextStep} style={[styles.navBtn, { marginLeft: 'auto' }]}>Next</Button>}
                            </View>

                        </View>
                    )}
                </View>

                {/* Payment Modal */}
                <Portal>
                    <Modal visible={paymentModalVisible} onDismiss={() => { if (paymentStatus !== 'pending') setPaymentModalVisible(false) }} contentContainerStyle={styles.modal}>
                        {paymentStatus === 'pending' && <View style={{ alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /><Title style={{ marginTop: 20 }}>Processing Payment...</Title></View>}
                        {paymentStatus === 'failed' && (
                            <View style={{ alignItems: 'center' }}>
                                <MaterialCommunityIcons name="alert-circle" size={50} color="red" />
                                <Title style={{ color: 'red' }}>Payment Failed</Title>
                                <Text style={{ marginBottom: 20, textAlign: 'center' }}>{errorMessage || "Something went wrong."}</Text>
                                <Button mode="contained" onPress={() => setPaymentModalVisible(false)}>Try Again</Button>
                            </View>
                        )}
                        {paymentStatus === 'success' && <View style={{ alignItems: 'center' }}><MaterialCommunityIcons name="check-circle" size={50} color="green" /><Title>Success!</Title></View>}
                    </Modal>

                    {/* Success Poster Modal */}
                    <Modal visible={posterVisible} onDismiss={() => router.replace('/(player)')} contentContainerStyle={[styles.modal, { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 }]}>
                        <View style={styles.successCard}>
                            <View style={styles.iconCircle}>
                                <MaterialCommunityIcons name="trophy-award" size={60} color="#FFD700" />
                            </View>
                            <Title style={styles.successTitle}>You're In!</Title>
                            <Text style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>
                                Registration successful. Get ready to compete!
                            </Text>

                            <View style={styles.ticket}>
                                <Text style={styles.ticketLabel}>REGISTRATION ID</Text>
                                <Title style={{ fontSize: 28, letterSpacing: 2, fontWeight: 'bold' }}>{registrationId}</Title>
                                <Divider style={{ width: '100%', marginVertical: 15 }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                                    <View>
                                        <Text style={styles.ticketLabel}>PLAYER / TEAM</Text>
                                        <Text style={{ fontWeight: 'bold' }}>{formData.teamName || formData.name}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.ticketLabel}>ENTRY TYPE</Text>
                                        <Text style={{ fontWeight: 'bold' }}>{formData.registrationMode}</Text>
                                    </View>
                                </View>
                            </View>

                            {organizerInfo && (
                                <View style={styles.organizerContactBox}>
                                    <Text style={styles.ticketLabel}>FOR ANY ASSISTANCE, CONTACT ORGANIZER</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                                        <Avatar.Text size={36} label={organizerInfo.name?.[0] || 'O'} style={{ backgroundColor: theme.colors.primaryContainer }} />
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{organizerInfo.name}</Text>
                                            <Text style={{ color: 'gray', fontSize: 13 }}>{organizerInfo.phone || 'Contact not available'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row' }}>
                                            <IconButton
                                                icon="whatsapp"
                                                mode="contained"
                                                containerColor="#25D366"
                                                iconColor="white"
                                                size={20}
                                                onPress={() => Linking.openURL(`https://wa.me/${organizerInfo.phone}`)}
                                            />
                                            <IconButton
                                                icon="phone"
                                                mode="contained"
                                                containerColor={theme.colors.primary}
                                                iconColor="white"
                                                size={20}
                                                onPress={() => Linking.openURL(`tel:${organizerInfo.phone}`)}
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}

                            <Button mode="contained" style={{ marginTop: 20, width: '100%', borderRadius: 12 }} contentStyle={{ height: 50 }} onPress={() => router.replace('/(player)')}>
                                Go to Dashboard
                            </Button>
                        </View>
                    </Modal>
                </Portal>

                {showDatePicker && (
                    <DateTimePicker
                        value={(() => {
                            const d = (datePickerTarget.type === 'main' ? formData.dob : formData.teamMembers[datePickerTarget.index].dob);
                            if (d && d.includes('-')) {
                                const [day, month, year] = d.split('-');
                                return new Date(year, month - 1, day);
                            }
                            return new Date(2000, 0, 1);
                        })()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                    />
                )}
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    webContainer: { width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: '#F0F2F5' },
    headerContainer: { borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', marginBottom: 0, zIndex: 1 },
    headerGradient: { padding: 25, paddingBottom: 25 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 26, letterSpacing: 0.5 },
    headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 5 },
    headerStats: { flexDirection: 'row', marginTop: 25, padding: 15, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase' },
    statValue: { color: 'white', fontWeight: 'bold', fontSize: 16, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

    content: { padding: 15, paddingTop: 20 },
    sectionCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    formCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, minHeight: 400 }, // Legacy, can remove if unused later, keeping for safety
    formHeader: { fontSize: 18, color: '#1A237E', marginBottom: 20, fontWeight: 'bold', letterSpacing: 0.5, borderLeftWidth: 4, borderLeftColor: '#304FFE', paddingLeft: 10 },

    uploadBox: { height: 130, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FE', borderRadius: 16, borderWidth: 1.5, borderColor: '#E8EAF6', borderStyle: 'dashed', overflow: 'hidden' },
    uploadLabel: { color: '#7986CB', fontSize: 12, marginTop: 8, fontWeight: '600' },

    input: { marginBottom: 12, backgroundColor: 'white' },
    row: { flexDirection: 'row', alignItems: 'center' },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { marginBottom: 8 },
    label: { fontWeight: 'bold', marginTop: 8, marginBottom: 6, color: '#555' },

    modeSelector: { padding: 12, backgroundColor: '#E8EAF6', borderRadius: 12, marginBottom: 15 },
    modeLabel: { fontWeight: 'bold', color: '#303f9f', marginBottom: 8 },
    radioOption: { flexDirection: 'row', alignItems: 'center' },
    radioText: { fontSize: 15 },

    radioCard: { padding: 5, marginBottom: 8, borderRadius: 8, backgroundColor: 'white', borderWidth: 1, borderColor: '#eee' },
    accordionHeader: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
    rosterForm: { padding: 15, backgroundColor: '#FAFAFA' },

    invoiceCard: { backgroundColor: '#E8F5E9', padding: 20, alignItems: 'center', borderRadius: 12, marginBottom: 20, width: '100%' },
    successCard: { width: '90%', maxWidth: 450, padding: 40, backgroundColor: 'white', borderRadius: 24, alignItems: 'center', elevation: 10 },
    successTitle: { marginVertical: 15, color: '#2E7D32', fontSize: 24, fontWeight: 'bold' },
    ticket: { borderWidth: 1, borderColor: '#ccc', borderStyle: 'dashed', padding: 20, width: '100%', alignItems: 'center', borderRadius: 10, backgroundColor: '#FAFAFA' },
    ticketLabel: { color: '#999', fontSize: 10, letterSpacing: 1.5, marginBottom: 5 },
    organizerContactBox: { width: '100%', marginTop: 20, padding: 15, backgroundColor: '#F5F5F5', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },

    navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    navBtn: { minWidth: 100 },
    modal: { backgroundColor: 'white', padding: 30, borderRadius: 16, width: '90%', maxWidth: 400, alignSelf: 'center' },

    // Team Selection Grid
    teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginVertical: 10 },
    teamSelectCard: { width: '45%', backgroundColor: 'white', borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee', elevation: 2 },
    teamSelectLogo: { width: 60, height: 60, borderRadius: 30, marginBottom: 8 },
    teamSelectName: { fontWeight: 'bold', fontSize: 13, color: '#333' },

    // Tournament Details
    detailsGrid: { flexDirection: 'row', gap: 12, marginTop: 15 },
    detailCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FE', padding: 12, borderRadius: 12 },
    detailLabel: { fontSize: 10, color: '#7986CB', fontWeight: 'bold', letterSpacing: 0.5 },
    detailValue: { fontSize: 13, color: '#333', fontWeight: '600', marginTop: 1 },
    iconBox: { justifyContent: 'center', alignItems: 'center' },
    iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginTop: 5, backgroundColor: 'white' },
    infoBox: { flexDirection: 'row', padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, alignItems: 'center' },
    errorText: { color: '#B00020', fontSize: 11, marginTop: -8, marginBottom: 8, marginLeft: 5 }
});
