import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, HelperText, useTheme, ActivityIndicator, Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
// import { initializeApp, deleteApp } from 'firebase/app'; // Not needed
// import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'; // Not needed
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // setDoc removed as CF does it
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import * as ImagePicker from 'expo-image-picker';
import { db, auth, storage, functions } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';
import Toast from 'react-native-toast-message';

import DateTimePicker from '@react-native-community/datetimepicker';

export default function CreateOrganizerScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { editId } = useLocalSearchParams();
    const { user } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [aadharNumber, setAadharNumber] = useState('');
    const [panNumber, setPanNumber] = useState('');
    const [accessExpiryDate, setAccessExpiryDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Image State
    const [profileImage, setProfileImage] = useState(null);
    const [aadharImage, setAadharImage] = useState(null);
    const [panImage, setPanImage] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [bankDetails, setBankDetails] = useState({ accountNumber: '', ifsc: '', bankName: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (editId) {
            fetchOrganizerDetails();
        } else {
            // Reset to fresh state for new organizer
            setName('');
            setEmail('');
            setPassword('');
            setPhone('');
            setAddress('');
            setAadharNumber('');
            setPanNumber('');
            setProfileImage(null);
            setAadharImage(null);
            setPanImage(null);
            setBankDetails({ accountNumber: '', ifsc: '', bankName: '' });
            setAccessExpiryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        }
    }, [editId]);

    const fetchOrganizerDetails = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, 'users', editId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setName(data.name);
                setEmail(data.email);
                setPhone(data.phone);
                setAddress(data.address);
                setAadharNumber(data.aadharNumber);
                setPanNumber(data.panNumber || '');
                setProfileImage(data.profilePic);
                setAadharImage(data.aadharPhoto);
                setPanImage(data.panPhoto || null);
                setBankDetails(data.bankDetails || { accountNumber: '', ifsc: '', bankName: '' });
                if (data.accessExpiryDate) setAccessExpiryDate(new Date(data.accessExpiryDate));
                // Password is not fetched usually for security, and we won't allow editing it here to avoid auth sync issues easily
            }
        } catch (error) {
            console.error("Error fetching organizer:", error);
            Alert.alert("Error", "Failed to load organizer details");
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async (setImageFunc) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            if (result.assets[0].base64) {
                // Use base64 to avoid cross-origin blob issues on web
                const mimeType = result.assets[0].mimeType || 'image/jpeg';
                setImageFunc(`data:${mimeType};base64,${result.assets[0].base64}`);
            } else {
                setImageFunc(result.assets[0].uri);
            }
        }
    };

    const uploadFile = async (uri, path) => {
        if (!uri || uri.startsWith('http')) return uri; // Return existing URL if not a new local file
        try {
            const storageRef = ref(storage, path);
            if (uri.startsWith('data:')) {
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

    // --- Email Sending Logic moved to Cloud Function "createOrganizer" ---
    // The previous client-side implementation was insecure and has been removed.


    const validate = () => {
        let newErrors = {};
        if (!name?.trim()) newErrors.name = "Name is required";
        if (!phone?.trim()) newErrors.phone = "Phone is required";
        if (phone && (phone.length < 10 || phone.length > 12)) newErrors.phone = "Invalid phone number (10-12 digits)";
        if (!address?.trim()) newErrors.address = "Address is required";
        if (!aadharNumber?.trim()) newErrors.aadharNumber = "Aadhar number is required";
        if (aadharNumber && !/^[0-9]{12}$/.test(aadharNumber.replace(/\s/g, ''))) newErrors.aadharNumber = "Must be 12 digits";

        if (!bankDetails.accountNumber?.trim()) newErrors.accountNumber = "Account number is required";
        if (!bankDetails.ifsc?.trim()) newErrors.ifsc = "IFSC code is required";
        if (!bankDetails.bankName?.trim()) newErrors.bankName = "Bank name is required";

        if (!profileImage) newErrors.profileImage = "Profile photo is required";
        if (!aadharImage) newErrors.aadharImage = "Aadhar card photo is required";

        if (!panNumber?.trim()) newErrors.panNumber = "PAN number is required";
        if (!panImage) newErrors.panImage = "PAN card photo is required";

        if (!editId) {
            if (!email?.trim()) newErrors.email = "Email is required";
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email format";
            if (!password || password.length < 6) newErrors.password = "Password must be at least 6 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        // 0. Check Authentication
        if (!user) {
            Alert.alert('Error', 'You must be logged in to create an organizer.');
            return;
        }

        if (!validate()) {
            Alert.alert("Validation Error", "Please fill in all required fields marked in red.");
            return;
        }

        setLoading(true);
        setUploading(true);

        try {
            const timestamp = Date.now();
            let profilePicUrl = profileImage;
            let aadharPhotoUrl = aadharImage;
            let panPhotoUrl = panImage;

            // Helper to safe upload
            const safeUpload = async (uri, path, label) => {
                if (!uri || uri.startsWith('http')) return uri;
                try {
                    return await uploadFile(uri, path);
                } catch (e) {
                    console.error(`${label} upload failed:`, e);
                    throw new Error(`Failed to upload ${label}. Please try again.`);
                }
            };

            // Upload Sequentially
            profilePicUrl = await safeUpload(profileImage, `organizers/${timestamp}_profile.jpg`, "Profile Photo");
            aadharPhotoUrl = await safeUpload(aadharImage, `organizers/${timestamp}_aadhar.jpg`, "Aadhar Photo");
            if (panImage) {
                panPhotoUrl = await safeUpload(panImage, `organizers/${timestamp}_pan.jpg`, "PAN Photo");
            }

            const accessExpiryIso = (() => {
                const finalDate = new Date(accessExpiryDate);
                finalDate.setHours(23, 59, 59, 999);
                return finalDate.toISOString();
            })();

            if (editId) {
                await updateDoc(doc(db, "users", editId), {
                    name, phone, address, aadharNumber,
                    panNumber: panNumber || null,
                    profilePic: profilePicUrl,
                    aadharPhoto: aadharPhotoUrl,
                    panPhoto: panPhotoUrl || null,
                    bankDetails,
                    accessExpiryDate: accessExpiryIso,
                });
                Toast.show({
                    type: 'success',
                    text1: '✅ Organizer Updated!',
                    text2: 'Profile details saved successfully',
                    visibilityTime: 3000,
                });
            } else {
                const createOrganizer = httpsCallable(functions, 'createOrganizer');
                const payload = {
                    email, password, name, phone, address, aadharNumber,
                    panNumber: panNumber || null, // Explicitly pass null if empty
                    profilePic: profilePicUrl,
                    aadharPhoto: aadharPhotoUrl,
                    panPhoto: panPhotoUrl || null,
                    bankDetails,
                    accessExpiryDate: accessExpiryIso,
                };

                // console.log("Submitting payload:", JSON.stringify(payload));
                await createOrganizer(payload);
                Toast.show({
                    type: 'success',
                    text1: '✅ Organizer Created!',
                    text2: 'Account and login credentials set up successfully',
                    visibilityTime: 4000,
                });
            }
            router.back();

        } catch (error) {
            console.error("Save Organizer Error:", error);
            // alert(`Debug: Error Catch: ${error.message}`);
            let msg = error.message || "An unknown error occurred.";
            if (msg.includes('already-exists')) msg = "Email already registered.";
            if (msg.includes('permission-denied')) msg = "Permission denied. Only Owners can create accounts.";
            Alert.alert('Registration Failed', msg);
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="black" />
                    </TouchableOpacity>
                    <Title style={styles.title}>{editId ? "Edit Organizer" : "Create New Organizer"}</Title>
                </View>

                {/* 1. Profile Picture Section */}
                <View style={styles.profileSection}>
                    <TouchableOpacity onPress={() => pickImage(setProfileImage)} style={[styles.profileUpload, errors.profileImage && { borderColor: 'red', borderWidth: 2 }]}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.profilePreview} />
                        ) : (
                            <View style={styles.profilePlaceholder}>
                                <MaterialCommunityIcons name="camera-plus" size={30} color={errors.profileImage ? "red" : theme.colors.primary} />
                                <Text style={[styles.profileText, errors.profileImage && { color: 'red' }]}>Add Photo</Text>
                            </View>
                        )}
                        {/* Edit Icon Overlay */}
                        <View style={[styles.editIconBadge, { backgroundColor: theme.colors.primary }]}>
                            <MaterialCommunityIcons name="pencil" size={14} color="white" />
                        </View>
                    </TouchableOpacity>
                    {errors.profileImage && <HelperText type="error" visible={true}>{errors.profileImage}</HelperText>}
                </View>

                {/* 2. Personal Information Card */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="account-details" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Personal Details</Title>
                    </View>

                    <TextInput
                        label="Full Name"
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        error={!!errors.name}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="account" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.name}>{errors.name}</HelperText>
                    <TextInput
                        label="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        disabled={!!editId}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        mode="outlined"
                        error={!!errors.email}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="email" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.email}>{errors.email}</HelperText>
                    <TextInput
                        label="Phone Number"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        mode="outlined"
                        error={!!errors.phone}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="phone" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.phone}>{errors.phone}</HelperText>
                    <TextInput
                        label="Full Address"
                        value={address}
                        onChangeText={setAddress}
                        mode="outlined"
                        error={!!errors.address}
                        style={styles.input}
                        multiline
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="map-marker" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.address}>{errors.address}</HelperText>
                    <TextInput
                        label="Aadhar Number"
                        value={aadharNumber}
                        onChangeText={setAadharNumber}
                        keyboardType="numeric"
                        mode="outlined"
                        error={!!errors.aadharNumber}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="card-account-details" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.aadharNumber}>{errors.aadharNumber}</HelperText>
                    <TextInput
                        label="PAN Card Number"
                        value={panNumber}
                        onChangeText={(text) => setPanNumber(text.toUpperCase())}
                        autoCapitalize="characters"
                        maxLength={10}
                        mode="outlined"
                        error={!!errors.panNumber}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="credit-card-outline" size={20} color="gray" />} />}
                        placeholder="ABCDE1234F"
                    />
                    <HelperText type="error" visible={!!errors.panNumber}>{errors.panNumber}</HelperText>

                    <Text style={[styles.subLabel, errors.aadharImage && { color: 'red' }]}>Aadhar Card Photo</Text>
                    <TouchableOpacity onPress={() => pickImage(setAadharImage)} style={[styles.documentUpload, errors.aadharImage && { borderColor: 'red' }]}>
                        {aadharImage ? (
                            <>
                                <Image source={{ uri: aadharImage }} style={styles.documentPreview} />
                                <View style={styles.reuploadOverlay}>
                                    <MaterialCommunityIcons name="refresh" size={24} color="white" />
                                </View>
                            </>
                        ) : (
                            <View style={styles.documentPlaceholder}>
                                <MaterialCommunityIcons name="file-document-outline" size={32} color={errors.aadharImage ? "red" : "gray"} />
                                <Text style={{ color: errors.aadharImage ? "red" : 'gray', marginTop: 5 }}>Tap to Upload Aadhar</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {errors.aadharImage && <HelperText type="error" visible={true}>{errors.aadharImage}</HelperText>}

                    <Text style={[styles.subLabel, errors.panImage && { color: 'red' }]}>PAN Card Photo</Text>
                    <TouchableOpacity onPress={() => pickImage(setPanImage)} style={[styles.documentUpload, errors.panImage && { borderColor: 'red' }]}>
                        {panImage ? (
                            <>
                                <Image source={{ uri: panImage }} style={styles.documentPreview} />
                                <View style={styles.reuploadOverlay}>
                                    <MaterialCommunityIcons name="refresh" size={24} color="white" />
                                </View>
                            </>
                        ) : (
                            <View style={styles.documentPlaceholder}>
                                <MaterialCommunityIcons name="credit-card-outline" size={32} color={errors.panImage ? "red" : "gray"} />
                                <Text style={{ color: errors.panImage ? "red" : 'gray', marginTop: 5 }}>Tap to Upload PAN Card</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {errors.panImage && <HelperText type="error" visible={true}>{errors.panImage}</HelperText>}
                </Surface>

                {/* 3. Bank Details Card */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="bank" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Bank Details</Title>
                    </View>
                    <TextInput
                        label="Account Number"
                        value={bankDetails.accountNumber}
                        onChangeText={(text) => setBankDetails({ ...bankDetails, accountNumber: text })}
                        keyboardType="numeric"
                        mode="outlined"
                        error={!!errors.accountNumber}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="numeric" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.accountNumber}>{errors.accountNumber}</HelperText>

                    <TextInput
                        label="IFSC Code"
                        value={bankDetails.ifsc}
                        onChangeText={(text) => setBankDetails({ ...bankDetails, ifsc: text })}
                        autoCapitalize="characters"
                        mode="outlined"
                        error={!!errors.ifsc}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="barcode" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.ifsc}>{errors.ifsc}</HelperText>

                    <TextInput
                        label="Bank Name"
                        value={bankDetails.bankName}
                        onChangeText={(text) => setBankDetails({ ...bankDetails, bankName: text })}
                        mode="outlined"
                        error={!!errors.bankName}
                        style={styles.input}
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="bank-outline" size={20} color="gray" />} />}
                    />
                    <HelperText type="error" visible={!!errors.bankName}>{errors.bankName}</HelperText>
                </Surface>

                {/* 4. Access Duration Card */}
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
                        <Title style={styles.cardTitle}>Access Duration</Title>
                    </View>
                    <Text style={{ marginBottom: 10, color: 'gray' }}>
                        Set how long this organizer has access to the platform.
                    </Text>
                    {Platform.OS === 'web' ? (
                        <View style={{ marginTop: 10 }}>
                            <input
                                type="date"
                                value={accessExpiryDate.toISOString().split('T')[0]}
                                onChange={(e) => {
                                    const date = new Date(e.target.value);
                                    if (!isNaN(date.getTime())) setAccessExpiryDate(date);
                                }}
                                style={{
                                    width: '100%',
                                    height: '56px',
                                    padding: '0 15px',
                                    borderRadius: '4px',
                                    border: `1px solid #ccc`,
                                    fontSize: '16px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    backgroundColor: 'white',
                                    color: '#333',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={(e) => e.target.style.borderColor = theme.colors.primary}
                                onBlur={(e) => e.target.style.borderColor = '#ccc'}
                            />
                        </View>
                    ) : (
                        <>
                            <Button
                                mode="outlined"
                                onPress={() => setShowDatePicker(true)}
                                icon="calendar"
                                style={{ borderColor: theme.colors.primary }}
                            >
                                Valid Until: {accessExpiryDate.toLocaleDateString()}
                            </Button>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={accessExpiryDate}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setAccessExpiryDate(selectedDate);
                                    }}
                                />
                            )}
                        </>
                    )}
                </Surface>

                {/* 5. Security Card -- HIDDEN IN EDIT MODE */}
                {!editId && (
                    <Surface style={styles.card} elevation={1}>
                        <View style={styles.cardHeader}>
                            <MaterialCommunityIcons name="shield-lock" size={20} color={theme.colors.primary} />
                            <Title style={styles.cardTitle}>Security</Title>
                        </View>
                        <TextInput
                            label="Set Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            mode="outlined"
                            error={!!errors.password}
                            style={styles.input}
                            left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="lock" size={20} color="gray" />} />}
                            right={
                                <TextInput.Icon
                                    icon={() => <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="gray" />}
                                    onPress={() => setShowPassword(!showPassword)}
                                />
                            }
                        />
                        {errors.password ? (
                            <HelperText type="error" visible={true}>{errors.password}</HelperText>
                        ) : (
                            <HelperText type="info">Minimum 6 characters required.</HelperText>
                        )}
                    </Surface>
                )}

                <Button
                    mode="contained"
                    onPress={handleSave}
                    loading={loading || uploading}
                    disabled={loading || uploading}
                    style={styles.createButton}
                    contentStyle={{ height: 50 }}
                    icon="check"
                >
                    {uploading ? "Saving..." : (editId ? "Update Organizer" : "Create Account")}
                </Button>

                <View style={{ height: 40 }} />
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
    headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backButton: { padding: 8, marginRight: 10, backgroundColor: 'white', borderRadius: 20 },
    title: { fontSize: 24, fontWeight: 'bold' },

    profileSection: { alignItems: 'center', marginBottom: 25 },
    profileUpload: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: 'white',
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profilePreview: { width: 110, height: 110, borderRadius: 55 },
    profilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    profileText: { fontSize: 10, color: 'gray', marginTop: 4, fontWeight: '600' },
    editIconBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: 'white'
    },

    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },

    input: { marginBottom: 12, backgroundColor: 'white' },

    subLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginTop: 10, marginBottom: 8 },
    documentUpload: {
        height: 150,
        borderWidth: 2,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        borderRadius: 12,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    documentPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    documentPlaceholder: { alignItems: 'center' },
    reuploadOverlay: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center', alignItems: 'center'
    },

    createButton: { borderRadius: 12, marginTop: 10, paddingVertical: 2 }
});
