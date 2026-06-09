import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  CheckCircle2,
  X
} from 'lucide-react-native';

const TicketsScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => api.get('/admin/support/tickets'),
    refetchInterval: 15000,
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.headerLabelRow}>
             <View style={styles.statusDot} />
             <Text style={styles.headerSub}>Resolution Center</Text>
          </View>
          <Text style={styles.headerTitle}>Support Hub</Text>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
        >
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {data?.tickets?.map((ticket: any) => (
          <TouchableOpacity 
            key={ticket.id}
            activeOpacity={0.9}
            style={styles.ticketCard}
            onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardInfoCol}>
                 <View style={styles.subjectRow}>
                    <MessageSquare size={12} color="#FF6B35" style={{ marginRight: 8 }} />
                    <Text style={styles.subjectText} numberOfLines={1}>{ticket.subject}</Text>
                 </View>
                 <View style={styles.metaRow}>
                    <Clock size={10} color="#9CA3AF" />
                    <Text style={styles.metaText}>{ticket.customer_name} • {new Date(ticket.created_at).toLocaleDateString()}</Text>
                 </View>
              </View>
              <View style={[styles.statusBadge, ticket.status === 'open' ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
                <Text style={[styles.statusText, ticket.status === 'open' ? styles.statusTextOpen : styles.statusTextClosed]}>
                  {ticket.status}
                </Text>
              </View>
            </View>
            
            <View style={styles.messagePreview}>
               <Text style={styles.previewText} numberOfLines={2}>{ticket.last_message || 'No messages yet.'}</Text>
            </View>

            <View style={styles.cardFooter}>
               <Text style={styles.footerLabel}>Action Required</Text>
               <ChevronRight size={16} color="#D1D5DB" />
            </View>
          </TouchableOpacity>
        ))}

        {(data?.tickets?.length === 0 || !data?.tickets) && (
          <View style={styles.emptyContainer}>
            <CheckCircle2 size={60} color="#D1D5DB" strokeWidth={1} />
            <Text style={styles.emptyText}>All Tickets Resolved</Text>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  headerSub: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
  },
  closeBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  ticketCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
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
  cardInfoCol: {
    flex: 1,
    marginRight: 16,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectText: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeOpen: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(0, 208, 132, 0.1)',
    borderColor: 'rgba(0, 208, 132, 0.2)',
  },
  statusText: {
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  statusTextOpen: {
    color: '#EF4444',
  },
  statusTextClosed: {
    color: '#00D084',
  },
  messagePreview: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.5)',
  },
  previewText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  footerLabel: {
    color: '#d1d5db',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 10,
    marginTop: 24,
  },
});

export default TicketsScreen;
