import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OwnerLayout() {
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
                    title: 'Owner',
                    tabBarLabel: 'Owner',
                    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="organizers"
                options={{
                    title: 'Organizers',
                    tabBarLabel: 'Organizer',
                    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-group" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="tournaments"
                options={{
                    title: 'Tournaments',
                    tabBarLabel: 'Tournament',
                    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="trophy" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="players"
                options={{
                    title: 'Players',
                    tabBarLabel: 'Players',
                    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-multiple" size={24} color={color} />
                }}
            />

            {/* Hide "create" screens from the tab bar but keep them in the stack */}
            <Tabs.Screen
                name="create-organizer"
                options={{
                    href: null,
                    tabBarItemStyle: { display: 'none' }
                }}
            />
            <Tabs.Screen
                name="create-tournament"
                options={{
                    href: null,
                    tabBarItemStyle: { display: 'none' }
                }}
            />
            <Tabs.Screen
                name="organizer-details"
                options={{
                    href: null,
                    tabBarItemStyle: { display: 'none' }
                }}
            />
            <Tabs.Screen
                name="tournament-players/[id]"
                options={{
                    href: null,
                    tabBarItemStyle: { display: 'none' }
                }}
            />
        </Tabs>
    );
}
