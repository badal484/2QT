import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';

const HelpScreen = ({ navigation }: any) => {
  const faqs = [
    { q: 'Where is my order?', a: 'You can track your order in real-time from the active orders section.' },
    { q: 'How to cancel?', a: 'Orders can be cancelled before they enter the "Preparing" state.' },
    { q: 'Refund policy', a: 'Refunds for cancelled orders are instantly credited to your Velto Wallet.' },
    { q: 'Subscription pause', a: 'You can pause your plan anytime from the Subscription screen.' },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft size={24} color="#1A1A2E" />
      </TouchableOpacity>

      <Text style={styles.title}>Help Center</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <Text style={styles.sectionLabel}>Frequently Asked</Text>
        {faqs.map((faq, i) => (
          <View key={i} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{faq.q}</Text>
            <Text style={styles.faqAnswer}>{faq.a}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Contact Us</Text>
        
        <TouchableOpacity 
          onPress={() => Linking.openURL('whatsapp://send?phone=919999999999')}
          style={styles.whatsappBtn}
        >
          <Text style={styles.contactIcon}>💬</Text>
          <View>
            <Text style={styles.contactTitle}>Chat on WhatsApp</Text>
            <Text style={styles.contactSub}>Average response: 2 mins</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => Linking.openURL('tel:919999999999')}
          style={styles.callBtn}
        >
          <Text style={styles.contactIcon}>📞</Text>
          <View>
            <Text style={styles.contactTitle}>Call Support</Text>
            <Text style={styles.contactSub}>Available 8 AM - 11 PM</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 32,
    paddingTop: 64,
  },
  backButton: {
    marginBottom: 24,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 40,
  },
  scrollView: {
    flex: 1,
  },
  sectionLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  faqItem: {
    marginBottom: 32,
  },
  faqQuestion: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 8,
  },
  faqAnswer: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 32,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  callBtn: {
    backgroundColor: '#1A1A2E',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  contactTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  contactSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
});

export default HelpScreen;
