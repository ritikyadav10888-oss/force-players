import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OrganizerLayout() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: '#A0A0A0',
            tabBarStyle: {
                backgroundColor: 'white',
                borderTopWidth: 0,
                elevation: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                height: 65 + insets.bottom,
                paddingBottom: 10 + insets.bottom,
                paddingTop: 10,
            },
            tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '600',
                marginTop: 2
            },
            tabBarHideOnKeyboard: true
        }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'My Profile',
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle" size={24} color={color} />
                }}
            />

            {/* Hidden Routes */}
            <Tabs.Screen
                name="players/[id]"
                options={{
                    href: null,
                    tabBarItemStyle: { display: 'none' }
                }}
            />
        </Tabs>
    );
}
