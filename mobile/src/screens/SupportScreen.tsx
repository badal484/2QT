import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, MessageSquare, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, TicketCheck } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

const CATEGORIES = [
  { key: 'order_issue',    label: 'Order Issue',     icon: '📦' },
  { key: 'payment',        label: 'Payment',          icon: '💳' },
  { key: 'delivery',       label: 'Delivery',         icon: '🚴' },
  { key: 'account',        label: 'My Account',       icon: '👤' },
  { key: 'subscription',   label: 'Subscription',     icon: '📅' },
  { key: 'other',          label: 'Other',            icon: '💬' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  open:        { label: 'Open',        color: '#2563EB', bg: '#EFF6FF', Icon: Clock },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', Icon: MessageSquare },
  resolved:    { label: 'Resolved',    color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: '#6B7280', bg: '#F3F4F6', Icon: CheckCircle2 },
};

const getMeta = (s: string) => STATUS_META[s] ?? STATUS_META['open'];

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Ticket card with expandable replies ──────────────────────────────────────
const TicketCard = ({ ticket, idx }: { ticket: any; idx: number }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = getMeta(ticket.status);
  const { Icon } = meta;

  return (
    <Animated.View entering={FadeInDown.delay(idx * 50).duration(220)} style={styles.ticketCard}>
      <TouchableOpacity onPress={() => { haptic(); setExpanded(e => !e); }} activeOpacity={0.85}>
        <View style={styles.ticketHeader}>
          <View style={styles.ticketLeft}>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Icon size={11} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.ticketCategory}>
              {CATEGORIES.find(c => c.key === ticket.category)?.label ?? ticket.category ?? 'General'}
            </Text>
          </View>
          <View style={styles.ticketRight}>
            <Text style={styles.ticketDate}>{relativeTime(ticket.created_at)}</Text>
            {expanded ? <ChevronUp size={16} color={colors.inkMuted} /> : <ChevronDown size={16} color={colors.inkMuted} />}
          </View>
        </View>

        <Text style={styles.ticketSubject}>{ticket.subject}</Text>
        <Text style={styles.ticketPreview} numberOfLines={expanded ? 0 : 2}>{ticket.message}</Text>
      </TouchableOpacity>

      {expanded && ticket.admin_reply && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.replyBox}>
          <View style={styles.replyHeader}>
            <View style={styles.replyDot} />
            <Text style={styles.replyLabel}>Support Reply</Text>
          </View>
          <Text style={styles.replyText}>{ticket.admin_reply}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

// ── New Ticket form ──────────────────────────────────────────────────────────
const NewTicketTab = ({ onSuccess }: { onSuccess: () => void }) => {
  const [category, setCategory] = useState('order_issue');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/support/tickets', data),
    onSuccess: () => {
      Alert.alert(
        'Ticket Raised ✓',
        "We've received your message and will respond within 24 hours.",
        [{ text: 'View My Tickets', onPress: onSuccess }],
      );
      setSubject('');
      setMessage('');
      setCategory('order_issue');
    },
    onError: () => Alert.alert('Error', 'Could not submit ticket. Please try again.'),
  });

  const canSubmit = subject.trim().length > 3 && message.trim().length > 10;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Category */}
      <Text style={styles.fieldLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catChip, category === cat.key && styles.catChipActive]}
            onPress={() => { haptic(); setCategory(cat.key); }}
            activeOpacity={0.8}
          >
            <Text style={styles.catEmoji}>{cat.icon}</Text>
            <Text style={[styles.catLabel, category === cat.key && styles.catLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Subject */}
      <Text style={styles.fieldLabel}>Subject <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="Brief description of the issue"
        placeholderTextColor={colors.inkFaint}
        maxLength={100}
        returnKeyType="next"
      />
      <Text style={styles.charCount}>{subject.length}/100</Text>

      {/* Description */}
      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
        Description <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={message}
        onChangeText={setMessage}
        placeholder="Describe your issue in detail — order ID, what happened, what you expect…"
        placeholderTextColor={colors.inkFaint}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        maxLength={1000}
      />
      <Text style={styles.charCount}>{message.length}/1000</Text>

      {/* Tip box */}
      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Including your Order ID speeds up the resolution. Find it in Order History.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={() => {
          if (!canSubmit) return;
          haptic();
          mutation.mutate({ category, subject: subject.trim(), message: message.trim() });
        }}
        disabled={!canSubmit || mutation.isPending}
        activeOpacity={0.9}
      >
        {mutation.isPending
          ? <ActivityIndicator color={colors.white} size="small" />
          : <Text style={styles.submitBtnText}>Submit Ticket</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
};

// ── My Tickets tab ────────────────────────────────────────────────────────────
const MyTicketsTab = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => api.get('/customers/support/tickets'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) return (
    <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  const tickets: any[] = data?.tickets ?? [];

  if (tickets.length === 0) return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><TicketCheck size={30} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>No tickets yet</Text>
      <Text style={styles.emptySub}>Raise a ticket from the "New Ticket" tab and we'll get back to you within 24 hours.</Text>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {tickets.map((t: any, i: number) => (
        <TicketCard key={t.id} ticket={t} idx={i} />
      ))}
    </ScrollView>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
const SupportScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'new' | 'mine'>('new');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]}
          onPress={() => { haptic(); setTab('new'); }}
          activeOpacity={0.8}
        >
          <Plus size={14} color={tab === 'new' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>New Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
          onPress={() => { haptic(); setTab('mine'); queryClient.invalidateQueries({ queryKey: ['support-tickets'] }); }}
          activeOpacity={0.8}
        >
          <MessageSquare size={14} color={tab === 'mine' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>My Tickets</Text>
        </TouchableOpacity>
      </View>

      {tab === 'new'
        ? <NewTicketTab onSuccess={() => { setTab('mine'); queryClient.invalidateQueries({ queryKey: ['support-tickets'] }); }} />
        : <MyTicketsTab />
      }
    </View>
  );
};

export default SupportScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: fontFamily.extrabold, color: colors.ink },

  tabRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  tabBtnActive: { backgroundColor: colors.primaryTint },
  tabText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  tabTextActive: { color: colors.primary },

  // Form
  fieldLabel: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 8 },
  required: { color: colors.danger },
  input: {
    backgroundColor: colors.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink,
    borderWidth: 1, borderColor: colors.border,
  },
  multiline: { height: 130, paddingTop: 13 },
  charCount: { fontSize: 10, fontFamily: fontFamily.regular, color: colors.inkFaint, textAlign: 'right', marginTop: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border, marginRight: 8,
  },
  catChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  catLabelActive: { color: colors.primary },
  tipBox: {
    backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 1,
    borderColor: '#FDE68A', padding: 12, marginVertical: 16,
  },
  tipText: { fontSize: 12, fontFamily: fontFamily.regular, color: '#92400E', lineHeight: 18 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.white },

  // Ticket card
  ticketCard: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontFamily: fontFamily.bold },
  ticketCategory: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted },
  ticketDate: { fontSize: 10, fontFamily: fontFamily.medium, color: colors.inkFaint },
  ticketSubject: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4 },
  ticketPreview: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.inkMuted, lineHeight: 18 },
  replyBox: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12,
    marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#22C55E',
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  replyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  replyLabel: { fontSize: 10, fontFamily: fontFamily.bold, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5 },
  replyText: { fontSize: 13, fontFamily: fontFamily.regular, color: '#166534', lineHeight: 19 },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.inkMuted, textAlign: 'center', lineHeight: 21 },
});
