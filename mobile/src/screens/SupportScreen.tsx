import { tokens } from '../theme/tokens';
import React, { useState, useCallback, useEffect } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import {
  View, Text, ScrollView, TextInput,
  Alert, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SkeletonScreenList, SkeletonListItem, ScreenError } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, MessageSquare, Clock, CheckCircle2,
  ChevronDown, ChevronUp, TicketCheck, Send,
  Package, CreditCard, Bike, User,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { haptics } from '../utils/haptics';
import { useFeedback } from '../context/FeedbackContext';

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
    key: 'order_issue', label: 'Order Issue', Icon: Package,
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
    key: 'payment', label: 'Payment', Icon: CreditCard,
    ticket_type: 'payment_issue',
    sub_types: [],
  },
  {
    key: 'delivery', label: 'Delivery', Icon: Bike,
    ticket_type: 'delivery_issue',
    sub_types: [
      { key: 'late_delivery',    label: 'Late Delivery' },
      { key: 'not_delivered',    label: 'Order Not Received' },
      { key: 'rider_behavior',   label: 'Rider Behavior' },
    ],
  },
  {
    key: 'account', label: 'My Account', Icon: User,
    ticket_type: 'account',
    sub_types: [],
  },
  {
    key: 'other', label: 'Other', Icon: MessageSquare,
    ticket_type: 'general',
    sub_types: [],
  },
];

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  open:           { label: 'Open',           color: '#2563EB', bg: '#EFF6FF', Icon: Clock },
  in_progress:    { label: 'In Progress',    color: '#D97706', bg: tokens.colors.warningTint, Icon: MessageSquare },
  awaiting_user:  { label: 'Awaiting You',   color: '#7C3AED', bg: '#F5F3FF', Icon: Clock },
  escalated:      { label: 'Escalated',      color: '#DC2626', bg: '#FEF2F2', Icon: Clock },
  resolved:       { label: 'Resolved',       color: tokens.colors.success, bg: tokens.colors.successTint, Icon: CheckCircle2 },
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
const TicketCard = ({ ticket, idx, initiallyExpanded }: { ticket: Ticket; idx: number; initiallyExpanded?: boolean }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded || false);
  const { showDialog } = useFeedback();
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
      haptics.success();
    },
    onError: () => showDialog({ title: 'Error', message: 'Could not send reply. Please try again.', confirmText: 'Okay', type: 'error' }),
  });

  // Real-time: refetch when support agent replies
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { ticketId: string }) => {
      if (data?.ticketId === ticket.id) {
        queryClient.invalidateQueries({ queryKey: ['ticket-thread', ticket.id] });
      }
    };
    socket.on('ticket_replied', handler);
    return () => { socket.off('ticket_replied', handler); };
  }, [ticket.id, queryClient]);

  const messages: TicketMessage[] = threadData?.messages ?? [];
  const canReply = !isTerminal(ticket.status);

  const handleExpand = () => {
    haptics.selection();
    setExpanded(e => !e);
  };

  const handleSend = () => {
    const text = replyText.trim();
    if (!text || replyMutation.isPending) return;
    haptics.selection();
    replyMutation.mutate(text);
  };

  return (
    <Animated.View entering={FadeInDown.delay(idx * 50).duration(220)} style={styles.ticketCard}>
      <PressableScale 
        onPress={handleExpand}
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Collapse ticket: ${ticket.subject}` : `Expand ticket: ${ticket.subject}`}
      >
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
              ? <ChevronUp size={16} color={tokens.colors.textSecondary} />
              : <ChevronDown size={16} color={tokens.colors.textSecondary} />
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
      </PressableScale>

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
                placeholderTextColor={tokens.colors.textTertiary}
                multiline
                maxLength={500}
                returnKeyType="send"
              />
              <PressableScale
                style={[
                  styles.sendBtn,
                  (!replyText.trim() || replyMutation.isPending) && styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={!replyText.trim() || replyMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Send reply"
              >
                <Send size={16} color={tokens.colors.textInverse} />
              </PressableScale>
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
  const { showDialog } = useFeedback();

  const selectedCat = CATEGORIES.find(c => c.key === categoryKey)!;

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/support/tickets', data),
    onSuccess: () => {
      showDialog({
        title: 'Ticket Raised ✓',
        message: 'Support team will contact you shortly.',
        confirmText: 'Okay',
        type: 'success',
        onConfirm: () => {
          onSuccess();
          setSubject('');
          setMessage('');
          setCategoryKey('order_issue');
          setSubType('');
        }
      });
      haptics.success();
    },
    onError: () => showDialog({ title: 'Error', message: 'Could not submit ticket. Please try again.', confirmText: 'Okay', type: 'error' }),
  });

  const handleCategoryChange = (key: string) => {
    haptics.selection();
    setCategoryKey(key);
    setSubType('');
  };

  const canSubmit = subject.trim().length >= 3 && message.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.selection();

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
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: 60 }}
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
            <PressableScale
              key={cat.key}
              style={[styles.catChip, categoryKey === cat.key && styles.catChipActive]}
              onPress={() => handleCategoryChange(cat.key)}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${cat.label}`}
            >
              <cat.Icon size={15} color={categoryKey === cat.key ? tokens.colors.primary : tokens.colors.textSecondary} />
              <Text style={[styles.catLabel, categoryKey === cat.key && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </PressableScale>
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
                <PressableScale
                  key={st.key}
                  style={[styles.subChip, subType === st.key && styles.subChipActive]}
                  onPress={() => { haptics.selection(); setSubType(st.key); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Issue Type: ${st.label}`}
                >
                  <Text style={[styles.subChipLabel, subType === st.key && styles.subChipLabelActive]}>
                    {st.label}
                  </Text>
                </PressableScale>
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
          placeholderTextColor={tokens.colors.textTertiary}
          maxLength={100}
          returnKeyType="next"
        />
        <Text style={styles.charCount}>
          {subject.length}/100{subject.trim().length > 0 && subject.trim().length < 3 ? '  ·  min 3 chars' : ''}
        </Text>

        {/* Description */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
          Description <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your issue in detail — order ID, what happened, what you expect…"
          placeholderTextColor={tokens.colors.textTertiary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={1000}
        />
        <Text style={styles.charCount}>
          {message.length}/1000{message.trim().length > 0 && message.trim().length < 5 ? '  ·  min 5 chars' : ''}
        </Text>

        {/* Tip box */}
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            Including your Order ID speeds up the resolution. Find it in Order History.
          </Text>
        </View>

        <PressableScale
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Submit Ticket"
        >
          <Text style={styles.submitBtnText}>
            {mutation.isPending ? 'Submitting…' : 'Submit Ticket'}
          </Text>
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── My Tickets tab ────────────────────────────────────────────────────────────
const MyTicketsTab = ({ initialExpandedId }: { initialExpandedId?: string }) => {
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
          <TicketCheck size={30} color={tokens.colors.primary} />
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.primary} />
      }
    >
      {tickets.map((t, i) => (
        <TicketCard key={t.id} ticket={t} idx={i} initiallyExpanded={t.id === initialExpandedId} />
      ))}
    </ScrollView>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
const SupportScreen = ({ route, navigation }: any) => {
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();
  const ticketId = route?.params?.ticketId;
  const [tab, setTab] = useState<'new' | 'mine'>(ticketId ? 'mine' : 'new');

  return (
    <View style={styles.root}>
      <ScreenHeader title="Support" />

      {/* Tabs */}
      <View style={styles.tabRow}>
        <PressableScale
          style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]}
          onPress={() => { haptics.selection(); setTab('new'); }}
          accessibilityRole="tab"
          accessibilityLabel="New Ticket"
        >
          <Plus size={14} color={tab === 'new' ? tokens.colors.primary : tokens.colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>New Ticket</Text>
        </PressableScale>
        <PressableScale
          style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
          onPress={() => {
            haptics.selection();
            setTab('mine');
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
          }}
          accessibilityRole="tab"
          accessibilityLabel="My Tickets"
        >
          <MessageSquare size={14} color={tab === 'mine' ? tokens.colors.primary : tokens.colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>My Tickets</Text>
        </PressableScale>
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
        : <MyTicketsTab initialExpandedId={ticketId} />
      }
    </View>
  );
};

export default SupportScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },


  tabRow: {
    flexDirection: 'row', backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.md, paddingTop: 4,
    borderBottomWidth: 1, borderBottomColor: tokens.colors.border, gap: tokens.spacing.sm,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 14,
    backgroundColor: tokens.colors.background,
  },
  tabBtnActive: { backgroundColor: tokens.colors.primaryTint },
  tabText: { fontSize: 13, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary },
  tabTextActive: { color: tokens.colors.primary },

  // Form
  fieldLabel: { fontSize: 12, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 8 },
  required: { color: tokens.colors.danger },
  input: {
    backgroundColor: tokens.colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary,
    borderWidth: 1, borderColor: tokens.colors.border,
  },
  multiline: { height: 130, paddingTop: 13 },
  charCount: {
    fontSize: 10, fontFamily: tokens.typography.family.regular,
    color: tokens.colors.textTertiary, textAlign: 'right', marginTop: 4,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, backgroundColor: tokens.colors.surface,
    borderWidth: 1.5, borderColor: tokens.colors.border, marginRight: 8,
  },
  catChipActive: { backgroundColor: tokens.colors.primaryTint, borderColor: tokens.colors.primary },
  catLabel: { fontSize: 13, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary },
  catLabelActive: { color: tokens.colors.primary },
  subChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: tokens.colors.surface,
    borderWidth: 1.5, borderColor: tokens.colors.border, marginRight: 8,
  },
  subChipActive: { backgroundColor: tokens.colors.primaryTint, borderColor: tokens.colors.primary },
  subChipLabel: { fontSize: 12, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary },
  subChipLabelActive: { color: tokens.colors.primary },
  tipBox: {
    backgroundColor: tokens.colors.warningTint, borderRadius: 20, borderWidth: 1,
    borderColor: tokens.colors.warning, padding: 12, marginVertical: 16,
  },
  tipText: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.warning, lineHeight: 18 },
  submitBtn: {
    backgroundColor: tokens.colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: tokens.colors.primary, shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: tokens.colors.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textInverse },

  // Ticket card
  ticketCard: {
    backgroundColor: tokens.colors.surface, borderRadius: 16,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: tokens.colors.border,
    ...tokens.shadows.soft,
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
  statusText: { fontSize: 10, fontFamily: tokens.typography.family.bold },
  ticketCategory: { fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  ticketDate: { fontSize: 10, fontFamily: tokens.typography.family.medium, color: tokens.colors.textTertiary },
  ticketSubject: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 4 },
  ticketPreview: {
    fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, lineHeight: 18,
  },

  // Thread
  threadDivider: {
    height: 1, backgroundColor: tokens.colors.border,
    marginHorizontal: -16, marginTop: 12, marginBottom: 12,
  },
  thread: { gap: 8, paddingBottom: 4 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%', borderRadius: 16, padding: 10,
  },
  bubbleSupport: {
    backgroundColor: tokens.colors.background, borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: tokens.colors.primary, borderBottomRightRadius: 4,
  },
  bubbleSender: {
    fontSize: 10, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary,
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  bubbleText: {
    fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, lineHeight: 19,
  },
  bubbleTextUser: { color: tokens.colors.textInverse },
  bubbleTime: {
    fontSize: 10, fontFamily: tokens.typography.family.regular, color: tokens.colors.textTertiary,
    marginTop: 4, textAlign: 'right',
  },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)' },
  systemMsgWrap: { alignItems: 'center', paddingVertical: 4 },
  systemMsg: {
    fontSize: 11, fontFamily: tokens.typography.family.regular, color: tokens.colors.textTertiary,
    fontStyle: 'italic', textAlign: 'center',
  },

  // Resolution
  resolutionBox: {
    backgroundColor: tokens.colors.successTint, borderRadius: 16, padding: 12,
    marginTop: 4, borderLeftWidth: 3, borderLeftColor: tokens.colors.success,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  replyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.success },
  replyLabel: {
    fontSize: 10, fontFamily: tokens.typography.family.bold, color: tokens.colors.success,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  replyText: { fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.success, lineHeight: 19 },

  // Reply row
  replyRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border,
    marginTop: 8,
  },
  replyInput: {
    flex: 1, backgroundColor: tokens.colors.background, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary,
    maxHeight: 100, borderWidth: 1, borderColor: tokens.colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tokens.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: tokens.colors.border },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: tokens.colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 8 },
  emptySub: {
    fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },
});
