import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Title, Paragraph, Surface, Button, Text, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function RefundPolicy() {
    const router = useRouter();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Surface style={styles.card} elevation={2}>
                <Title style={styles.title}>REFUND AND CANCELLATION POLICY</Title>
                <Paragraph style={styles.lastUpdated}>Last Updated: January 15, 2026</Paragraph>

                <Divider style={styles.divider} />

                <Paragraph style={styles.paragraph}>
                    At Force Player Field Pvt. Ltd., we strive to provide a seamless registration experience for all players and teams. We understand that circumstances change, and we have established the following policy to handle cancellations and refund requests fairly.
                </Paragraph>

                <Title style={styles.subTitle}>1. REFUND POLICY</Title>
                <Paragraph style={styles.paragraph}>
                    Refunds are granted based on the following specific criteria:
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Player Cancellation:</Text> If a player wishes to cancel their registration, they will receive a 95% refund of the registration fee. A 5% processing fee will be deducted to cover transaction and administrative costs. Refund requests must be made at least 24 hours before the event start time.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Event Cancellation:</Text> In the event that a tournament or sports event is canceled by the Organizer or Force Player Field Pvt. Ltd. due to unforeseen circumstances (e.g., weather, facility issues, or low participation), a 95% refund of the registration fee will be issued to the affected users.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Medical Withdrawal:</Text> If a player is unable to participate due to a physical injury or medical emergency, a 50% refund may be granted. This is subject to the submission of a valid Medical Certificate from a registered medical practitioner. The request must be made before the event commences.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Duplicate Payments:</Text> In case of a technical glitch leading to a duplicate transaction, the additional amount will be refunded in full upon verification of the transaction IDs.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Non-Refundable Scenarios:</Text> Refunds will not be provided for "no-shows," change of mind after the 24-hour cutoff, or disqualification from an event due to violation of tournament rules.</Text>
                </View>

                <Title style={styles.subTitle}>2. REFUND PROCESS & TIMELINE</Title>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Method of Refund:</Text> All approved refunds will be credited back exclusively to the original payment method (e.g., the specific Bank Account, Debit/Credit Card, or UPI ID used during the transaction). We do not offer cash refunds or transfers to third-party accounts.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Verification:</Text> Once a refund request is received, our team will investigate the claim. You will be notified of the approval or rejection of your refund within 7-8 business days.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Timeline:</Text> Once approved, the refund is initiated immediately. However, it typically takes 8 to 9 working days for the amount to reflect in your account, depending on your bank's processing time.</Text>
                </View>

                <Title style={styles.subTitle}>3. MODIFICATIONS TO EVENTS</Title>
                <Paragraph style={styles.paragraph}>
                    Force Player Field Pvt. Ltd. reserves the right to modify event dates or venues. In such cases, players will be given the option to either carry forward their registration to the new date or request a full refund within 48 hours of the announcement.
                </Paragraph>

                <Title style={styles.subTitle}>4. CONTACT FOR REFUNDS</Title>
                <Paragraph style={styles.paragraph}>
                    For all refund-related queries, please include your Transaction ID and Registered Phone Number in your communication:
                </Paragraph>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactText}>Force Player Field Pvt. Ltd.</Text>
                    <Text style={styles.contactText}>Email: forceplayerfield@gmail.com</Text>
                    <Text style={styles.contactText}>Subject Line: Refund Request - [Transaction ID]</Text>
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
    boldText: { fontWeight: 'bold' },
    list: { marginLeft: 10, marginBottom: 15 },
    listItem: { fontSize: 14, color: '#444', marginBottom: 8, lineHeight: 20 },
    contactInfo: { marginTop: 10, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#1a237e' },
    contactText: { fontSize: 14, color: '#333', marginBottom: 5, fontWeight: '500' },
    button: { marginTop: 30, borderRadius: 8, height: 48, justifyContent: 'center' }
});
