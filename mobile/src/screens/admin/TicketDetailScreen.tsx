import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Send, 
  User, 
  MessageSquare, 
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react-native';

const TicketDetailScreen = ({ route, navigation }: any) => {
  const { ticketId } = route.params;
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState('');

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['admin-ticket-detail', ticketId],
    queryFn: () => api.get(`/admin/support/tickets`), // Using shared list for now, ideally single endpoint
    select: (data) => data.tickets?.find((t: any) => t.id === ticketId)
  });

  const resolveMutation = useMutation({
    mutationFn: (res: string) => api.post(`/admin/support/tickets/${ticketId}/resolve`, { resolution: res }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      Alert.alert('Resolved', 'Ticket has been marked as resolved.');
      navigation.goBack();
    },
  });

  if (isLoading || !ticketData) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const t = ticketData;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
           <Text style={styles.headerSub}>Ticket Control</Text>
           <Text style={styles.headerTitle}>Resolution View</Text>
        </View>
        <View style={[styles.statusBadge, t.status === 'open' ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
           <Text style={[styles.statusText, t.status === 'open' ? styles.statusTextOpen : styles.statusTextClosed]}>{t.status}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Customer Info */}
          <View style={styles.customerCard}>
             <View style={styles.customerIconWrapper}>
                <User size={22} color="#1A1A2E" />
             </View>
             <View>
                <Text style={styles.customerCardLabel}>Customer Identity</Text>
                <Text style={styles.customerCardValue}>{t.customer_name}</Text>
             </View>
          </View>

          {/* Issue Content */}
          <View style={styles.issueSection}>
            <View style={styles.sectionHeader}>
               <MessageSquare size={14} color="#FF6B35" />
               <Text style={styles.sectionLabel}>Reported Incident</Text>
            </View>
            <View style={styles.issueCard}>
               <Text style={styles.subjectText}>{t.subject}</Text>
               <Text style={styles.descriptionText}>{t.description || 'No detailed description provided.'}</Text>
               <View style={styles.issueFooter}>
                  <Clock size={12} color="#9CA3AF" />
                  <Text style={styles.filedDate}>Filed on {new Date(t.created_at).toLocaleString()}</Text>
               </View>
            </View>
          </View>

          {/* Resolution Input */}
          {t.status === 'open' ? (
            <View style={styles.resolutionSection}>
              <View style={styles.sectionHeader}>
                 <ShieldCheck size={14} color="#FF6B35" />
                 <Text style={styles.sectionLabel}>Resolution Protocol</Text>
              </View>
              <TextInput
                style={styles.resolutionInput}
                placeholder="Document the resolution steps..."
                placeholderTextColor="#C1C1C1"
                multiline
                textAlignVertical="top"
                value={resolution}
                onChangeText={setResolution}
              />
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => resolveMutation.mutate(resolution)}
                disabled={!resolution || resolveMutation.isPending}
                style={[styles.resolveBtn, !resolution ? styles.resolveBtnDisabled : styles.resolveBtnEnabled]}
              >
                 <Send size={18} color="white" />
                 <Text style={styles.resolveBtnText}>Close Ticket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resolvedBox}>
               <View style={styles.sectionHeader}>
                  <CheckCircle2 size={18} color="#00D084" />
                  <Text style={styles.resolvedLabel}>Case Resolved</Text>
               </View>
               <Text style={styles.resolutionText}>"{t.resolution}"</Text>
               <Text style={styles.closedDate}>Closed on {new Date(t.resolved_at).toLocaleString()}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    alignItems: 'center',
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
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusBadgeOpen: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(0, 208, 132, 0.1)',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  statusTextOpen: {
    color: '#EF4444',
  },
  statusTextClosed: {
    color: '#00D084',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 100,
  },
  customerCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  customerCardLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  customerCardValue: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
  },
  issueSection: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  issueCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 24,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  subjectText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 20,
    marginBottom: 16,
    lineHeight: 28,
  },
  descriptionText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 24,
  },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  filedDate: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  resolutionSection: {
    marginBottom: 80,
  },
  resolutionInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    minHeight: 120,
  },
  resolveBtn: {
    height: 80,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  resolveBtnEnabled: {
    backgroundColor: '#1A1A2E',
  },
  resolveBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  resolveBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginLeft: 16,
  },
  resolvedBox: {
    backgroundColor: 'rgba(0, 208, 132, 0.05)',
    padding: 32,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.1)',
    marginBottom: 80,
  },
  resolvedLabel: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 12,
  },
  resolutionText: {
    color: '#4B5563',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  closedDate: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 24,
  },
});

export default TicketDetailScreen;
