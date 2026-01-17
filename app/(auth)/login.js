import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { TextInput, Button, Text, Title, Surface, useTheme, Banner, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    // Snackbar State
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarType, setSnackbarType] = useState('error'); // 'error' or 'success'

    const { login, resetPassword } = useAuth();
    const router = useRouter();
    const theme = useTheme();

    // Network connectivity listener
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
        });

        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        if (isOffline) {
            Alert.alert('No Internet Connection', '📡 You are offline. Please check your internet connection and try again.');
            return;
        }

        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        setIsLoginLoading(true);
        try {
            await login(email, password);
            // Router redirection is handled in app/index.js based on auth state change
        } catch (error) {
            console.error(error);

            // Provide user-friendly error messages based on Firebase error codes
            let errorMessage = 'Login failed. Please try again.';

            if (error.code === 'auth/wrong-password') {
                errorMessage = '❌ Incorrect password. Please try again or use "Forgot Password".';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = '❌ No account found with this email address.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = '❌ Invalid email format. Please check your email address.';
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = '❌ This account has been disabled. Please contact support.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = '❌ Too many failed login attempts. Please try again later or reset your password.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = '❌ Network error. Please check your internet connection.';
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = '❌ Invalid email or password. Please check your credentials.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            setSnackbarMessage(errorMessage);
            setSnackbarType('error');
            setSnackbarVisible(true);
        } finally {
            setIsLoginLoading(false);
        }
    };

    const handleForgotPassword = () => {
        router.push('/(auth)/forgot-password');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[theme.colors.primary, '#1a237e']}
                style={styles.background}
            />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Offline Banner */}
                        {isOffline && (
                            <Banner
                                visible={true}
                                icon="wifi-off"
                                style={styles.offlineBanner}
                            >
                                <Text style={styles.offlineText}>
                                    📡 You're offline. Please check your internet connection.
                                </Text>
                            </Banner>
                        )}

                        <View style={styles.logoContainer}>
                            <Surface style={styles.iconCircle} elevation={4}>
                                <Image
                                    source={require('../../assets/logo.png')}
                                    style={{ width: 80, height: 80, borderRadius: 40 }}
                                    resizeMode="contain"
                                />
                            </Surface>
                            <Title style={styles.appTitle}>Force Player Register</Title>
                            <Text style={styles.appSubtitle}>Tournament Management System</Text>
                        </View>

                        <Surface style={styles.card} elevation={10}>
                            <Title style={styles.loginTitle}>Welcome Back</Title>

                            <TextInput
                                label="Email Address"
                                value={email}
                                onChangeText={setEmail}
                                mode="outlined"
                                left={<TextInput.Icon icon="email" color={theme.colors.primary} />}
                                style={styles.input}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                outlineColor="#E0E0E0"
                                activeOutlineColor={theme.colors.primary}
                                textColor="#333"
                                accessibilityLabel="Email Address"
                            />

                            <TextInput
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                mode="outlined"
                                left={<TextInput.Icon icon="lock" color={theme.colors.primary} />}
                                right={
                                    <TextInput.Icon
                                        icon={showPassword ? "eye-off" : "eye"}
                                        color="gray"
                                        onPress={() => setShowPassword(!showPassword)}
                                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                                    />
                                }
                                secureTextEntry={!showPassword}
                                style={styles.input}
                                outlineColor="#E0E0E0"
                                activeOutlineColor={theme.colors.primary}
                                textColor="#333"
                                accessibilityLabel="Password"
                            />

                            <Button
                                mode="contained"
                                onPress={handleLogin}
                                loading={isLoginLoading}
                                style={styles.button}
                                contentStyle={{ height: 56 }}
                                labelStyle={{ fontSize: 18, fontWeight: 'bold' }}
                                accessibilityLabel="Login"
                                icon="login"
                            >
                                Login
                            </Button>

                            <Button
                                mode="text"
                                onPress={handleForgotPassword}
                                style={{ marginTop: 20 }}
                                disabled={isLoginLoading}
                                icon="lock-question"
                                labelStyle={{ fontSize: 15, fontWeight: '600' }}
                                accessibilityRole="button"
                                accessibilityLabel="Forgot Password"
                            >
                                Forgot Password?
                            </Button>
                        </Surface>

                        <View style={styles.footer} accessibilityRole="navigation" accessibilityLabel="Legal Links">
                            <View style={styles.policyLinks}>
                                <TouchableOpacity
                                    onPress={() => router.push('/policies/terms')}
                                    accessibilityRole="link"
                                    accessibilityLabel="Terms of Service"
                                >
                                    <Text style={styles.policyText}>Terms</Text>
                                </TouchableOpacity>
                                <Text style={styles.divider} importantForAccessibility="no-hide-descendants">•</Text>
                                <TouchableOpacity
                                    onPress={() => router.push('/policies/privacy')}
                                    accessibilityRole="link"
                                    accessibilityLabel="Privacy Policy"
                                >
                                    <Text style={styles.policyText}>Privacy</Text>
                                </TouchableOpacity>
                                <Text style={styles.divider} importantForAccessibility="no-hide-descendants">•</Text>
                                <TouchableOpacity
                                    onPress={() => router.push('/policies/refund')}
                                    accessibilityRole="link"
                                    accessibilityLabel="Refund Policy"
                                >
                                    <Text style={styles.policyText}>Refund</Text>
                                </TouchableOpacity>
                                <Text style={styles.divider} importantForAccessibility="no-hide-descendants">•</Text>
                                <TouchableOpacity
                                    onPress={() => router.push('/policies/contact')}
                                    accessibilityRole="link"
                                    accessibilityLabel="Contact Support"
                                >
                                    <Text style={styles.policyText}>Contact</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>v1.0.0 - Secure System</Text>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
            {/* Snackbar for Notifications */}
            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={4000}
                style={{ backgroundColor: snackbarType === 'error' ? '#D32F2F' : '#388E3C' }}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '100%',
    },
    safeArea: {
        flex: 1,
        padding: 20
    },
    keyboardView: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    appTitle: {
        fontSize: 36,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 1.5,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        textAlign: 'center'
    },
    appSubtitle: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 5,
        fontWeight: '500',
        letterSpacing: 0.5
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 28,
        paddingHorizontal: 30,
        paddingVertical: 40,
        width: '100%',
        maxWidth: 480, // Slightly wider for better web proportional
        alignSelf: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 10,
    },
    loginTitle: {
        textAlign: 'center',
        marginBottom: 30,
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a237e'
    },
    input: {
        marginBottom: 20,
        backgroundColor: 'white'
    },
    button: {
        marginTop: 15,
        borderRadius: 16,
        backgroundColor: '#1a237e',
        elevation: 4
    },
    footer: {
        marginTop: 30,
        alignItems: 'center'
    },
    offlineBanner: {
        backgroundColor: '#FF6B6B',
        marginBottom: 20,
        borderRadius: 12,
        width: '100%',
        maxWidth: 480,
    },
    offlineText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    policyLinks: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    policyText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '500',
    },
    divider: {
        color: 'rgba(255,255,255,0.5)',
        marginHorizontal: 8,
    }
});
