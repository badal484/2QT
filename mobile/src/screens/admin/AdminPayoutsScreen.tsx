import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { IndianRupee, CheckCircle2, User, Phone, Clock } from 'lucide-react-native';

const AdminPayoutsScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pending-payouts'],
    queryFn: () => api.get('/admin/payouts/pending'),
  });

  const approveMutation = useMutation({
    mutationFn: (payoutId: string) => api.post(`/admin/payouts/${payoutId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payouts'] });
      Alert.alert('Approved', 'Payout has been marked as completed.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to approve payout');
    }
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const pendingPayouts = data?.payouts || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Financial Operations</Text>
          <Text style={styles.headerTitle}>Settlements</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pendingPayouts.length} PENDING</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {pendingPayouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CheckCircle2 size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>All clear! No pending requests.</Text>
          </View>
        ) : (
          pendingPayouts.map((payout: any) => (
            <View key={payout.id} style={styles.payoutCard}>
              <View style={styles.cardTop}>
                <View style={styles.riderInfoCol}>
                  <View style={styles.nameRow}>
                    <User size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <Text style={styles.riderName}>{payout.rider_name}</Text>
                  </View>
                  <View style={styles.phoneRow}>
                    <Phone size={12} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <Text style={styles.riderPhone}>+{payout.rider_phone}</Text>
                  </View>
                  {payout.upi_id && (
                    <View style={[styles.phoneRow, { marginTop: 4 }]}>
                      <IndianRupee size={12} color="#10B981" style={{ marginRight: 8 }} />
                      <Text style={[styles.riderPhone, { color: '#10B981' }]}>{payout.upi_id}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.amountCol}>
                   <Text style={styles.amountValue}>₹{payout.net_amount_paise / 100}</Text>
                   <Text style={styles.amountLabel}>Net Payable</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardMeta}>
                <View style={styles.dateRow}>
                  <Clock size={14} color="#D1D5DB" style={{ marginRight: 8 }} />
                  <Text style={styles.dateText}>Requested {new Date(payout.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.refBadge}>
                  <Text style={styles.refText}>Ref: {payout.id.slice(0, 8)}</Text>
                </View>
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert('Approve Payout', `Confirm settlement of ₹${payout.net_amount_paise / 100} to ${payout.rider_name} (${payout.upi_id || 'No UPI ID'})?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: () => approveMutation.mutate(payout.id) }
                  ]);
                }}
                style={styles.approveBtn}
              >
                <IndianRupee size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.approveBtnText}>Authorize Transfer</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Secure Settlement Engine</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  headerSub: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 10,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  countText: {
    color: '#92400E',
    fontWeight: '900',
    fontSize: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '700',
    marginTop: 16,
  },
  payoutCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 40,
    padding: 28,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  riderInfoCol: {
    flex: 1,
    marginRight: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  riderName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 20,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  riderPhone: {
    color: '#4b5563',
    fontWeight: '700',
    fontSize: 12,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountValue: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 24,
  },
  amountLabel: {
    color: '#9ca3af',
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f9fafb',
    width: '100%',
    marginBottom: 24,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
  },
  refBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  refText: {
    color: '#6b7280',
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  approveBtn: {
    backgroundColor: '#1A1A2E',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#d1d5db',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 5,
  },
});

export default AdminPayoutsScreen;
