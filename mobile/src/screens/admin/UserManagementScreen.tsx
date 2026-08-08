import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { SkeletonScreenList, SkeletonListItem } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Users, 
  Search, 
  UserCheck, 
  UserX, 
  Phone, 
  Calendar,
  ShieldAlert,
  ChevronRight,
  ShieldCheck
} from 'lucide-react-native';
import { useFeedback } from '../../context/FeedbackContext';
import { tokens } from '../../theme/tokens';

const UserManagementScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => api.get(roleFilter === 'all' ? '/admin/users' : `/admin/users?role=${roleFilter}`),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => 
      api.patch(`/admin/users/${id}/status`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showDialog({ title: 'Status Updated', message: 'User access permissions have been modified.', confirmText: 'Okay', type: 'success' });
    },
  });

  const verifyRiderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/verify`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showDialog({ title: 'Pilot Verified', message: 'Rider has been authorized for missions.', confirmText: 'Okay', type: 'success' });
    },
  });

  const users = data?.users || [];
  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const RoleBadge = ({ role }: { role: string }) => {
    const roleConfigs: any = {
      customer: { bg: '#eff6ff', text: '#2563eb', border: '#dbeafe' },
      rider: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
      chef: { bg: '#fffbeb', text: '#d97706', border: '#fef3c7' },
      super_admin: { bg: '#fef2f2', text: '#dc2626', border: '#fee2e2' }
    };
    const config = roleConfigs[role] || { bg: '#f9fafb', text: '#6b7280', border: '#f3f4f6' };
    
    return (
      <View style={[styles.roleBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
        <Text style={[styles.roleBadgeText, { color: config.text }]}>{role.replace('_', ' ')}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
             <Text style={styles.headerSub}>Directory</Text>
             <Text style={styles.headerTitle}>User Management</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#9CA3AF" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Role Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'customer', 'rider', 'chef'].map((r) => (
            <TouchableOpacity 
              key={r}
              onPress={() => setRoleFilter(r)}
              style={[styles.filterButton, { backgroundColor: roleFilter === r ? '#1A1A2E' : tokens.colors.surface, borderColor: roleFilter === r ? '#1A1A2E' : '#f3f4f6' }]}
            >
              <Text style={[styles.filterButtonText, { color: roleFilter === r ? tokens.colors.surface : '#9ca3af' }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredUsers.map((user: any) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.cardHeader}>
               <View style={styles.cardHeaderLeft}>
                  <View style={styles.nameRow}>
                     <Text style={styles.userName}>{user.name}</Text>
                     <RoleBadge role={user.role} />
                  </View>
                  <View style={styles.phoneRow}>
                     <Phone size={10} color="#9CA3AF" />
                     <Text style={styles.phoneText}>+{user.phone}</Text>
                  </View>
               </View>
               <View style={styles.cardHeaderRight}>
                 <View style={[styles.statusTag, { backgroundColor: user.is_active ? 'rgba(0, 208, 132, 0.1)' : 'rgba(255, 75, 75, 0.1)' }]}>
                    <Text style={[styles.statusTagText, { color: user.is_active ? '#00D084' : '#FF4B4B' }]}>
                      {user.is_active ? 'Active' : 'Banned'}
                    </Text>
                 </View>
                 {user.role === 'rider' && (
                   <View style={[styles.verifyTag, { backgroundColor: user.is_verified ? '#eff6ff' : '#fffbeb' }]}>
                     <Text style={[styles.verifyTagText, { color: user.is_verified ? '#2563eb' : '#d97706' }]}>
                       {user.is_verified ? 'Verified' : 'Unverified'}
                     </Text>
                   </View>
                 )}
               </View>
            </View>

            {user.role === 'rider' && !user.is_verified && (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => {
                  showDialog({
                    title: 'Verify Pilot',
                    message: `Authorize ${user.name} to start taking missions?`,
                    confirmText: 'Verify',
                    cancelText: 'Cancel',
                    type: 'info',
                    onConfirm: () => verifyRiderMutation.mutate(user.id)
                  });
                }}
                style={styles.verifyButton}
              >
                <ShieldCheck size={16} color="#00D084" />
                <Text style={styles.verifyButtonText}>Approve Pilot Onboarding</Text>
              </TouchableOpacity>
            )}

            <View style={styles.metaRow}>
               <Calendar size={10} color="#999" />
               <Text style={styles.metaText}>Member since {new Date(user.created_at).toLocaleDateString()}</Text>
            </View>

            <View style={styles.actionRow}>
               <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => {
                    showDialog({
                      title: user.is_active ? 'Restrict Access' : 'Restore Access',
                      message: user.is_active 
                        ? `Suspend ${user.name}'s account?` 
                        : `Restore access for ${user.name}?`,
                      confirmText: 'Confirm',
                      cancelText: 'Cancel',
                      type: user.is_active ? 'warning' : 'info',
                      onConfirm: () => toggleStatusMutation.mutate({ id: user.id, is_active: !user.is_active })
                    });
                  }}
                  style={[styles.statusButton, { backgroundColor: user.is_active ? 'rgba(255, 75, 75, 0.05)' : 'rgba(0, 208, 132, 0.05)', borderColor: user.is_active ? 'rgba(255, 75, 75, 0.1)' : 'rgba(0, 208, 132, 0.1)' }]}
               >
                  {user.is_active ? <UserX size={16} color="#FF4B4B" /> : <UserCheck size={16} color="#00D084" />}
                  <Text style={[styles.statusButtonText, { color: user.is_active ? '#FF4B4B' : '#00D084' }]}>
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('UserDetail', { userId: user.id })}
                  style={styles.detailButton}
               >
                  <ChevronRight size={18} color="#9CA3AF" />
               </TouchableOpacity>
            </View>
          </View>
        ))}

        {filteredUsers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Users size={60} color="#D1D5DB" strokeWidth={1} />
            <Text style={styles.emptyText}>No Records Found</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
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
  searchBar: {
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    height: 56,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontWeight: '700',
    color: '#1A1A2E',
    fontSize: 14,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  userCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    ...tokens.shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
    marginRight: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusTagText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  verifyTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifyTagText: {
    fontSize: 6,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  verifyButton: {
    backgroundColor: 'rgba(0, 208, 132, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    opacity: 0.4,
  },
  metaText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    paddingTop: 16,
  },
  statusButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  statusButtonText: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 8,
  },
  detailButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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

export default UserManagementScreen;
