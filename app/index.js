import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from 'react-native-paper';

export default function Index() {
    const { user, userData, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const theme = useTheme();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!user) {
            // If not logged in & not currently in auth group, go to login
            // However, we want public access for players? 
            // Actually, players might want to register without login first.
            // For now, let's route "Guest" to Player Flow or Login.
            // If the goal is "Force Player Registration", maybe public landing page?

            // Strict redirection for now:
            // if (!inAuthGroup) router.replace('/(auth)/login'); 
            // But let's allow public access to player routes if we have deep links.

            router.replace('/(auth)/login');
        } else if (userData) {
            // Role-based redirection
            if (userData.role === 'owner') {
                router.replace('/(owner)');
            } else if (userData.role === 'organizer') {
                router.replace('/(organizer)');
            } else {
                router.replace('/(player)'); // Default to player
            }
        }
    }, [user, userData, loading]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
    );
}
