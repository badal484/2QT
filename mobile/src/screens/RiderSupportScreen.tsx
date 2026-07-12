import React, { useState, useCallback } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, TextInput,
  Alert, StyleSheet, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SkeletonScreenList, SkeletonListItem, ScreenError } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, MessageSquare, Clock, CheckCircle2,
  ChevronDown, ChevronUp, TicketCheck, Send, AlertTriangle,
  Package,
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

interface ComplaintAgainstMe {
  id: string;
  order_display_id: string;
  delivered_at: string;
  complaint_type: string;
  status: 'open' | 'resolved' | 'rejected';
  refund_scope?: string;
  admin_note?: string;
}

interface RiderOrder {
  id: string;
  display_id: string;
  delivered_at: string;
}

interface EarningsBreakdown {
  orderId: string;
  displayId: string;
  breakdown: {
    distanceKm: number;
    thresholdKm: number;
    formula: string;
    baseEarningsPaise: number;
    surgeActive: boolean;
    surgeMultiplier: number;
    surgedBasePaise: number;
    tipPaise: number;
    platformFeePaise: number;
    netEarningsPaise: number;
  };
}

// ── Rider categories ──────────────────────────────────────────────────────────
const RIDER_CATEGORIES = [
  {
    key: 'earnings', label: 'Earnings Issue', icon: '💰',
    ticket_type: 'earnings',
    sub_types: [
      { key: 'surge_not_applied',     label: 'Surge Not Applied' },
      { key: 'wrong_base_pay',        label: 'Wrong Pay Calculation' },
      { key: 'cod_deduction_dispute', label: 'Unfair COD Deduction' },
      { key: 'tip_not_received',      label: 'Tip Not Received' },
      { key: 'payout_delayed',        label: 'Payout Delayed' },
    ],
  },
  {
    key: 'order', label: 'Order Problem', icon: '📦',
    ticket_type: 'order_issue',
    sub_types: [
      { key: 'customer_unreachable', label: 'Customer Unreachable' },
      { key: 'wrong_address',        label: 'Wrong Address Given' },
      { key: 'kitchen_delay',        label: 'Long Kitchen Wait' },
      { key: 'wrong_batch',          label: 'Unfair Batch' },
      { key: 'cod_refused',          label: 'Customer Refused COD' },
    ],
  },
  {
    key: 'customer', label: 'Customer Issue', icon: '👤',
    ticket_type: 'customer_issue',
    sub_types: [
      { key: 'customer_abusive', label: 'Abusive Customer' },
      { key: 'false_complaint',  label: 'False Complaint Filed Against Me' },
    ],
  },
  {
    key: 'safety', label: 'Safety', icon: '🛡️',
    ticket_type: 'safety',
    sub_types: [
      { key: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
      { key: 'safety_concern',    label: 'Safety Concern' },
    ],
  },
  {
    key: 'app', label: 'App Issue', icon: '📱',
    ticket_type: 'app_issue',
    sub_types: [{ key: 'app_issue', label: 'App Not Working' }],
  },
  {
    key: 'other', label: 'Other', icon: '💬',
    ticket_type: 'general',
    sub_types: [{ key: 'general', label: 'General Query' }],
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

const COMPLAINT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:     { label: 'Open',     color: '#D97706', bg: '#FFFBEB' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#F0FDF4' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
};

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  missing_item:     'Missing Item',
  wrong_item:       'Wrong Item',
  quality_issue:    'Quality Issue',
  not_delivered:    'Not Delivered',
  late_delivery:    'Late Delivery',
  rider_behavior:   'Rider Behavior',
  packaging_damage: 'Damaged Packaging',
};

const getMeta = (s: string) => STATUS_META[s] ?? STATUS_META['open'];
const isTerminal = (s: string) => s === 'resolved' || s === 'closed';

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function paiseTo(paise: number) {
  return `₹${Math.floor(paise / 100)}`;
}

// ── Message bubble ────────────────────────────────────────────────────────────
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

// ── Earnings breakdown card ───────────────────────────────────────────────────
const EarningsBreakdownCard = ({ data }: { data: EarningsBreakdown }) => {
  const b = data.breakdown;
  return (
    <View style={styles.earningsCard}>
      <Text style={styles.earningsTitle}>Order #{data.displayId}</Text>
      <View style={styles.earningsRow}>
        <Text style={styles.earningsLabel}>Distance</Text>
        <Text style={styles.earningsValue}>{b.distanceKm} km  |  Threshold: {b.thresholdKm} km</Text>
      </View>
      <View style={styles.earningsRow}>
        <Text style={styles.earningsLabel}>Formula</Text>
        <Text style={styles.earningsValue}>{b.formula}</Text>
      </View>
      {b.surgeActive && (
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Surge</Text>
          <Text style={[styles.earningsValue, { color: '#D97706' }]}>
            {b.surgeMultiplier}× active → {paiseTo(b.surgedBasePaise)}
          </Text>
        </View>
      )}
      {b.tipPaise > 0 && (
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Tip</Text>
          <Text style={[styles.earningsValue, { color: colors.success }]}>
            +{paiseTo(b.tipPaise)}
          </Text>
        </View>
      )}
      <View style={styles.earningsRow}>
        <Text style={styles.earningsLabel}>Platform fee</Text>
        <Text style={[styles.earningsValue, { color: colors.danger }]}>
          -{paiseTo(b.platformFeePaise)}
        </Text>
      </View>
      <View style={styles.earningsDivider} />
      <View style={styles.earningsRow}>
        <Text style={styles.earningsNet}>Net Earnings</Text>
        <Text style={styles.earningsNetValue}>{paiseTo(b.netEarningsPaise)}</Text>
      </View>
    </View>
  );
};

// ── Rider ticket card ─────────────────────────────────────────────────────────
const RiderTicketCard = ({ ticket, idx }: { ticket: Ticket; idx: number }) => {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const queryClient = useQueryClient();
  const meta = getMeta(ticket.status);
  const { Icon } = meta;

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['rider-ticket-thread', ticket.id],
    queryFn: () => api.get(`/riders/support/tickets/${ticket.id}`),
    enabled: expanded,
    staleTime: 30_000,
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      api.post(`/riders/support/tickets/${ticket.id}/reply`, { message }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['rider-ticket-thread', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['rider-support-tickets'] });
    },
    onError: () => Alert.alert('Error', 'Could not send reply. Please try again.'),
  });

  const messages: TicketMessage[] = threadData?.messages ?? [];
  const canReply = !isTerminal(ticket.status);

  const catLabel = RIDER_CATEGORIES.find(c => c.ticket_type === ticket.ticket_type)?.label
    ?? ticket.ticket_type ?? 'General';

  return (
    <Animated.View entering={FadeInDown.delay(idx * 50).duration(220)} style={styles.ticketCard}>
      <BouncingButton onPress={() => { haptic(); setExpanded(e => !e); }} activeOpacity={0.85}>
        <View style={styles.ticketHeader}>
          <View style={styles.ticketLeft}>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Icon size={11} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.ticketCategory}>{catLabel}</Text>
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
        {!expanded && ticket.latest_message && (
          <Text style={styles.ticketPreview} numberOfLines={2}>
            {ticket.latest_message.message}
          </Text>
        )}
      </BouncingButton>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={styles.threadDivider} />
          {threadLoading ? (
            <View style={{ paddingVertical: 12 }}><SkeletonListItem /></View>
          ) : (
            <View style={styles.thread}>
              {messages.length === 0 && ticket.resolution ? (
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
              />
              <BouncingButton
                style={[
                  styles.sendBtn,
                  (!replyText.trim() || replyMutation.isPending) && styles.sendBtnDisabled,
                ]}
                onPress={() => {
                  const text = replyText.trim();
                  if (!text || replyMutation.isPending) return;
                  haptic();
                  replyMutation.mutate(text);
                }}
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

// ── Complaint card ────────────────────────────────────────────────────────────
const ComplaintCard = ({ complaint, idx }: { complaint: ComplaintAgainstMe; idx: number }) => {
  const [expanded, setExpanded] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const smeta = COMPLAINT_STATUS_META[complaint.status] ?? COMPLAINT_STATUS_META['open'];
  const canRespond = (complaint.status === 'open' || complaint.status === 'resolved') && !submitted;

  const respondMutation = useMutation({
    mutationFn: (message: string) =>
      api.post(`/riders/complaints-against-me/${complaint.id}/respond`, { message }),
    onSuccess: () => {
      setSubmitted(true);
      setResponseText('');
      queryClient.invalidateQueries({ queryKey: ['rider-complaints'] });
    },
    onError: () => Alert.alert('Error', 'Could not submit response. Please try again.'),
  });

  return (
    <Animated.View entering={FadeInDown.delay(idx * 50).duration(220)} style={styles.ticketCard}>
      <BouncingButton onPress={() => { haptic(); setExpanded(e => !e); }} activeOpacity={0.85}>
        <View style={styles.ticketHeader}>
          <View style={styles.ticketLeft}>
            <View style={[styles.statusBadge, { backgroundColor: smeta.bg }]}>
              <AlertTriangle size={11} color={smeta.color} />
              <Text style={[styles.statusText, { color: smeta.color }]}>{smeta.label}</Text>
            </View>
          </View>
          <View style={styles.ticketRight}>
            <Text style={styles.ticketDate}>{relativeTime(complaint.delivered_at)}</Text>
            {expanded
              ? <ChevronUp size={16} color={colors.inkMuted} />
              : <ChevronDown size={16} color={colors.inkMuted} />
            }
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Package size={13} color={colors.inkMuted} />
          <Text style={styles.ticketSubject}>Order #{complaint.order_display_id}</Text>
        </View>
        <Text style={styles.ticketCategory}>
          {COMPLAINT_TYPE_LABELS[complaint.complaint_type] ?? complaint.complaint_type}
        </Text>
      </BouncingButton>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={styles.threadDivider} />

          {complaint.status === 'resolved' && complaint.refund_scope && (
            <View style={styles.resolutionBox}>
              <View style={styles.replyHeader}>
                <View style={styles.replyDot} />
                <Text style={styles.replyLabel}>Admin Decision</Text>
              </View>
              {complaint.refund_scope ? (
                <Text style={styles.replyText}>Refund scope: {complaint.refund_scope}</Text>
              ) : null}
              {complaint.admin_note ? (
                <Text style={[styles.replyText, { marginTop: 4 }]}>{complaint.admin_note}</Text>
              ) : null}
            </View>
          )}

          {submitted ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                Your response has been recorded. Support team will review.
              </Text>
            </View>
          ) : canRespond ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>
                Your Response / Dispute
              </Text>
              <TextInput
                style={[styles.replyInput, { height: 90, borderRadius: 14, paddingTop: 10 }]}
                value={responseText}
                onChangeText={setResponseText}
                placeholder="Explain your side of this complaint…"
                placeholderTextColor={colors.inkFaint}
                multiline
                textAlignVertical="top"
                maxLength={800}
              />
              <BouncingButton
                style={[
                  styles.respondBtn,
                  (!responseText.trim() || respondMutation.isPending) && styles.submitBtnDisabled,
                ]}
                onPress={() => {
                  const text = responseText.trim();
                  if (!text || respondMutation.isPending) return;
                  haptic();
                  respondMutation.mutate(text);
                }}
                disabled={!responseText.trim() || respondMutation.isPending}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>
                  {respondMutation.isPending ? 'Submitting…' : 'Submit Response'}
                </Text>
              </BouncingButton>
            </View>
          ) : null}
        </Animated.View>
      )}
    </Animated.View>
  );
};

// ── Order picker for earnings link ────────────────────────────────────────────
const OrderPicker = ({
  onSelect,
}: {
  onSelect: (order: RiderOrder) => void;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-delivered-orders-mini'],
    queryFn: () => api.get('/riders/orders/history'),
    staleTime: 60_000,
  });

  const orders: RiderOrder[] = data?.orders ?? [];

  if (isLoading) {
    return <SkeletonListItem />;
  }

  if (orders.length === 0) {
    return (
      <Text style={styles.noOrdersText}>No recent delivered orders found.</Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
      {orders.map(order => (
        <BouncingButton
          key={order.id}
          style={styles.orderChip}
          onPress={() => { haptic(); onSelect(order); }}
          activeOpacity={0.8}
        >
          <Package size={13} color={colors.inkMuted} />
          <Text style={styles.orderChipText}>#{order.display_id}</Text>
        </BouncingButton>
      ))}
    </ScrollView>
  );
};

// ── New Ticket form ──────────────────────────────────────────────────────────
const NewRiderTicketTab = ({ onSuccess }: { onSuccess: () => void }) => {
  const [categoryKey, setCategoryKey] = useState('earnings');
  const [subType, setSubType] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<RiderOrder | null>(null);

  const selectedCat = RIDER_CATEGORIES.find(c => c.key === categoryKey)!;
  const isEarnings = categoryKey === 'earnings';

  const { data: breakdownData } = useQuery({
    queryKey: ['rider-earnings-breakdown', linkedOrder?.id],
    queryFn: () => api.get(`/riders/orders/${linkedOrder!.id}/earnings-breakdown`),
    enabled: !!linkedOrder && isEarnings,
    staleTime: 120_000,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/riders/support/tickets', data),
    onSuccess: () => {
      Alert.alert(
        'Ticket Raised ✓',
        "We've received your message and will respond within 24 hours.",
        [{ text: 'View My Tickets', onPress: onSuccess }],
      );
      setSubject('');
      setMessage('');
      setCategoryKey('earnings');
      setSubType('');
      setLinkedOrder(null);
      setShowOrderPicker(false);
    },
    onError: () => Alert.alert('Error', 'Could not submit ticket. Please try again.'),
  });

  const handleCategoryChange = (key: string) => {
    haptic();
    setCategoryKey(key);
    setSubType('');
    setLinkedOrder(null);
    setShowOrderPicker(false);
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
      ...(linkedOrder ? { linked_order_id: linkedOrder.id } : {}),
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
          {RIDER_CATEGORIES.map(cat => (
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

        {/* Sub-type chips */}
        {selectedCat.sub_types.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Issue Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
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

        {/* Earnings: link to order */}
        {isEarnings && (
          <View style={styles.linkOrderSection}>
            <View style={styles.linkOrderHeader}>
              <Text style={styles.fieldLabel}>Link to Order (optional)</Text>
              <BouncingButton
                style={styles.linkOrderBtn}
                onPress={() => { haptic(); setShowOrderPicker(v => !v); }}
                activeOpacity={0.8}
              >
                <Text style={styles.linkOrderBtnText}>
                  {showOrderPicker ? 'Hide' : 'Select Order'}
                </Text>
              </BouncingButton>
            </View>

            {linkedOrder && (
              <View style={styles.linkedOrderBadge}>
                <Package size={13} color={colors.primary} />
                <Text style={styles.linkedOrderText}>#{linkedOrder.display_id} linked</Text>
                <BouncingButton
                  onPress={() => { setLinkedOrder(null); setShowOrderPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.unlinkText}>Remove</Text>
                </BouncingButton>
              </View>
            )}

            {showOrderPicker && !linkedOrder && (
              <OrderPicker
                onSelect={order => {
                  setLinkedOrder(order);
                  setShowOrderPicker(false);
                }}
              />
            )}

            {/* Earnings breakdown preview */}
            {linkedOrder && breakdownData && (
              <EarningsBreakdownCard data={breakdownData as EarningsBreakdown} />
            )}
          </View>
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
          placeholder="Describe your issue in detail…"
          placeholderTextColor={colors.inkFaint}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={1000}
        />
        <Text style={styles.charCount}>{message.length}/1000</Text>

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
const MyRiderTicketsTab = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rider-support-tickets'],
    queryFn: () => api.get('/riders/support/tickets'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['rider-support-tickets'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) {
    return <View style={{ flex: 1 }}><SkeletonScreenList item={<SkeletonListItem />} /></View>;
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
        <RiderTicketCard key={t.id} ticket={t} idx={i} />
      ))}
    </ScrollView>
  );
};

// ── Complaints Against Me tab ─────────────────────────────────────────────────
const ComplaintsTab = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rider-complaints'],
    queryFn: () => api.get('/riders/complaints-against-me'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['rider-complaints'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) {
    return <View style={{ flex: 1 }}><SkeletonScreenList item={<SkeletonListItem />} /></View>;
  }

  if (isError) {
    return <ScreenError onRetry={refetch} />;
  }

  const complaints: ComplaintAgainstMe[] = data?.complaints ?? [];

  if (complaints.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.successTint }]}>
          <CheckCircle2 size={30} color={colors.success} />
        </View>
        <Text style={styles.emptyTitle}>All clear!</Text>
        <Text style={styles.emptySub}>No complaints have been filed against you.</Text>
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
      <View style={styles.complaintsNote}>
        <AlertTriangle size={13} color='#92400E' />
        <Text style={styles.complaintsNoteText}>
          These are complaints filed by customers about deliveries you handled. You can dispute any open complaint.
        </Text>
      </View>
      {complaints.map((c, i) => (
        <ComplaintCard key={c.id} complaint={c} idx={i} />
      ))}
    </ScrollView>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
type MainTab = 'new' | 'mine' | 'complaints';

const RiderSupportScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTab>('new');

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
          style={[styles.tabBtn, mainTab === 'new' && styles.tabBtnActive]}
          onPress={() => { haptic(); setMainTab('new'); }}
          activeOpacity={0.8}
        >
          <Plus size={13} color={mainTab === 'new' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, mainTab === 'new' && styles.tabTextActive]}>New</Text>
        </BouncingButton>
        <BouncingButton
          style={[styles.tabBtn, mainTab === 'mine' && styles.tabBtnActive]}
          onPress={() => {
            haptic();
            setMainTab('mine');
            queryClient.invalidateQueries({ queryKey: ['rider-support-tickets'] });
          }}
          activeOpacity={0.8}
        >
          <MessageSquare size={13} color={mainTab === 'mine' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, mainTab === 'mine' && styles.tabTextActive]}>My Tickets</Text>
        </BouncingButton>
        <BouncingButton
          style={[styles.tabBtn, mainTab === 'complaints' && styles.tabBtnActive]}
          onPress={() => {
            haptic();
            setMainTab('complaints');
            queryClient.invalidateQueries({ queryKey: ['rider-complaints'] });
          }}
          activeOpacity={0.8}
        >
          <AlertTriangle size={13} color={mainTab === 'complaints' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, mainTab === 'complaints' && styles.tabTextActive]}>Complaints</Text>
        </BouncingButton>
      </View>

      {mainTab === 'new' && (
        <NewRiderTicketTab
          onSuccess={() => {
            setMainTab('mine');
            queryClient.invalidateQueries({ queryKey: ['rider-support-tickets'] });
          }}
        />
      )}
      {mainTab === 'mine' && <MyRiderTicketsTab />}
      {mainTab === 'complaints' && <ComplaintsTab />}
    </View>
  );
};

export default RiderSupportScreen;

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
    gap: 5, paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  tabBtnActive: { backgroundColor: colors.primaryTint },
  tabText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.inkMuted },
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

  // Earnings link section
  linkOrderSection: {
    backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
  },
  linkOrderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 0,
  },
  linkOrderBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary,
  },
  linkOrderBtnText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.primary },
  linkedOrderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: colors.primaryTint, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  linkedOrderText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.primary },
  unlinkText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.danger },
  noOrdersText: {
    fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkFaint,
    marginTop: 8, textAlign: 'center',
  },
  orderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  orderChipText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.ink },

  // Earnings breakdown
  earningsCard: {
    backgroundColor: colors.white, borderRadius: 14,
    padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  earningsTitle: {
    fontSize: 13, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 10,
  },
  earningsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 3,
  },
  earningsLabel: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted },
  earningsValue: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.ink },
  earningsDivider: {
    height: 1, backgroundColor: colors.border, marginVertical: 8,
  },
  earningsNet: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.ink },
  earningsNetValue: { fontSize: 15, fontFamily: fontFamily.extrabold, color: colors.primary },

  // Submit
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    marginTop: 16,
  },
  submitBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.white },
  respondBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
  },

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
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleSupport: { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleSender: {
    fontSize: 10, fontFamily: fontFamily.bold, color: colors.inkMuted,
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  bubbleText: {
    fontSize: 13, fontFamily: fontFamily.regular, color: colors.ink, lineHeight: 19,
  },
  bubbleTextUser: { color: colors.white },
  bubbleTime: {
    fontSize: 10, fontFamily: fontFamily.regular,
    color: colors.inkFaint, marginTop: 4, textAlign: 'right',
  },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)' },
  systemMsgWrap: { alignItems: 'center', paddingVertical: 4 },
  systemMsg: {
    fontSize: 11, fontFamily: fontFamily.regular, color: colors.inkFaint,
    fontStyle: 'italic', textAlign: 'center',
  },

  // Resolution / success
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
  successBox: {
    backgroundColor: colors.successTint, borderRadius: 12, padding: 12,
    marginTop: 10, borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  successText: {
    fontSize: 13, fontFamily: fontFamily.regular, color: '#065F46', lineHeight: 19,
  },

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

  // Complaints note
  complaintsNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  complaintsNoteText: {
    flex: 1, fontSize: 12, fontFamily: fontFamily.regular, color: '#92400E', lineHeight: 18,
  },

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
