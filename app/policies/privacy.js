import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Title, Paragraph, Surface, Button, Text, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function PrivacyPolicy() {
    const router = useRouter();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Surface style={styles.card} elevation={2}>
                <Title style={styles.title}>PRIVACY POLICY</Title>
                <Paragraph style={styles.lastUpdated}>Last Updated: January 15, 2026</Paragraph>

                <Divider style={styles.divider} />

                <Paragraph style={styles.paragraph}>
                    This Privacy Policy describes how Force Player Field Pvt. Ltd. (“we”, “us”, or “our”) collects, uses, and discloses your information when you use the force-player-register-ap (the “Service”). We are committed to protecting your personal information and your right to privacy.
                </Paragraph>

                <Title style={styles.subTitle}>1. INFORMATION WE COLLECT</Title>
                <Paragraph style={styles.paragraph}>
                    We collect personal information that you voluntarily provide to us when you register on the Service, express an interest in obtaining information about us or our products, or when you participate in activities on the Service.
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Personal Data:</Text> This includes your Name, Phone Number, Date of Birth, Gender, and Email Address etc.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Sports Profile Data:</Text> To facilitate tournament registration, we collect sports-specific data including player statistics, position, height, weight, and previous team history.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Log Data:</Text> Our servers automatically collect information when you access the app, such as your IP address, browser type, operating system, and access times.</Text>
                </View>

                <Title style={styles.subTitle}>2. HOW WE USE YOUR INFORMATION</Title>
                <Paragraph style={styles.paragraph}>
                    We use the information we collect or receive:
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• To facilitate account creation and logon process.</Text>
                    <Text style={styles.listItem}>• To manage registrations: To process your entry into sports tournaments and events.</Text>
                    <Text style={styles.listItem}>• To send administrative information: To send you product, service, and new feature information and/or information about changes to our terms, conditions, and policies.</Text>
                    <Text style={styles.listItem}>• To fulfill and manage orders: To manage your payments made through the Service.</Text>
                </View>

                <Title style={styles.subTitle}>3. PAYMENT PROCESSING & INFORMATION</Title>
                <Paragraph style={styles.paragraph}>
                    For all financial transactions, we use Razorpay as our third-party payment processor.
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>No Storage:</Text> Force Player Field Pvt. Ltd. does not store or collect your payment card details, bank account numbers, or UPI credentials.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Direct Processing:</Text> That information is provided directly to Razorpay, whose use of your personal information is governed by their Privacy Policy. These payment processors adhere to the standards set by PCI-DSS as managed by the PCI Security Standards Council.</Text>
                </View>

                <Title style={styles.subTitle}>4. DATA SHARING AND DISCLOSURE</Title>
                <Paragraph style={styles.paragraph}>
                    We only share information with your consent or in the following situations:
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Tournament Organizers:</Text> We share necessary player data with relevant Tournament Organizers only for the purpose of event participation, scheduling, and player verification.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Compliance with Laws:</Text> We may disclose your information where we are legally required to do so to comply with applicable law, governmental requests, a judicial proceeding, or court order.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Business Transfers:</Text> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, or acquisition.</Text>
                </View>

                <Title style={styles.subTitle}>5. DATA SECURITY & RETENTION</Title>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Security:</Text> We implement appropriate technical and organizational security measures (such as encryption and firewalls) designed to protect the security of any personal information we process. However, please remember that no method of transmission over the Internet is 99.00% secure.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.boldText}>Retention:</Text> We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy policy, unless a longer retention period is required by law (such as tax or accounting requirements).</Text>
                </View>

                <Title style={styles.subTitle}>6. COOKIES AND TRACKING TECHNOLOGIES</Title>
                <Paragraph style={styles.paragraph}>
                    We may use cookies and similar tracking technologies to access or store information. You can set your browser to refuse all or some browser cookies, but this may cause some parts of the Service to function improperly.
                </Paragraph>

                <Title style={styles.subTitle}>7. YOUR PRIVACY RIGHTS</Title>
                <Paragraph style={styles.paragraph}>
                    Depending on your location, you have the right to:
                </Paragraph>
                <View style={styles.list}>
                    <Text style={styles.listItem}>• Request access to the personal information we collect from you.</Text>
                    <Text style={styles.listItem}>• Request that we delete the personal information we have collected.</Text>
                    <Text style={styles.listItem}>• Request that we correct any inaccurate personal data.</Text>
                </View>
                <Paragraph style={styles.paragraph}>To exercise these rights, please contact us at the email provided below.</Paragraph>

                <Title style={styles.subTitle}>8. CHILDREN'S PRIVACY</Title>
                <Paragraph style={styles.paragraph}>
                    Our Service is not intended for use by children under the age of 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us. If we become aware that we have collected personal data from anyone under the age of 13 without verification of parental consent, we take steps to remove that information from our servers. For users between 13 and 18, parental supervision is required for all financial transactions.
                </Paragraph>

                <Title style={styles.subTitle}>9. PUBLIC DATA & LEADERBOARDS</Title>
                <Paragraph style={styles.paragraph}>
                    As part of our tournament management features, certain data such as your player name, team affiliation, and match statistics will be displayed publicly on tournament leaderboards, fixtures, and result pages. This is a core function of the application used to facilitate competitive sports tracking.
                </Paragraph>

                <Title style={styles.subTitle}>10. CHANGES TO THIS PRIVACY POLICY</Title>
                <Paragraph style={styles.paragraph}>
                    We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top. You are advised to review this Privacy Policy periodically for any changes.
                </Paragraph>

                <Title style={styles.subTitle}>11. CONTACT US</Title>
                <Paragraph style={styles.paragraph}>
                    If you have questions or comments about this policy, you may contact our Grievance Officer at:
                </Paragraph>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactText}>Grievance Officer: Support Manager</Text>
                    <Text style={styles.contactText}>Force Player Field Pvt. Ltd.</Text>
                    <Text style={styles.contactText}>Email: forceplayerfield@gmail.com</Text>
                    <Text style={styles.contactText}>Address: Mumbai, Maharashtra</Text>
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
