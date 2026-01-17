import React from 'react';
import { StyleSheet } from 'react-native';
import { Banner } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const OfflineBanner = () => {
    const { isOnline } = useNetworkStatus();

    if (isOnline) return null;

    return (
        <Banner
            visible={!isOnline}
            icon={({ size }) => (
                <MaterialCommunityIcons name="wifi-off" size={size} color="#fff" />
            )}
            style={styles.banner}
        >
            You're offline. Some features may be limited.
        </Banner>
    );
};

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#FF9800',
    }
});
