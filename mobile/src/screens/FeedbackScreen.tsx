import { Star } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const FeedbackScreen = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-feedback'],
    queryFn: () => api.get('/kitchen/feedback'),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Customer Ratings</Text>
        <Text style={styles.headerSub}>Average Score: {data?.averageRating || '0.0'} ⭐</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {data?.feedbacks?.map((fb: any) => (
          <View key={fb.id} style={styles.feedbackCard}>
            <View style={styles.cardHeader}>
              <View style={styles.starsRow}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} color={i < fb.food_rating ? "#EAB308" : "#374151"} fill={i < fb.food_rating ? "#EAB308" : "none"} />
                ))}
              </View>
              <Text style={styles.dateText}>{new Date(fb.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.orderId}>Order #{fb.order_display_id}</Text>
            <Text style={styles.comment}>"{fb.comment || 'No comment provided'}"</Text>
          </View>
        ))}

        {data?.feedbacks?.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No feedback received yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 32,
    paddingBottom: 24,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  feedbackCard: {
    backgroundColor: '#1f2937',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dateText: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '700',
  },
  orderId: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  comment: {
    color: '#9ca3af',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#6b7280',
    fontWeight: '700',
  },
});

export default FeedbackScreen;
