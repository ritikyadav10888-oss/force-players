import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Title, Paragraph, Surface, Button, Text, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function TermsPolicy() {
    const router = useRouter();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Surface style={styles.card} elevation={2}>
                <Title style={styles.title}>TERMS AND CONDITIONS</Title>
                <Paragraph style={styles.lastUpdated}>Last Updated: January 15, 2026</Paragraph>

                <Divider style={styles.divider} />

                <Title style={styles.subTitle}>1. ACCEPTANCE OF TERMS</Title>
                <Paragraph style={styles.paragraph}>
                    These Terms and Conditions constitute a legally binding agreement made between you, whether personally or on behalf of an entity (“you”) and Force Player Field Pvt. Ltd. (“Company,” “we,” “us,” or “our”), concerning your access to and use of the force-player-register-ap website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto.
                </Paragraph>
                <Paragraph style={styles.paragraph}>
                    By accessing the site, you acknowledge that you have read, understood, and agreed to be bound by all of these Terms and Conditions.
                </Paragraph>

                <Title style={styles.subTitle}>2. USER ELIGIBILITY</Title>
                <Paragraph style={styles.paragraph}>
                    The services provided by Force Player Field Pvt. Ltd. are intended for users who are at least 13 years of age. Users under the age of 18 (minors) must have the express permission of, and be directly supervised by, their parent or guardian to use the application and register for sports tournaments. If you are a minor, your parent or guardian must read and agree to these Terms prior to your account creation.
                </Paragraph>

                <Title style={styles.subTitle}>3. USER REGISTRATION & SECURITY</Title>
                <Paragraph style={styles.paragraph}>
                    You may be required to register an account to access our registration services. You agree to:
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• Keep your password confidential and secure.</Text>
                    <Text style={styles.listItem}>• Be held responsible for all use of your account and password.</Text>
                    <Text style={styles.listItem}>• Provide accurate, current, and complete registration information. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate or objectionable.</Text>
                </View>

                <Title style={styles.subTitle}>4. INTELLECTUAL PROPERTY RIGHTS</Title>
                <Paragraph style={styles.paragraph}>
                    The "Force Player" name, logos, and the underlying software code, database, and website designs (collectively, the “Content”) are the exclusive property of Force Player Field Pvt. Ltd. and are protected by copyright, trademark, and other intellectual property laws of India. No part of the application or content may be copied, reproduced, or distributed for commercial purposes without our express prior written permission.
                </Paragraph>

                <Title style={styles.subTitle}>5. PROHIBITED ACTIVITIES</Title>
                <Paragraph style={styles.paragraph}>
                    You may not access or use the application for any purpose other than that for which we make the platform available. Prohibited activities include:
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• Using the app for any illegal or unauthorized purpose.</Text>
                    <Text style={styles.listItem}>• Attempting to trick, defraud, or mislead us or other users.</Text>
                    <Text style={styles.listItem}>• Uploading or transmitting viruses, Trojan horses, or malicious code.</Text>
                    <Text style={styles.listItem}>• Circumventing or interfering with security-related features of the application.</Text>
                </View>

                <Title style={styles.subTitle}>6. DISPUTE RESOLUTION</Title>
                <Paragraph style={styles.paragraph}>
                    To expedite resolution and control the cost of any dispute, any legal action of whatever nature brought by either you or us shall be commenced or prosecuted exclusively in the courts located in Mumbai, Maharashtra. You hereby consent to and waive all defenses of lack of personal jurisdiction and forum non-conveniens with respect to venue and jurisdiction in such courts.
                </Paragraph>

                <Title style={styles.subTitle}>7. CONTACT INFORMATION</Title>
                <Paragraph style={styles.paragraph}>
                    For any questions or concerns regarding these Terms, please contact:
                </Paragraph>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactText}>Force Player Field Pvt. Ltd.</Text>
                    <Text style={styles.contactText}>Email: forceplayerfield@gmail.com</Text>
                    <Text style={styles.contactText}>Address: Mumbai, Maharashtra.</Text>
                </View>

                <Button mode="contained" onPress={() => router.back()} style={styles.button}>
                    Go Back
                </Button>
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    content: { padding: 20, maxWidth: 800, alignSelf: 'center', width: '100%' },
    card: { padding: 24, borderRadius: 12, backgroundColor: 'white' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4, color: '#1a237e', textAlign: 'center' },
    lastUpdated: { fontSize: 13, color: '#666', marginBottom: 15, textAlign: 'center' },
    divider: { marginBottom: 20 },
    subTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#1a237e' },
    paragraph: { marginBottom: 12, lineHeight: 22, color: '#444', textAlign: 'justify' },
    list: { marginLeft: 10, marginBottom: 15 },
    listItem: { fontSize: 14, color: '#444', marginBottom: 8, lineHeight: 20 },
    contactInfo: { marginTop: 10, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#1a237e' },
    contactText: { fontSize: 14, color: '#333', marginBottom: 5, fontWeight: '500' },
    button: { marginTop: 30, borderRadius: 8, height: 48, justifyContent: 'center' }
});
