import { tokens } from '../theme/tokens';
import React, { useState, useMemo } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, Linking,
  StyleSheet, StatusBar, TextInput,
} from 'react-native';
import {
  ArrowLeft, MessageCircle, Phone, Search,
  ChevronDown, ChevronUp, Headphones, TicketCheck,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: tokens.colors.surface,
};

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

const FAQS = [
  {
    category: 'Earnings & Payouts',
    items: [
      {
        q: 'How are my earnings calculated?',
        a: 'You earn a base pay per delivery plus a distance bonus (₹5 per km beyond 2 km). Tips from customers are added on top. A 10% platform fee is deducted. Your net earnings are credited to your daily earnings dashboard in real time after every delivery.',
      },
      {
        q: 'When do I get paid?',
        a: 'Earnings are transferred automatically every night at 11:45 PM to your registered UPI ID. Make sure your UPI is set up in the Payouts screen. You can also request a manual payout anytime if your pending balance is ₹100 or more.',
      },
      {
        q: 'How do I add or update my UPI ID?',
        a: 'Go to Profile → Payouts → tap the UPI section. Enter your UPI ID (e.g. yourname@okaxis) and tap Save. Once saved, auto-pay will activate and you\'ll receive earnings every night without any manual action.',
      },
      {
        q: 'Why hasn\'t my payout arrived yet?',
        a: 'Auto-pay runs at 11:45 PM daily. Bank transfers can take up to 2 hours to reflect depending on your bank. If it\'s been more than 4 hours, contact support with your UPI ID and we\'ll investigate.',
      },
      {
        q: 'What are tips and where can I see them?',
        a: 'Customers can optionally add a tip at checkout. Tips are credited directly to your earnings for that order. You can see tip amounts in your Order History screen — any order with a tip shows it with an amber badge.',
      },
    ],
  },
  {
    category: 'Deliveries',
    items: [
      {
        q: 'What do I do if the customer is unreachable?',
        a: 'Tap "Customer Unreachable" on the delivery screen. You\'ll have 3 options: Retry calling, Leave at Door (with a photo), or Return the order to the kitchen. Always try calling at least twice before choosing Leave at Door.',
      },
      {
        q: 'How do I report an issue with an order?',
        a: 'Tap "Report Issue" on the active order screen. You can select from common issues — Missing Items, Wrong Order, Damaged Package, Customer Refused, or Other. Add a note if needed. Our team reviews all reports within 1 hour.',
      },
      {
        q: 'What if the restaurant/kitchen doesn\'t have the order ready?',
        a: 'Wait at the kitchen for up to 10 minutes. If the order is still not ready, use Report Issue → "Order Not Ready at Kitchen". Do not leave without the order — it affects your completion rate.',
      },
      {
        q: 'What is COD and how do I handle it?',
        a: 'Cash on Delivery (COD) means the customer pays in cash or UPI at the door. Show them the QR code for UPI payment or collect cash. Once payment is done, tap the confirm button. You\'ll need to submit COD cash to the finance desk at the kitchen.',
      },
      {
        q: 'How does the delivery OTP work?',
        a: 'The customer receives a 4-digit OTP when the order is out for delivery. Ask the customer for their OTP and enter it in the app to confirm delivery. This protects both you and the customer. You can also take a POD (Proof of Delivery) photo.',
      },
    ],
  },
  {
    category: 'Documents & Account',
    items: [
      {
        q: 'How long does document verification take?',
        a: 'Our team verifies documents within 24-48 hours of submission. You\'ll receive a notification once approved or if anything needs to be re-uploaded. You can check status anytime in Profile → Documents.',
      },
      {
        q: 'My documents were rejected — what now?',
        a: 'Go to Profile → Documents to see the rejection reason. Common reasons: blurry photo, expired license, wrong document uploaded. Re-upload a clear photo of the correct document and resubmit.',
      },
      {
        q: 'Can I change my registered vehicle?',
        a: 'Yes. Go to Profile → Documents and update your vehicle type and license number, then upload the new documents. Your account may be temporarily suspended during re-verification.',
      },
      {
        q: 'Why has my account been suspended?',
        a: 'Accounts are suspended for policy violations, document issues, or customer complaints. You would have received a notification with the reason. Contact support to appeal or resolve the issue.',
      },
    ],
  },
  {
    category: 'App & Navigation',
    items: [
      {
        q: 'I\'m not receiving any orders — what\'s wrong?',
        a: 'Make sure you\'re set to Online (green toggle on the home screen). Check that your location permissions are set to "Always" in phone settings. Orders are assigned based on your proximity to kitchens — try moving to a busier area.',
      },
      {
        q: 'The map or navigation isn\'t working',
        a: 'The app uses Google Maps for navigation. Make sure Google Maps is installed and location permissions are granted for both Google Maps and this app. Tap the blue map button on the order screen to open navigation.',
      },
      {
        q: 'App is crashing or running slowly',
        a: 'Force-close and reopen the app. If it continues, clear the app cache from your phone settings. Make sure you\'re on the latest app version. If the problem persists, raise a support ticket.',
      },
      {
        q: 'How do I go offline / take a break?',
        a: 'Tap the Online/Offline toggle on the home screen to go offline. You won\'t receive new order assignments while offline. Any order already accepted must be completed before going offline.',
      },
    ],
  },
];

const FaqItem = ({ item, idx }: { item: { q: string; a: string }; idx: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <Animated.View entering={FadeInDown.delay(idx * 30).duration(200)} style={styles.faqItem}>
      <BouncingButton
        style={styles.faqQuestion}
        onPress={() => { haptic(); setOpen(v => !v); }}
        activeOpacity={0.8}
      >
        <Text style={styles.faqQuestionText}>{item.q}</Text>
        {open
          ? <ChevronUp size={16} color={R.orange} />
          : <ChevronDown size={16} color={R.muted} />
        }
      </BouncingButton>
      {open && (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.a}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const RiderHelpScreen = ({ navigation }: any) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return FAQS.map(section => ({
      ...section,
      items: section.items.filter(item =>
        !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
      ),
    })).filter(s => s.items.length > 0 && (!activeCategory || s.category === activeCategory));
  }, [query, activeCategory]);

  const categories = FAQS.map(s => s.category);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <BouncingButton style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </BouncingButton>
          <Text style={styles.headerTitle}>Help Center</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Search */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Search size={16} color={R.muted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search help topics…"
                placeholderTextColor={R.muted}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Category pills */}
          {!query && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <BouncingButton
                style={[styles.pill, !activeCategory && styles.pillActive]}
                onPress={() => { haptic(); setActiveCategory(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, !activeCategory && styles.pillTextActive]}>All</Text>
              </BouncingButton>
              {categories.map(cat => (
                <BouncingButton
                  key={cat}
                  style={[styles.pill, activeCategory === cat && styles.pillActive]}
                  onPress={() => { haptic(); setActiveCategory(activeCategory === cat ? null : cat); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, activeCategory === cat && styles.pillTextActive]}>{cat}</Text>
                </BouncingButton>
              ))}
            </ScrollView>
          )}

          {/* FAQ sections */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {filtered.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No results for "{query}"</Text>
                <Text style={styles.noResultsSub}>Try different keywords or contact support below.</Text>
              </View>
            ) : (
              filtered.map((section, si) => (
                <View key={section.category} style={{ marginBottom: 24 }}>
                  <Text style={styles.sectionLabel}>{section.category}</Text>
                  {section.items.map((item, ii) => (
                    <FaqItem key={item.q} item={item} idx={si * 5 + ii} />
                  ))}
                </View>
              ))
            )}
          </View>

          {/* Contact section */}
          <View style={styles.contactSection}>
            <View style={styles.contactHeader}>
              <Headphones size={18} color={R.ink} />
              <Text style={styles.contactTitle}>Still need help?</Text>
            </View>
            <Text style={styles.contactSub}>Our rider support team is available 7 AM – 11 PM daily.</Text>

            <BouncingButton
              style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
              onPress={() => Linking.openURL('https://wa.me/919999999999?text=Hi%2C%20I%20am%20a%20VELTO%20rider%20and%20need%20help.')}
              activeOpacity={0.85}
            >
              <MessageCircle size={18} color={R.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contactBtnTitle}>Chat on WhatsApp</Text>
                <Text style={styles.contactBtnSub}>Fastest — avg 2 min response</Text>
              </View>
            </BouncingButton>

            <BouncingButton
              style={[styles.contactBtn, { backgroundColor: R.orange }]}
              onPress={() => Linking.openURL('tel:919999999999')}
              activeOpacity={0.85}
            >
              <Phone size={18} color={R.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contactBtnTitle}>Call Rider Support</Text>
                <Text style={styles.contactBtnSub}>7 AM – 11 PM, all days</Text>
              </View>
            </BouncingButton>

            <BouncingButton
              style={[styles.contactBtn, { backgroundColor: R.ink }]}
              onPress={() => navigation.navigate('RiderSupport')}
              activeOpacity={0.85}
            >
              <TicketCheck size={18} color={R.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contactBtnTitle}>Raise a Support Ticket</Text>
                <Text style={styles.contactBtnSub}>Track your issue with written evidence</Text>
              </View>
            </BouncingButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default RiderHelpScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: R.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: R.ink },

  searchWrap: { padding: 16, backgroundColor: R.white, borderBottomWidth: 1, borderBottomColor: R.border },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.bg, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: R.border,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: R.ink },

  pillsRow: { paddingVertical: 12 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: R.white, borderWidth: 1, borderColor: R.border,
  },
  pillActive: { backgroundColor: R.orange, borderColor: R.orange },
  pillText: { fontSize: 13, fontWeight: '600', color: R.gray },
  pillTextActive: { color: R.white },

  sectionLabel: {
    fontSize: 10, fontWeight: '900', color: R.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },

  faqItem: {
    backgroundColor: R.white, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: R.border, overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, gap: 8,
  },
  faqQuestionText: { flex: 1, fontSize: 14, fontWeight: '600', color: R.ink, lineHeight: 20 },
  faqAnswer: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: R.border,
  },
  faqAnswerText: { fontSize: 13, fontWeight: '400', color: R.gray, lineHeight: 20, paddingTop: 12 },

  noResults: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  noResultsText: { fontSize: 16, fontWeight: '700', color: R.ink, marginBottom: 6 },
  noResultsSub: { fontSize: 13, color: R.muted, textAlign: 'center' },

  contactSection: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 16,
    backgroundColor: R.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: R.border,
  },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  contactTitle: { fontSize: 16, fontWeight: '800', color: R.ink },
  contactSub: { fontSize: 12, color: R.muted, marginBottom: 16 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  contactBtnTitle: { fontSize: 14, fontWeight: '700', color: R.white },
  contactBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
});
