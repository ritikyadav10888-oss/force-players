import React from 'react';
import { ScrollView, StyleSheet, View, Linking, TouchableOpacity, Platform } from 'react-native';
import { Title, Paragraph, Surface, Button, Text, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ContactUs() {
    const router = useRouter();

    const handleCall = () => {
        Linking.openURL('tel:+919152000902');
    };

    const handleEmail = (email) => {
        Linking.openURL(`mailto:${email}`);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Surface style={styles.card} elevation={2}>
                <Title style={styles.title}>CONTACT US</Title>
                <Paragraph style={styles.intro}>
                    At Force Player Field Pvt. Ltd., we are dedicated to providing a high-quality registration platform for athletes and sports organizers. Whether you have a query about a tournament, a technical issue with the app, or a payment concern, our team is here to help.
                </Paragraph>

                <Divider style={styles.divider} />

                <Title style={styles.subTitle}>1. Corporate & Registered Office</Title>
                <Paragraph style={styles.paragraph}>
                    This is our primary place of business for all legal and official correspondence:
                </Paragraph>
                <View style={styles.infoBox}>
                    <Text style={styles.boldText}>Legal Entity Name:</Text>
                    <Text style={styles.infoText}>Force Player Field Pvt. Ltd.</Text>
                    <Text style={[styles.boldText, { marginTop: 8 }]}>Registered Address:</Text>
                    <Text style={styles.infoText}>Mumbai, Maharashtra</Text>
                </View>

                <Title style={styles.subTitle}>2. Customer Support Channels</Title>
                <Paragraph style={styles.paragraph}>
                    For immediate assistance regarding player registration or app features:
                </Paragraph>
                <TouchableOpacity onPress={handleCall} style={styles.contactRow}>
                    <MaterialCommunityIcons name="phone" size={20} color="#1565C0" style={{ marginRight: 10 }} />
                    <View>
                        <Text style={styles.contactLabel}>Support Helpline</Text>
                        <Text style={styles.contactValue}>+91 91520 00902</Text>
                        <Text style={styles.subLabel}>(10:00 AM – 6:00 PM, Mon to Sat)</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleEmail('forceplayerfield@gmail.com')} style={styles.contactRow}>
                    <MaterialCommunityIcons name="email" size={20} color="#1565C0" style={{ marginRight: 10 }} />
                    <View>
                        <Text style={styles.contactLabel}>General Inquiry & Tech Support</Text>
                        <Text style={styles.contactValue}>forceplayerfield@gmail.com</Text>
                    </View>
                </TouchableOpacity>

                <Title style={styles.subTitle}>3. Payment & Refund Assistance</Title>
                <Paragraph style={styles.paragraph}>
                    If you have experienced a transaction failure or need to discuss a refund:
                </Paragraph>
                <View style={styles.highlightBox}>
                    <Text style={styles.contactLabel}>Dedicated Email</Text>
                    <Text style={[styles.contactValue, { color: '#C62828' }]}>forceplayerfield@gmail.com</Text>
                    <Text style={[styles.subLabel, { marginTop: 8, fontStyle: 'italic' }]}>
                        Info Required: Transaction ID, Registered Mobile Number, and Date of Payment.
                    </Text>
                </View>

                <Title style={styles.subTitle}>4. Grievance Redressal</Title>
                <Paragraph style={styles.paragraph}>
                    As per the Information Technology Act, 2000, we have appointed a Grievance Officer:
                </Paragraph>
                <View style={styles.infoBox}>
                    <Text style={styles.boldText}>Grievance Officer:</Text>
                    <Text style={styles.infoText}>Support Manager</Text>
                    <Text style={[styles.boldText, { marginTop: 8 }]}>Contact Email:</Text>
                    <Text style={styles.infoText}>forceplayerfield@gmail.com</Text>
                    <Text style={[styles.boldText, { marginTop: 8 }]}>Address:</Text>
                    <Text style={styles.infoText}>Same as Corporate Office above.</Text>
                </View>

                <Title style={styles.subTitle}>5. Social Media & Community</Title>
                <View style={styles.socialGrid}>
                    <TouchableOpacity
                        style={styles.socialItem}
                        onPress={() => Linking.openURL('https://www.instagram.com/forceplayingfields/')}
                    >
                        <MaterialCommunityIcons name="instagram" size={28} color="#E1306C" />
                        <Text style={styles.socialText}>Instagram</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.socialItem}
                        onPress={() => Linking.openURL('https://www.facebook.com/p/Force-Playing-Fields-61574728127977/')}
                    >
                        <MaterialCommunityIcons name="facebook" size={28} color="#1877F2" />
                        <Text style={styles.socialText}>Facebook</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.socialItem}
                        onPress={() => Linking.openURL('https://www.linkedin.com/company/force-playing-field?trk=public_profile_topcard-current-company')}
                    >
                        <MaterialCommunityIcons name="linkedin" size={28} color="#0A66C2" />
                        <Text style={styles.socialText}>LinkedIn</Text>
                    </TouchableOpacity>
                </View>

                <Title style={styles.subTitle}>6. Estimated Response Times</Title>
                <View style={styles.timelineBox}>
                    <View style={styles.timelineItem}>
                        <View style={styles.dot} />
                        <Text style={styles.timelineText}><Text style={styles.boldText}>Email Queries:</Text> Within 24–48 Business Hours.</Text>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={styles.dot} />
                        <Text style={styles.timelineText}><Text style={styles.boldText}>Payment Investigations:</Text> Within 5–6 Business Days.</Text>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={styles.dot} />
                        <Text style={styles.timelineText}><Text style={styles.boldText}>Refund Settlements:</Text> 8–9 Working Days (after approval).</Text>
                    </View>
                </View>

                <Button
                    mode="contained"
                    onPress={() => router.back()}
                    style={styles.backButton}
                    contentStyle={{ height: 48 }}
                >
                    Go Back
                </Button>
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    content: { padding: 20, maxWidth: 800, alignSelf: 'center', width: '100%' },
    card: { padding: 24, borderRadius: 16, backgroundColor: 'white' },
    title: { fontSize: 26, fontWeight: '900', color: '#1a237e', textAlign: 'center', marginBottom: 12 },
    intro: { fontSize: 14, lineHeight: 22, color: '#555', textAlign: 'center', marginBottom: 20 },
    divider: { marginBottom: 20 },
    subTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12, color: '#1a237e' },
    paragraph: { marginBottom: 10, fontSize: 14, color: '#666' },
    infoBox: { backgroundColor: '#F5F7FA', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#1a237e' },
    boldText: { fontWeight: 'bold', color: '#333', fontSize: 13 },
    infoText: { fontSize: 14, color: '#444', marginTop: 2 },
    contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginBottom: 12 },
    contactLabel: { fontSize: 12, color: '#1565C0', fontWeight: 'bold', textTransform: 'uppercase' },
    contactValue: { fontSize: 15, color: '#0D47A1', fontWeight: 'bold', marginTop: 2 },
    subLabel: { fontSize: 11, color: '#666', marginTop: 2 },
    highlightBox: { backgroundColor: '#FFEBEE', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#C62828' },
    socialGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
    socialItem: { alignItems: 'center' },
    socialText: { fontSize: 11, color: '#666', marginTop: 4, fontWeight: '600' },
    timelineBox: { backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12 },
    timelineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1a237e', marginRight: 10 },
    timelineText: { fontSize: 13, color: '#444' },
    backButton: { marginTop: 40, borderRadius: 12 }
});
