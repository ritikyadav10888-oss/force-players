import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider as PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

// Function to suppress specific web warnings
if (Platform.OS === 'web') {
    const originalWarn = console.warn;
    console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && (
            args[0].includes('useNativeDriver') ||
            args[0].includes('shadow') ||
            args[0].includes('aria-hidden') ||
            args[0].includes('BloomFilter')
        )) {
            return;
        }
        originalWarn(...args);
    };
    // Suppress unhandled rejections from Firebase when offline/proxy blocked
    if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
            const msg = event.reason ? (event.reason.message || String(event.reason)) : '';
            if (msg.includes('ERR_PROXY_CERTIFICATE_INVALID') ||
                msg.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
                msg.includes('network error') ||
                msg.includes('The operation could not be completed')
            ) {
                // Prevent the red screen of death
                event.preventDefault();
                console.warn("Network error suppressed:", msg);
            }
        });
    }
}

// Global Icon Font Fix for Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.id = 'icon-font-fix';
    style.textContent = `
      @font-face {
        font-family: 'MaterialCommunityIcons';
        src: url('https://unpkg.com/react-native-vector-icons@10.2.0/Fonts/MaterialCommunityIcons.ttf') format('truetype');
      }
      @font-face {
        font-family: 'material-community';
        src: url('https://unpkg.com/react-native-vector-icons@10.2.0/Fonts/MaterialCommunityIcons.ttf') format('truetype');
      }
    `;
    document.head.appendChild(style);
    console.log('Static Icon font fix injected');
}

const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#3F51B5', // Indigo 500
        secondary: '#2196F3', // Blue 500
        tertiary: '#FFC107', // Amber 500
    },
};

const AuthWrapper = () => {
    const { user, userData, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inProtectedGroup = segments[0] === '(owner)' || segments[0] === '(organizer)';

        if (!user && inProtectedGroup) {
            // Redirect to login if accessing protected routes without user
            router.replace('/(auth)/login');
        } else if (user && inAuthGroup) {
            // Redirect to dashboard if logged in and trying to access auth screens
            if (userData) {
                if (userData.role === 'owner') router.replace('/(owner)');
                else if (userData.role === 'organizer') router.replace('/(organizer)');
                else router.replace('/(player)');
            }
        }
    }, [user, userData, loading, segments]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }} />
    );
};

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        ...MaterialCommunityIcons.font,
    });

    if (!fontsLoaded && Platform.OS !== 'web') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <PaperProvider theme={theme}>
                <ErrorBoundary>
                    <AuthProvider>
                        <AuthWrapper />
                    </AuthProvider>
                </ErrorBoundary>
            </PaperProvider>
        </SafeAreaProvider>
    );
}
