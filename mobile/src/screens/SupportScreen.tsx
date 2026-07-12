import React, { useState, useCallback } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, TextInput,
  Alert, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SkeletonScreenList, SkeletonListItem, ScreenError } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, MessageSquare, Clock, CheckCircle2,
  ChevronDown, ChevronUp, TicketCheck, Send,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  user_type: 'customer' | 'rider';
  ticket_type: string;
  sub_type: string;
  subject: string;
  status: 'open' | 'in_progress' | 'awaiting_user' | 'escalated' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  sla_deadline: string;
  auto_resolved: boolean;
  abuse_flag: boolean;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  latest_message?: { message: string; sender_type: string; created_at: string };
}

interface TicketMessage {
  id: string;
  sender_type: 'user' | 'support' | 'system' | 'admin';
  sender_name: string;
  message: string;
  created_at: string;
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'order_issue', label: 'Order Issue', icon: '📦',
    ticket_type: 'order_complaint',
    sub_types: [
      { key: 'missing_item',       label: 'Missing Item' },
      { key: 'wrong_item',         label: 'Wrong Item' },
      { key: 'quality_issue',      label: 'Quality Issue' },
      { key: 'not_delivered',      label: 'Not Delivered' },
      { key: 'late_delivery',      label: 'Late Delivery' },
      { key: 'packaging_damage',   label: 'Damaged Packaging' },
    ],
  },
  {
    key: 'payment', label: 'Payment', icon: '💳',
    ticket_type: 'payment_issue',
    sub_types: [],
  },
  {
    key: 'delivery', label: 'Delivery', icon: '🚴',
    ticket_type: 'delivery_issue',
    sub_types: [
      { key: 'late_delivery',    label: 'Late Delivery' },
      { key: 'not_delivered',    label: 'Order Not Received' },
      { key: 'rider_behavior',   label: 'Rider Behavior' },
    ],
  },
  {
    key: 'account', label: 'My Account', icon: '👤',
    ticket_type: 'account',
    sub_types: [],
  },
  {
    key: 'other', label: 'Other', icon: '💬',
    ticket_type: 'general',
    sub_types: [],
  },
];

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  open:           { label: 'Open',           color: '#2563EB', bg: '#EFF6FF', Icon: Clock },
  in_progress:    { label: 'In Progress',    color: '#D97706', bg: '#FFFBEB', Icon: MessageSquare },
  awaiting_user:  { label: 'Awaiting You',   color: '#7C3AED', bg: '#F5F3FF', Icon: Clock },
  escalated:      { label: 'Escalated',      color: '#DC2626', bg: '#FEF2F2', Icon: Clock },
  resolved:       { label: 'Resolved',       color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
  closed:         { label: 'Closed',         color: '#6B7280', bg: '#F3F4F6', Icon: CheckCircle2 },
};

const getMeta = (s: string) => STATUS_META[s] ?? STATUS_META['open'];

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const isTerminal = (status: string) => status === 'resolved' || status === 'closed';

// ── Thread message bubble ─────────────────────────────────────────────────────
const MessageBubble = ({ msg }: { msg: TicketMessage }) => {
  const isUser = msg.sender_type === 'user';
  const isSystem = msg.sender_type === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMsgWrap}>
        <Text style={styles.systemMsg}>{msg.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleSupport]}>
        {!isUser && (
          <Text style={styles.bubbleSender}>{msg.sender_name || 'Support'}</Text>
        )}
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {msg.message}
        </Text>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {relativeTime(msg.created_at)}
        </Text>
      </View>
    </View>
  );
};

// ── Ticket card with message thread ──────────────────────────────────────────
const TicketCard = ({ ticket, idx }: { ticket: Ticket; idx: number }) => {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const queryClient = useQueryClient();
  const meta = getMeta(ticket.status);
  const { Icon } = meta;

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['ticket-thread', ticket.id],
    queryFn: () => api.get(`/customers/support/tickets/${ticket.id}`),
    enabled: expanded,
    staleTime: 30_000,
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      api.post(`/customers/support/tickets/${ticket.id}/reply`, { message }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['ticket-thread', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: () => Alert.alert('Error', 'Could not send reply. Please try again.'),
  });

  const messages: TicketMessage[] = threadData?.messages ?? [];
  const canReply = !isTerminal(ticket.status);

  const handleExpand = () => {
    haptic();
    setExpanded(e => !e);
  };

  const handleSend = () => {
    const text = replyText.trim();
    if (!text || replyMutation.isPending) return;
    haptic();
    replyMutation.mutate(text);
  };

  return (
    <Animated.View entering={FadeInDown.delay(idx * 50).duration(220)} style={styles.ticketCard}>
      <BouncingButton onPress={handleExpand} activeOpacity={0.85}>
        <View style={styles.ticketHeader}>
          <View style={styles.ticketLeft}>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Icon size={11} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.ticketCategory}>
              {CATEGORIES.find(c => c.ticket_type === ticket.ticket_type)?.label ??
               ticket.ticket_type ?? 'General'}
            </Text>
          </View>
          <View style={styles.ticketRight}>
            <Text style={styles.ticketDate}>{relativeTime(ticket.created_at)}</Text>
            {expanded
              ? <ChevronUp size={16} color={colors.inkMuted} />
              : <ChevronDown size={16} color={colors.inkMuted} />
            }
          </View>
        </View>

        <Text style={styles.ticketSubject}>{ticket.subject}</Text>

        {/* Latest message preview when collapsed */}
        {!expanded && ticket.latest_message && (
          <Text style={styles.ticketPreview} numberOfLines={2}>
            {ticket.latest_message.message}
          </Text>
        )}
      </BouncingButton>

      {/* Expanded thread */}
      {expanded && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={styles.threadDivider} />

          {threadLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <SkeletonListItem />
            </View>
          ) : (
            <View style={styles.thread}>
              {messages.length === 0 && ticket.resolution ? (
                // Fallback: show resolution text if no messages yet
                <View style={styles.resolutionBox}>
                  <View style={styles.replyHeader}>
                    <View style={styles.replyDot} />
                    <Text style={styles.replyLabel}>Resolution</Text>
                  </View>
                  <Text style={styles.replyText}>{ticket.resolution}</Text>
                </View>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}

              {/* Resolution footer for closed tickets */}
              {isTerminal(ticket.status) && ticket.resolution && messages.length > 0 && (
                <View style={styles.resolutionBox}>
                  <View style={styles.replyHeader}>
                    <View style={styles.replyDot} />
                    <Text style={styles.replyLabel}>Resolution</Text>
                  </View>
                  <Text style={styles.replyText}>{ticket.resolution}</Text>
                </View>
              )}
            </View>
          )}

          {/* Reply input */}
          {canReply && (
            <View style={styles.replyRow}>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type a reply…"
                placeholderTextColor={colors.inkFaint}
                multiline
                maxLength={500}
                returnKeyType="send"
              />
              <BouncingButton
                style={[
                  styles.sendBtn,
                  (!replyText.trim() || replyMutation.isPending) && styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={!replyText.trim() || replyMutation.isPending}
                activeOpacity={0.85}
              >
                <Send size={16} color={colors.white} />
              </BouncingButton>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
};

// ── New Ticket form ──────────────────────────────────────────────────────────
const NewTicketTab = ({ onSuccess }: { onSuccess: () => void }) => {
  const [categoryKey, setCategoryKey] = useState('order_issue');
  const [subType, setSubType] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const selectedCat = CATEGORIES.find(c => c.key === categoryKey)!;

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
      setCategoryKey('order_issue');
      setSubType('');
    },
    onError: () => Alert.alert('Error', 'Could not submit ticket. Please try again.'),
  });

  const handleCategoryChange = (key: string) => {
    haptic();
    setCategoryKey(key);
    setSubType('');
  };

  const canSubmit = subject.trim().length > 3 && message.trim().length > 10;

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptic();

    const effectiveSubType =
      subType ||
      (selectedCat.sub_types.length > 0 ? selectedCat.sub_types[0].key : 'general');

    mutation.mutate({
      subject: subject.trim(),
      message: message.trim(),
      ticket_type: selectedCat.ticket_type,
      sub_type: effectiveSubType,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category */}
        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: selectedCat.sub_types.length > 0 ? 12 : 20 }}
        >
          {CATEGORIES.map(cat => (
            <BouncingButton
              key={cat.key}
              style={[styles.catChip, categoryKey === cat.key && styles.catChipActive]}
              onPress={() => handleCategoryChange(cat.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.catEmoji}>{cat.icon}</Text>
              <Text style={[styles.catLabel, categoryKey === cat.key && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </BouncingButton>
          ))}
        </ScrollView>

        {/* Sub-type chips (only when category has sub_types) */}
        {selectedCat.sub_types.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Issue Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {selectedCat.sub_types.map(st => (
                <BouncingButton
                  key={st.key}
                  style={[styles.subChip, subType === st.key && styles.subChipActive]}
                  onPress={() => { haptic(); setSubType(st.key); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.subChipLabel, subType === st.key && styles.subChipLabelActive]}>
                    {st.label}
                  </Text>
                </BouncingButton>
              ))}
            </ScrollView>
          </>
        )}

        {/* Subject */}
        <Text style={styles.fieldLabel}>
          Subject <Text style={styles.required}>*</Text>
        </Text>
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

        <BouncingButton
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          activeOpacity={0.9}
        >
          <Text style={styles.submitBtnText}>
            {mutation.isPending ? 'Submitting…' : 'Submit Ticket'}
          </Text>
        </BouncingButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── My Tickets tab ────────────────────────────────────────────────────────────
const MyTicketsTab = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => api.get('/customers/support/tickets'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <SkeletonScreenList item={<SkeletonListItem />} />
      </View>
    );
  }

  if (isError) {
    return <ScreenError onRetry={refetch} />;
  }

  const tickets: Ticket[] = data?.tickets ?? [];

  if (tickets.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <TicketCheck size={30} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No tickets yet</Text>
        <Text style={styles.emptySub}>
          Raise a ticket from the "New Ticket" tab and we'll get back to you within 24 hours.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {tickets.map((t, i) => (
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
        <BouncingButton
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.ink} />
        </BouncingButton>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <BouncingButton
          style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]}
          onPress={() => { haptic(); setTab('new'); }}
          activeOpacity={0.8}
        >
          <Plus size={14} color={tab === 'new' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>New Ticket</Text>
        </BouncingButton>
        <BouncingButton
          style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
          onPress={() => {
            haptic();
            setTab('mine');
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
          }}
          activeOpacity={0.8}
        >
          <MessageSquare size={14} color={tab === 'mine' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>My Tickets</Text>
        </BouncingButton>
      </View>

      {tab === 'new'
        ? (
          <NewTicketTab
            onSuccess={() => {
              setTab('mine');
              queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            }}
          />
        )
        : <MyTicketsTab />
      }
    </View>
  );
};

export default SupportScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
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
    backgroundColor: colors.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink,
    borderWidth: 1, borderColor: colors.border,
  },
  multiline: { height: 130, paddingTop: 13 },
  charCount: {
    fontSize: 10, fontFamily: fontFamily.regular,
    color: colors.inkFaint, textAlign: 'right', marginTop: 4,
  },
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
  subChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border, marginRight: 8,
  },
  subChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  subChipLabel: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  subChipLabelActive: { color: colors.primary },
  tipBox: {
    backgroundColor: '#FFFBEB', borderRadius: 20, borderWidth: 1,
    borderColor: '#FDE68A', padding: 12, marginVertical: 16,
  },
  tipText: { fontSize: 12, fontFamily: fontFamily.regular, color: '#92400E', lineHeight: 18 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.white },

  // Ticket card
  ticketCard: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 16,
    shadowOffset: { width: 0, height: 1 }, elevation: 4,
  },
  ticketHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  ticketLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  statusText: { fontSize: 10, fontFamily: fontFamily.bold },
  ticketCategory: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted },
  ticketDate: { fontSize: 10, fontFamily: fontFamily.medium, color: colors.inkFaint },
  ticketSubject: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4 },
  ticketPreview: {
    fontSize: 13, fontFamily: fontFamily.regular, color: colors.inkMuted, lineHeight: 18,
  },

  // Thread
  threadDivider: {
    height: 1, backgroundColor: colors.border,
    marginHorizontal: -16, marginTop: 12, marginBottom: 12,
  },
  thread: { gap: 8, paddingBottom: 4 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%', borderRadius: 16, padding: 10,
  },
  bubbleSupport: {
    backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.primary, borderBottomRightRadius: 4,
  },
  bubbleSender: {
    fontSize: 10, fontFamily: fontFamily.bold, color: colors.inkMuted,
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  bubbleText: {
    fontSize: 13, fontFamily: fontFamily.regular, color: colors.ink, lineHeight: 19,
  },
  bubbleTextUser: { color: colors.white },
  bubbleTime: {
    fontSize: 10, fontFamily: fontFamily.regular, color: colors.inkFaint,
    marginTop: 4, textAlign: 'right',
  },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)' },
  systemMsgWrap: { alignItems: 'center', paddingVertical: 4 },
  systemMsg: {
    fontSize: 11, fontFamily: fontFamily.regular, color: colors.inkFaint,
    fontStyle: 'italic', textAlign: 'center',
  },

  // Resolution
  resolutionBox: {
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 12,
    marginTop: 4, borderLeftWidth: 3, borderLeftColor: '#22C55E',
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  replyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  replyLabel: {
    fontSize: 10, fontFamily: fontFamily.bold, color: '#16A34A',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  replyText: { fontSize: 13, fontFamily: fontFamily.regular, color: '#166534', lineHeight: 19 },

  // Reply row
  replyRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: 8,
  },
  replyInput: {
    flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, fontFamily: fontFamily.regular, color: colors.ink,
    maxHeight: 100, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 8 },
  emptySub: {
    fontSize: 14, fontFamily: fontFamily.regular, color: colors.inkMuted,
    textAlign: 'center', lineHeight: 21,
  },
});
