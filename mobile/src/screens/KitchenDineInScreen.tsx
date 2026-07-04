import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Alert, Modal,
  Image, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Users, CheckCircle, ChefHat, Receipt, QrCode, X, LogOut, Plus, Minus, UtensilsCrossed, Zap } from 'lucide-react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { api } from '../api/client';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';

const G = {
  bg: '#070707',
  surface: '#111111',
  card: '#181818',
  border: 'rgba(255,255,255,0.07)',
  green: '#00D084',
  amber: '#F59E0B',
  red: '#EF4444',
  blue: '#3B82F6',
  inkDim: 'rgba(255,255,255,0.45)',
  ink: '#FFFFFF',
} as const;

const TABS = ['Today', 'Tickets', 'Bill'] as const;
type KTab = typeof TABS[number];

const pad = (n: number) => String(n).padStart(2, '0');

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: G.green,
  seated: G.blue,
  completed: G.inkDim,
  cancelled: G.red,
  no_show: G.red,
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Done',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KitchenDineInScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const userRole = useSelector((state: RootState) => state.auth.user?.role);
  const isDineInStaff = userRole === 'dine_in_staff';
  const [activeTab, setActiveTab] = useState<KTab>('Today');
  const [refreshing, setRefreshing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const scanLocked = useRef(false);
  const cameraDevice = useCameraDevice('back');

  // Staff order state
  const [staffOrderBooking, setStaffOrderBooking] = useState<any>(null);
  const [staffOrderItems, setStaffOrderItems] = useState<Record<string, number>>({});
  const [staffOrderSearch, setStaffOrderSearch] = useState('');
  const [skipKitchen, setSkipKitchen] = useState(false);

  // All bookings for own restaurant today
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['kitchen-dine-in-today'],
    queryFn: () => api.get('/kitchen/dine-in/today'),
    refetchInterval: 30000,
  });

  // Pending pre-order tickets (items to prepare)
  const { data: preTickets = [], isLoading: preLoading } = useQuery({
    queryKey: ['kitchen-dine-in-tickets', 'pre'],
    queryFn: () => api.get('/kitchen/dine-in/tickets?type=pre'),
    refetchInterval: 15000,
    enabled: activeTab === 'Tickets',
  });

  // Pending post-order tickets
  const { data: postTickets = [], isLoading: postLoading } = useQuery({
    queryKey: ['kitchen-dine-in-tickets', 'post'],
    queryFn: () => api.get('/kitchen/dine-in/tickets?type=post'),
    refetchInterval: 15000,
    enabled: activeTab === 'Tickets',
  });

  // Seated bookings needing bill
  const { data: billBookings = [], isLoading: billLoading } = useQuery({
    queryKey: ['kitchen-dine-in-bill'],
    queryFn: () => api.get('/kitchen/dine-in/bill'),
    refetchInterval: 20000,
    enabled: activeTab === 'Bill',
  });

  const markItemMutation = useMutation({
    mutationFn: ({ bookingId, itemId, status }: { bookingId: string; itemId: string; status: string }) =>
      api.post(`/table-bookings/${bookingId}/item-status`, { itemId, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-tickets'] });
    },
    onError: () => Alert.alert('Error', 'Failed to update item status.'),
  });

  const checkinMutation = useMutation({
    mutationFn: (bookingId: string) => api.post(`/table-bookings/${bookingId}/checkin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-today'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Check-in failed.'),
  });

  const noShowMutation = useMutation({
    mutationFn: (bookingId: string) => api.post(`/table-bookings/${bookingId}/no-show`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-today'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed.'),
  });

  const { data: staffMenuItems = [] } = useQuery({
    queryKey: ['staff-order-menu', staffOrderBooking?.restaurant_id],
    queryFn: () => api.get(`/restaurants/${staffOrderBooking.restaurant_id}/menu`).then((r: any) => r.items as any[]),
    enabled: !!staffOrderBooking?.restaurant_id,
  });

  const filteredStaffMenu = useMemo(() => {
    if (!staffOrderSearch.trim()) return staffMenuItems;
    const q = staffOrderSearch.toLowerCase();
    return staffMenuItems.filter((i: any) => i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
  }, [staffMenuItems, staffOrderSearch]);

  const staffOrderTotal = useMemo(() =>
    staffMenuItems.reduce((sum: number, item: any) => sum + (staffOrderItems[item.id] || 0) * item.price_paise, 0),
    [staffMenuItems, staffOrderItems]);

  const staffOrderMutation = useMutation({
    mutationFn: ({ bookingId, items, skip }: { bookingId: string; items: any[]; skip: boolean }) =>
      api.post(`/table-bookings/${bookingId}/post-order`, { items, skipKitchen: skip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-bill'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-tickets'] });
      setStaffOrderBooking(null);
      setStaffOrderItems({});
      setStaffOrderSearch('');
      setSkipKitchen(false);
      Alert.alert('Done', skipKitchen ? 'Items added directly to bill.' : 'Order sent to kitchen.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to add items.'),
  });

  const handleStaffOrder = () => {
    const items = Object.entries(staffOrderItems)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (!items.length) { Alert.alert('No Items', 'Add at least one item.'); return; }
    staffOrderMutation.mutate({ bookingId: staffOrderBooking.id, items, skip: skipKitchen });
  };

  const markPaidMutation = useMutation({
    mutationFn: ({ bookingId, method }: { bookingId: string; method: string }) =>
      api.post(`/table-bookings/${bookingId}/mark-paid`, { paymentMethod: method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-bill'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in-today'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed.'),
  });

  useEffect(() => {
    Camera.requestCameraPermission();
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (scanLocked.current) return;
      const value = codes[0]?.value;
      if (!value || !UUID_REGEX.test(value)) return;
      scanLocked.current = true;
      setScannerVisible(false);
      checkinMutation.mutate(value, {
        onSettled: () => { scanLocked.current = false; },
        onSuccess: () => Alert.alert('Checked In', 'Guest has been checked in successfully.'),
      });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['kitchen-dine-in'] });
    setRefreshing(false);
  };

  const handleMarkPaid = (bookingId: string, displayId: string) => {
    Alert.alert(
      `Mark ${displayId} as Paid`,
      'Select payment method:',
      [
        { text: 'Cash', onPress: () => markPaidMutation.mutate({ bookingId, method: 'cash' }) },
        { text: 'Card / POS', onPress: () => markPaidMutation.mutate({ bookingId, method: 'card_pos' }) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const allTickets = [...preTickets, ...postTickets];
  const isTicketsLoading = preLoading || postLoading;

  // Stats summary
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const seated = bookings.filter((b: any) => b.status === 'seated').length;
  const completed = bookings.filter((b: any) => b.status === 'completed').length;
  const totalRevenue = bookings
    .filter((b: any) => b.status === 'completed')
    .reduce((sum: number, b: any) => sum + (b.total_paid_paise || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* QR Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerModal}>
          <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
            <X size={24} color={G.ink} />
          </TouchableOpacity>
          <Text style={styles.scannerTitle}>Scan Guest QR Code</Text>
          <Text style={styles.scannerSub}>Point at the customer's booking QR code to check them in</Text>
          {cameraDevice ? (
            <Camera
              device={cameraDevice}
              isActive={scannerVisible}
              codeScanner={codeScanner}
              style={styles.cameraView}
            />
          ) : (
            <View style={[styles.cameraView, styles.cameraFallback]}>
              <Text style={styles.scannerSub}>Camera not available</Text>
            </View>
          )}
          <View style={styles.scannerFrame} pointerEvents="none" />
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <ChefHat size={20} color={G.green} />
        <Text style={styles.headerTitle}>Dine-In</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.scanQrBtn} onPress={() => setScannerVisible(true)}>
            <QrCode size={18} color={G.green} />
            <Text style={styles.scanQrText}>Scan QR</Text>
          </TouchableOpacity>
          {isDineInStaff && (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() =>
                Alert.alert('Log Out', 'Are you sure you want to log out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log Out', style: 'destructive', onPress: () => dispatch(logout()) },
                ])
              }
            >
              <LogOut size={18} color={G.red} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TODAY TAB ── */}
      {activeTab === 'Today' && (
        <>
          {/* Summary row */}
          <View style={styles.statsRow}>
            <StatChip label="Upcoming" value={confirmed} color={G.green} />
            <StatChip label="Seated" value={seated} color={G.blue} />
            <StatChip label="Done" value={completed} color={G.inkDim} />
            <StatChip label="Revenue" value={`₹${(totalRevenue / 100).toFixed(0)}`} color={G.green} isStr />
          </View>

          {bookingsLoading ? (
            <ActivityIndicator color={G.green} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={bookings}
              keyExtractor={(b: any) => b.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={G.green} />}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No bookings today</Text>
                </View>
              }
              renderItem={({ item: b }: any) => (
                <View style={styles.bookingCard}>
                  <View style={styles.bookingCardRow}>
                    <Text style={styles.bookingRef}>{b.display_id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[b.status] || G.inkDim) + '22' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] || G.inkDim }]}>
                        {STATUS_LABELS[b.status] || b.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bookingCustomer}>{b.customer_name || 'Guest'}</Text>
                  <View style={styles.bookingMeta}>
                    <View style={styles.metaChip}>
                      <Clock size={12} color={G.inkDim} />
                      <Text style={styles.metaText}>{formatTime(b.slot_start)} – {formatTime(b.slot_end)}</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Users size={12} color={G.inkDim} />
                      <Text style={styles.metaText}>{b.party_size}</Text>
                    </View>
                    {b.table_number && (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaText}>Table {b.table_number}</Text>
                      </View>
                    )}
                  </View>
                  {b.pre_order_amount_paise > 0 && (
                    <Text style={styles.preOrderTag}>
                      Pre-ordered · ₹{(b.pre_order_amount_paise / 100).toFixed(0)}
                    </Text>
                  )}
                  {b.occasion && (
                    <Text style={styles.occasionTag}>{b.occasion}</Text>
                  )}
                  {/* Action buttons for confirmed bookings */}
                  {b.status === 'confirmed' && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.checkinBtn}
                        onPress={() => checkinMutation.mutate(b.id)}
                        disabled={checkinMutation.isPending}
                      >
                        <Text style={styles.checkinBtnText}>✓ Check In</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.noShowBtn}
                        onPress={() =>
                          Alert.alert('Mark No-Show', `Mark ${b.display_id} as no-show?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'No-Show', style: 'destructive', onPress: () => noShowMutation.mutate(b.id) },
                          ])
                        }
                        disabled={noShowMutation.isPending}
                      >
                        <Text style={styles.noShowBtnText}>No Show</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </>
      )}

      {/* ── TICKETS TAB ── */}
      {activeTab === 'Tickets' && (
        <>
          {isTicketsLoading ? (
            <ActivityIndicator color={G.green} style={{ marginTop: 40 }} />
          ) : allTickets.length === 0 ? (
            <View style={styles.emptyWrap}>
              <CheckCircle size={48} color={G.green} strokeWidth={1} />
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubText}>No pending items to prepare.</Text>
            </View>
          ) : (
            <FlatList
              data={allTickets}
              keyExtractor={(t: any) => t.booking_id + t.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={G.green} />}
              renderItem={({ item: ticket }: any) => (
                <View style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketRef}>{ticket.display_id}</Text>
                    <View style={[styles.ticketTypeBadge, { backgroundColor: ticket.type === 'pre' ? G.green + '22' : G.blue + '22' }]}>
                      <Text style={[styles.ticketTypeText, { color: ticket.type === 'pre' ? G.green : G.blue }]}>
                        {ticket.type === 'pre' ? 'Pre-Order' : 'Post-Order'}
                      </Text>
                    </View>
                  </View>
                  {ticket.table_number && (
                    <Text style={styles.ticketTable}>Table {ticket.table_number}</Text>
                  )}
                  {ticket.items?.map((item: any) => (
                    <View key={item.id} style={styles.ticketItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ticketItemName}>{item.name} × {item.quantity}</Text>
                        {item.special_note && <Text style={styles.ticketItemNote}>{item.special_note}</Text>}
                      </View>
                      {item.status !== 'served' && (
                        <TouchableOpacity
                          style={[styles.markBtn, item.status === 'preparing' && styles.markBtnServe]}
                          onPress={() => markItemMutation.mutate({
                            bookingId: ticket.booking_id,
                            itemId: item.id,
                            status: item.status === 'pending' ? 'preparing' : 'served',
                          })}
                        >
                          <Text style={styles.markBtnText}>
                            {item.status === 'pending' ? 'Preparing' : 'Served'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {item.status === 'served' && (
                        <View style={styles.servedBadge}>
                          <CheckCircle size={14} color={G.green} />
                          <Text style={styles.servedText}>Served</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            />
          )}
        </>
      )}

      {/* ── BILL TAB ── */}
      {activeTab === 'Bill' && (
        <>
          {billLoading ? (
            <ActivityIndicator color={G.green} style={{ marginTop: 40 }} />
          ) : billBookings.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Receipt size={48} color={G.inkDim} strokeWidth={1} />
              <Text style={styles.emptyText}>No open bills</Text>
              <Text style={styles.emptySubText}>Seated tables with outstanding balance will appear here.</Text>
            </View>
          ) : (
            <FlatList
              data={billBookings}
              keyExtractor={(b: any) => b.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={G.green} />}
              renderItem={({ item: b }: any) => (
                <View style={styles.billCard}>
                  <View style={styles.billCardHeader}>
                    <Text style={styles.billRef}>{b.display_id}</Text>
                    {b.table_number && <Text style={styles.billTable}>Table {b.table_number}</Text>}
                  </View>
                  <Text style={styles.billCustomer}>{b.customer_name || 'Guest'} · {b.party_size} guests</Text>

                  <View style={styles.billAmountRow}>
                    <BillLine label="Pre-order" value={`₹${((b.pre_order_amount_paise || 0) / 100).toFixed(0)}`} />
                    <BillLine label="Post-order" value={`₹${((b.post_order_amount_paise || 0) / 100).toFixed(0)}`} />
                    <BillLine label="GST" value={`₹${((b.gst_amount_paise || 0) / 100).toFixed(0)}`} />
                    <BillLine label="Paid" value={`-₹${((b.total_paid_paise || 0) / 100).toFixed(0)}`} color={G.green} />
                    <View style={styles.billDivider} />
                    <BillLine
                      label="Outstanding"
                      value={`₹${(((b.pre_order_amount_paise + b.post_order_amount_paise + b.gst_amount_paise) - b.total_paid_paise) / 100).toFixed(0)}`}
                      bold color={G.amber}
                    />
                  </View>

                  <View style={styles.billActions}>
                    <TouchableOpacity
                      style={styles.addItemStaffBtn}
                      onPress={() => { setStaffOrderBooking(b); setStaffOrderItems({}); setSkipKitchen(false); }}
                    >
                      <Plus size={15} color={G.blue} />
                      <Text style={styles.addItemStaffText}>Add Item</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cashBtn}
                      onPress={() => handleMarkPaid(b.id, b.display_id)}
                      disabled={markPaidMutation.isPending}
                    >
                      <Text style={styles.cashBtnText}>Mark Paid</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </>
      )}

      {/* ── Staff Order Modal ── */}
      <Modal
        visible={!!staffOrderBooking}
        animationType="slide"
        onRequestClose={() => { setStaffOrderBooking(null); setStaffOrderItems({}); setStaffOrderSearch(''); }}
      >
        <View style={[styles.soModal, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.soHeader}>
            <TouchableOpacity onPress={() => { setStaffOrderBooking(null); setStaffOrderItems({}); setStaffOrderSearch(''); }} style={styles.soCloseBtn}>
              <X size={22} color={G.ink} />
            </TouchableOpacity>
            <View>
              <Text style={styles.soTitle}>Add Items</Text>
              <Text style={styles.soSub}>{staffOrderBooking?.display_id} · Table {staffOrderBooking?.table_number}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Kitchen / Direct toggle */}
          <View style={styles.soToggleRow}>
            <TouchableOpacity
              style={[styles.soToggleBtn, !skipKitchen && styles.soToggleBtnActive]}
              onPress={() => setSkipKitchen(false)}
            >
              <UtensilsCrossed size={14} color={!skipKitchen ? G.bg : G.inkDim} />
              <Text style={[styles.soToggleText, !skipKitchen && styles.soToggleTextActive]}>Via Kitchen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.soToggleBtn, skipKitchen && styles.soToggleBtnDirect]}
              onPress={() => setSkipKitchen(true)}
            >
              <Zap size={14} color={skipKitchen ? G.bg : G.inkDim} />
              <Text style={[styles.soToggleText, skipKitchen && styles.soToggleTextActive]}>Direct to Bill</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.soToggleHint}>
            {skipKitchen
              ? 'Item goes straight to bill — no kitchen ticket (use for drinks, packaged items)'
              : 'Item appears in Kitchen Tickets for preparation'}
          </Text>

          {/* Search */}
          <View style={styles.soSearchWrap}>
            <TextInput
              style={styles.soSearchInput}
              placeholder="Search dishes…"
              placeholderTextColor={G.inkDim}
              value={staffOrderSearch}
              onChangeText={setStaffOrderSearch}
              returnKeyType="search"
            />
          </View>

          {/* Menu list */}
          <FlatList
            data={filteredStaffMenu}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={styles.soListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={styles.emptyWrap}><Text style={styles.emptySubText}>No items found</Text></View>}
            renderItem={({ item }: any) => {
              const qty = staffOrderItems[item.id] || 0;
              return (
                <View style={styles.soItemCard}>
                  {item.photo_url
                    ? <Image source={{ uri: item.photo_url }} style={styles.soItemImg} resizeMode="cover" />
                    : <View style={[styles.soItemImg, styles.soItemImgFallback]}><Text style={{ fontSize: 22 }}>🍽️</Text></View>
                  }
                  <View style={styles.soItemInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[styles.vegDot, { backgroundColor: item.is_veg ? '#16A34A' : '#DC2626' }]} />
                      <Text style={styles.soItemName} numberOfLines={2}>{item.name}</Text>
                    </View>
                    <Text style={styles.soItemPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                  </View>
                  <View style={styles.soItemCtrl}>
                    {qty > 0 ? (
                      <View style={styles.soQtyRow}>
                        <TouchableOpacity style={styles.soQtyBtn} onPress={() => setStaffOrderItems(p => ({ ...p, [item.id]: Math.max(0, qty - 1) }))}>
                          <Minus size={14} color={G.green} />
                        </TouchableOpacity>
                        <Text style={styles.soQtyText}>{qty}</Text>
                        <TouchableOpacity style={styles.soQtyBtn} onPress={() => setStaffOrderItems(p => ({ ...p, [item.id]: qty + 1 }))}>
                          <Plus size={14} color={G.green} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.soAddBtn} onPress={() => setStaffOrderItems(p => ({ ...p, [item.id]: 1 }))}>
                        <Text style={styles.soAddBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />

          {/* Footer */}
          {staffOrderTotal > 0 && (
            <View style={[styles.soFooter, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[styles.soConfirmBtn, skipKitchen && styles.soConfirmBtnDirect]}
                onPress={handleStaffOrder}
                disabled={staffOrderMutation.isPending}
              >
                {staffOrderMutation.isPending
                  ? <ActivityIndicator color={G.bg} />
                  : <Text style={styles.soConfirmText}>
                      {skipKitchen ? '⚡ Add to Bill' : '🍳 Send to Kitchen'} · ₹{(staffOrderTotal / 100).toFixed(0)}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const StatChip = ({ label, value, color, isStr }: { label: string; value: number | string; color: string; isStr?: boolean }) => (
  <View style={styles.statChip}>
    <Text style={[styles.statValue, { color }]}>{isStr ? value : String(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const BillLine = ({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) => (
  <View style={styles.billLine}>
    <Text style={[styles.billLineLabel, bold && styles.billLineLabelBold]}>{label}</Text>
    <Text style={[styles.billLineValue, bold && styles.billLineValueBold, color ? { color } : {}]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  headerRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: G.red + '18', borderWidth: 1, borderColor: G.red + '40', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: fontFamily.bold, color: G.ink },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: G.border, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: G.green },
  tabText: { fontSize: 13, fontFamily: fontFamily.medium, color: G.inkDim },
  tabTextActive: { color: G.green, fontFamily: fontFamily.semibold },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: 10, gap: 8 },
  statChip: { flex: 1, backgroundColor: G.surface, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: G.border },
  statValue: { fontSize: 18, fontFamily: fontFamily.bold },
  statLabel: { fontSize: 10, fontFamily: fontFamily.medium, color: G.inkDim, marginTop: 2 },
  listContent: { padding: spacing.lg, gap: 10, paddingBottom: 40 },
  bookingCard: { backgroundColor: G.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: G.border },
  bookingCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bookingRef: { fontSize: 15, fontFamily: fontFamily.bold, color: G.ink },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: fontFamily.semibold },
  bookingCustomer: { fontSize: 13, color: G.inkDim, fontFamily: fontFamily.regular, marginBottom: 8 },
  bookingMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: G.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { fontSize: 12, color: G.inkDim, fontFamily: fontFamily.medium },
  preOrderTag: { fontSize: 12, color: G.green, fontFamily: fontFamily.medium, marginTop: 4 },
  occasionTag: { fontSize: 12, color: G.amber, fontFamily: fontFamily.medium, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  checkinBtn: { flex: 1, backgroundColor: G.green + '22', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: G.green },
  checkinBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: G.green },
  noShowBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: G.red + '60', alignItems: 'center' },
  noShowBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: G.red },
  // Tickets
  ticketCard: { backgroundColor: G.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: G.border },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketRef: { fontSize: 15, fontFamily: fontFamily.bold, color: G.ink },
  ticketTypeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ticketTypeText: { fontSize: 11, fontFamily: fontFamily.semibold },
  ticketTable: { fontSize: 12, color: G.inkDim, fontFamily: fontFamily.medium, marginBottom: 8 },
  ticketItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: G.border },
  ticketItemName: { fontSize: 14, fontFamily: fontFamily.medium, color: G.ink, marginBottom: 2 },
  ticketItemNote: { fontSize: 12, color: G.amber, fontFamily: fontFamily.regular },
  markBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: G.surface, borderWidth: 1, borderColor: G.green + '60' },
  markBtnServe: { backgroundColor: G.green + '22', borderColor: G.green },
  markBtnText: { fontSize: 12, fontFamily: fontFamily.semibold, color: G.green },
  servedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  servedText: { fontSize: 12, color: G.green, fontFamily: fontFamily.medium },
  // Bill
  billCard: { backgroundColor: G.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: G.border },
  billCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  billRef: { fontSize: 15, fontFamily: fontFamily.bold, color: G.ink },
  billTable: { fontSize: 13, color: G.green, fontFamily: fontFamily.medium },
  billCustomer: { fontSize: 13, color: G.inkDim, fontFamily: fontFamily.regular, marginBottom: 10 },
  billAmountRow: { gap: 4, marginBottom: 12 },
  billLine: { flexDirection: 'row', justifyContent: 'space-between' },
  billLineLabel: { fontSize: 13, color: G.inkDim, fontFamily: fontFamily.regular },
  billLineLabelBold: { fontFamily: fontFamily.semibold, color: G.ink },
  billLineValue: { fontSize: 13, color: G.ink, fontFamily: fontFamily.medium },
  billLineValueBold: { fontFamily: fontFamily.bold, fontSize: 15 },
  billDivider: { height: StyleSheet.hairlineWidth, backgroundColor: G.border, marginVertical: 6 },
  billActions: { flexDirection: 'row', gap: 8 },
  cashBtn: { flex: 1, backgroundColor: G.green + '22', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: G.green },
  cashBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: G.green },
  // Header scan button
  scanQrBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.green + '22', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: G.green },
  scanQrText: { fontSize: 13, fontFamily: fontFamily.semibold, color: G.green },
  // Scanner modal
  scannerModal: { flex: 1, backgroundColor: G.bg, alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 60 },
  scannerClose: { position: 'absolute', top: 52, right: spacing.lg, padding: 8 },
  scannerTitle: { fontSize: 22, fontFamily: fontFamily.bold, color: G.ink, marginBottom: 8 },
  scannerSub: { fontSize: 14, color: G.inkDim, fontFamily: fontFamily.regular, textAlign: 'center', marginBottom: 32 },
  cameraView: { width: '100%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden' },
  cameraFallback: { backgroundColor: G.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: G.border },
  scannerFrame: { position: 'absolute', top: 180, width: 220, height: 220, borderRadius: 16, borderWidth: 2, borderColor: G.green },
  // Bill — Add Item button
  addItemStaffBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: G.blue + '18', borderRadius: 10, paddingVertical: 11, borderWidth: 1, borderColor: G.blue + '50' },
  addItemStaffText: { fontSize: 13, fontFamily: fontFamily.semibold, color: G.blue },
  // Staff order modal
  soModal: { flex: 1, backgroundColor: G.bg },
  soHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: G.border },
  soCloseBtn: { width: 40, height: 40, justifyContent: 'center' },
  soTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: G.ink, textAlign: 'center' },
  soSub: { fontSize: 12, fontFamily: fontFamily.regular, color: G.inkDim, textAlign: 'center' },
  soToggleRow: { flexDirection: 'row', gap: 8, marginHorizontal: spacing.lg, marginTop: 14 },
  soToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: G.border, backgroundColor: G.surface },
  soToggleBtnActive: { backgroundColor: G.green, borderColor: G.green },
  soToggleBtnDirect: { backgroundColor: G.amber, borderColor: G.amber },
  soToggleText: { fontSize: 13, fontFamily: fontFamily.semibold, color: G.inkDim },
  soToggleTextActive: { color: G.bg },
  soToggleHint: { fontSize: 11, fontFamily: fontFamily.regular, color: G.inkDim, marginHorizontal: spacing.lg, marginTop: 6, marginBottom: 4 },
  soSearchWrap: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: G.border },
  soSearchInput: { backgroundColor: G.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: fontFamily.regular, color: G.ink, borderWidth: 1, borderColor: G.border },
  soListContent: { padding: spacing.lg, gap: 10, paddingBottom: 120 },
  soItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.card, borderRadius: 14, padding: 12, gap: 12, borderWidth: 1, borderColor: G.border },
  soItemImg: { width: 70, height: 70, borderRadius: 10 },
  soItemImgFallback: { backgroundColor: G.surface, justifyContent: 'center', alignItems: 'center' },
  soItemInfo: { flex: 1, gap: 4 },
  soItemName: { flex: 1, fontSize: 14, fontFamily: fontFamily.semibold, color: G.ink },
  soItemPrice: { fontSize: 14, fontFamily: fontFamily.bold, color: G.green },
  vegDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  soItemCtrl: { alignItems: 'center', minWidth: 76 },
  soQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: G.green, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
  soQtyBtn: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  soQtyText: { fontSize: 15, fontFamily: fontFamily.semibold, color: G.ink, minWidth: 18, textAlign: 'center' },
  soAddBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: G.green },
  soAddBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: G.green },
  soFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: G.surface, paddingHorizontal: spacing.lg, paddingTop: 12, borderTopWidth: 1, borderTopColor: G.border },
  soConfirmBtn: { backgroundColor: G.green, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  soConfirmBtnDirect: { backgroundColor: G.amber },
  soConfirmText: { fontSize: 15, fontFamily: fontFamily.semibold, color: G.bg },
  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontFamily: fontFamily.semibold, color: G.ink, marginTop: 16, marginBottom: 8 },
  emptySubText: { fontSize: 13, color: G.inkDim, fontFamily: fontFamily.regular, textAlign: 'center', paddingHorizontal: 32 },
});

export default KitchenDineInScreen;
