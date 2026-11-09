import { tokens } from '../theme/tokens';
import React, { useState, useMemo } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import {
  View, Text, ScrollView,
  Linking, StyleSheet, TextInput,
} from 'react-native';
import { MessageCircle, Phone, Search, ChevronDown, ChevronUp, ExternalLink, Headphones } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, withTiming, useSharedValue, runOnJS } from 'react-native-reanimated';
import { haptics } from '../utils/haptics';

const FAQS = [
  {
    category: 'Orders',
    items: [
      {
        q: 'Where is my order?',
        a: 'Track your order in real-time from the Order History screen. Tap any active order to see live status — Confirmed → Preparing → On the Way → Delivered. You can also see your rider\'s location on the map.',
      },
      {
        q: 'How do I cancel my order?',
        a: 'Orders can be cancelled only before they enter the "Preparing" state. Go to Order History → tap your order → tap "Cancel Order". Once the kitchen starts preparing, we cannot cancel.',
      },
      {
        q: 'What if I receive the wrong item?',
        a: 'We\'re sorry! Go to Order History → tap the delivered order → tap "Report Issue". You can select "Wrong item" and we\'ll process a refund or replacement within 2 hours.',
      },
      {
        q: 'Can I change my delivery address after placing an order?',
        a: 'Address changes are not possible once an order is confirmed. Please make sure your delivery address is correct at checkout. For future orders, you can save multiple addresses in your profile.',
      },
    ],
  },
  {
    category: 'Payments & Refunds',
    items: [
      {
        q: 'How do refunds work?',
        a: 'Refunds for cancelled or disputed orders are processed within 2 hours to your Eigen Wallet. Wallet balance can be used for your next order. Bank refunds (for online payments) take 5-7 business days.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept UPI, credit/debit cards, net banking, and Eigen Wallet. Cash on Delivery is available in select areas. You can also save cards securely for faster checkout.',
      },
      {
        q: 'My payment failed but money was deducted — what now?',
        a: 'If money was deducted but the order wasn\'t placed, it will automatically refund within 5-7 business days. Contact support with your UPI/bank transaction reference if it doesn\'t reflect.',
      },
    ],
  },
  {
    category: 'Wallet & Loyalty',
    items: [
      {
        q: 'How does the Eigen Wallet work?',
        a: 'Add money to your wallet for faster checkout. Wallet is also credited when orders are cancelled or as cashback. Go to Wallet screen to recharge or view transaction history.',
      },
      {
        q: 'How do I earn loyalty points?',
        a: 'You earn 1 point per ₹10 spent. Reach Silver (1000 pts), Gold (2000 pts), or Platinum (5000 pts) tiers for exclusive perks like free delivery and priority support.',
      },
      {
        q: 'Do loyalty points expire?',
        a: 'Points are valid for 6 months from the date of earning. Points earned through referrals are valid for 3 months. Tier status is maintained for 90 days after reaching it.',
      },
    ],
  },
  {
    category: 'Account & App',
    items: [
      {
        q: 'How do I change my phone number?',
        a: 'Phone number changes require verification. Go to Profile → Edit Profile → tap your phone number. You\'ll receive an OTP on both old and new numbers for security.',
      },
      {
        q: 'Why is the menu not loading?',
        a: 'The menu only loads if we deliver to your location. Tap "Delivery Address" on the home screen and set or confirm your address. If your area shows "Out of zone", we\'re expanding soon!',
      },
      {
        q: 'The app is slow or crashing — what to do?',
        a: 'Try force-closing and reopening the app. If the issue persists, clear app cache from your phone settings. Still not working? Raise a support ticket and our team will help.',
      },
    ],
  },
];

const CATEGORIES_LIST = FAQS.map(s => s.category);

// ── Single FAQ Item (accordion) ──────────────────────────────────────────────
const FaqItem = React.memo(({ item, idx }: { item: { q: string; a: string }; idx: number }) => {
  const [open, setOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.delay(idx * 30).duration(200)} style={styles.faqItem}>
      <PressableScale
        style={styles.faqQuestion}
        onPress={() => { haptics.selection(); setOpen(v => !v); }}
      >
        <Text style={styles.faqQuestionText}>{item.q}</Text>
        {open
          ? <ChevronUp size={16} color={tokens.colors.primary} />
          : <ChevronDown size={16} color={tokens.colors.textSecondary} />
        }
      </PressableScale>
      {open && (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.a}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
});

// ── Screen ────────────────────────────────────────────────────────────────────
const HelpScreen = ({ navigation }: any) => {
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

  return (
    <View style={styles.root}>
      <ScreenHeader title="Help Center" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Search size={16} color={tokens.colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search FAQs…"
              placeholderTextColor={tokens.colors.textTertiary}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Category pills */}
        {!query && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
            <PressableScale
              style={[styles.pill, !activeCategory && styles.pillActive]}
              onPress={() => { haptics.selection(); setActiveCategory(null); }}
            >
              <Text style={[styles.pillText, !activeCategory && styles.pillTextActive]}>All</Text>
            </PressableScale>
            {CATEGORIES_LIST.map(cat => (
              <PressableScale
                key={cat}
                style={[styles.pill, activeCategory === cat && styles.pillActive]}
                onPress={() => { haptics.selection(); setActiveCategory(activeCategory === cat ? null : cat); }}
              >
                <Text style={[styles.pillText, activeCategory === cat && styles.pillTextActive]}>{cat}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}

        {/* FAQ sections */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {filtered.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No results for "{query}"</Text>
              <Text style={styles.noResultsSub}>Try different keywords or raise a support ticket.</Text>
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
            <Headphones size={18} color={tokens.colors.textPrimary} />
            <Text style={styles.contactTitle}>Still need help?</Text>
          </View>
          <Text style={styles.contactSub}>Our support team is available 9 AM – 11 PM daily.</Text>

          <PressableScale
            style={styles.contactBtn}
            onPress={() => navigation.navigate('Support')}
          >
            <MessageCircle size={18} color={tokens.colors.textInverse} />
            <View>
              <Text style={styles.contactBtnTitle}>Raise a Support Ticket</Text>
              <Text style={styles.contactBtnSub}>We reply within 24 hours</Text>
            </View>
            <ExternalLink size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 'auto' }} />
          </PressableScale>

          <PressableScale
            style={[styles.contactBtn, styles.whatsappBtn]}
            onPress={() => Linking.openURL('https://wa.me/918800000000')}
          >
            <MessageCircle size={18} color={tokens.colors.textInverse} />
            <View>
              <Text style={styles.contactBtnTitle}>Chat on WhatsApp</Text>
              <Text style={styles.contactBtnSub}>Fastest — avg 2 min response</Text>
            </View>
          </PressableScale>

          <PressableScale
            style={[styles.contactBtn, styles.callBtn]}
            onPress={() => Linking.openURL('tel:918800000000')}
          >
            <Phone size={18} color={tokens.colors.textInverse} />
            <View>
              <Text style={styles.contactBtnTitle}>Call Support</Text>
              <Text style={styles.contactBtnSub}>9 AM – 11 PM, all days</Text>
            </View>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  );
};

export default HelpScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },


  searchWrap: { padding: 16, backgroundColor: tokens.colors.surface, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: tokens.colors.background, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: tokens.colors.border,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary,
  },

  pillsRow: { paddingHorizontal: 16, paddingVertical: 12 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border,
  },
  pillActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  pillText: { fontSize: 13, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary },
  pillTextActive: { color: tokens.colors.textInverse },

  sectionLabel: {
    fontSize: 11, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textSecondary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },

  faqItem: {
    backgroundColor: tokens.colors.surface, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: tokens.colors.border, overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, gap: 8,
  },
  faqQuestionText: {
    flex: 1, fontSize: 14, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary, lineHeight: 20,
  },
  faqAnswer: {
    paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: tokens.colors.border,
  },
  faqAnswerText: {
    fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary,
    lineHeight: 20, paddingTop: 12,
  },

  noResults: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  noResultsText: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 6 },
  noResultsSub: { fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, textAlign: 'center' },

  // Contact
  contactSection: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 16,
    backgroundColor: tokens.colors.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: tokens.colors.border,
  },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  contactTitle: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  contactSub: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, marginBottom: 16 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: tokens.colors.primary, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  whatsappBtn: { backgroundColor: '#25D366' },
  callBtn: { backgroundColor: tokens.colors.textPrimary, marginBottom: 0 },
  contactBtnTitle: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.textInverse },
  contactBtnSub: { fontSize: 11, fontFamily: tokens.typography.family.regular, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
});
