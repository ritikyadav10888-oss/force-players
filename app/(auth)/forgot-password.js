import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { TextInput, Button, Text, Title, Surface, useTheme, Banner, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [sentToEmail, setSentToEmail] = useState('');

    // Snackbar State
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarType, setSnackbarType] = useState('error'); // 'error' or 'success'

    const { resetPassword } = useAuth();
    const router = useRouter();
    const theme = useTheme();

    // Network connectivity listener
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
        });

        return () => unsubscribe();
    }, []);

    const handleResetPassword = async () => {
        if (isOffline) {
            setSnackbarMessage('📡 You are offline. Please check your internet connection.');
            setSnackbarType('error');
            setSnackbarVisible(true);
            return;
        }

        if (!email) {
            setSnackbarMessage('📧 Please enter your email address.');
            setSnackbarType('error');
            setSnackbarVisible(true);
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setSnackbarMessage('❌ Please enter a valid email address.');
            setSnackbarType('error');
            setSnackbarVisible(true);
            return;
        }

        setIsLoading(true);
        try {
            await resetPassword(email);
            setSentToEmail(email);
            setEmailSent(true);
            setEmail('');
            setSnackbarMessage('✅ Password reset email sent! Check your inbox.');
            setSnackbarType('success');
            setSnackbarVisible(true);
        } catch (error) {
            console.error('Password reset error:', error);

            let errorMessage = 'Failed to send reset email. Please try again.';

            if (error.code === 'auth/user-not-found') {
                errorMessage = '❌ No account found with this email.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = '❌ Invalid email format.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = '❌ Too many requests. Try again later.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = '❌ Network error.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            setSnackbarMessage(errorMessage);
            setSnackbarType('error');
            setSnackbarVisible(true);
        } finally {
            setIsLoading(false);
        }
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

                    <View style={styles.content}>
                        <View style={styles.logoContainer}>
                            <Surface style={styles.iconCircle} elevation={4}>
                                <MaterialCommunityIcons name="lock-reset" size={60} color={theme.colors.primary} />
                            </Surface>
                            <Title style={styles.appTitle}>Reset Password</Title>
                            <Text style={styles.appSubtitle}>Enter your email to receive a reset link</Text>
                        </View>

                        <Surface style={styles.card} elevation={5}>
                            <Text style={styles.instructions}>
                                Enter your email address below and we'll send you a link to reset your password.
                                {'\n\n'}
                                🔒 Secure Password Recovery
                            </Text>

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
                                autoFocus
                                accessibilityLabel="Email Address"
                            />

                            <Button
                                mode="contained"
                                onPress={handleResetPassword}
                                loading={isLoading}
                                disabled={isLoading}
                                style={styles.button}
                                contentStyle={{ height: 56 }}
                                icon="send"
                                labelStyle={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 }}
                            >
                                Send Reset Link
                            </Button>

                            <Button
                                mode="text"
                                onPress={() => router.back()}
                                style={{ marginTop: 20 }}
                                disabled={isLoading}
                                icon="arrow-left"
                                labelStyle={{ fontSize: 14, fontWeight: '600' }}
                            >
                                Return to Login
                            </Button>
                        </Surface>


                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        textAlign: 'center'
    },
    appSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 5,
        fontWeight: '500',
        textAlign: 'center'
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 28,
        paddingHorizontal: 30,
        paddingVertical: 40,
        width: '100%',
        maxWidth: 480,
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
    instructions: {
        textAlign: 'center',
        marginBottom: 25,
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
        fontWeight: '500'
    },
    input: {
        marginBottom: 20,
        backgroundColor: 'white'
    },
    button: {
        marginTop: 10,
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
        alignSelf: 'center'
    },
    offlineText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
