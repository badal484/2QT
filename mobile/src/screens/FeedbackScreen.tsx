import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Star, MessageSquare } from 'lucide-react-native';

const G = {
  bg: '#070707',
  card: '#111111',
  border: 'rgba(255,255,255,0.07)',
  faint: 'rgba(255,255,255,0.05)',
  amber: '#F59E0B',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.2)',
};

const FeedbackScreen = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-feedback'],
    queryFn: () => api.get('/kitchen/feedback'),
  });

  const avg = parseFloat(data?.averageRating || '0');
  const total = data?.feedbacks?.length || 0;

  const StarRow = ({ rating, size = 16 }: { rating: number; size?: number }) => (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={G.amber}
          fill={i <= rating ? G.amber : 'transparent'}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Text style={styles.headerSub}>PERFORMANCE</Text>
          <Text style={styles.headerTitle}>Ratings</Text>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={G.amber} size="large" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Big score */}
          <View style={styles.scoreCard}>
            <Text style={styles.scoreNum}>{avg.toFixed(1)}</Text>
            <StarRow rating={Math.round(avg)} size={22} />
            <Text style={styles.scoreTotal}>
              {total === 0 ? 'No reviews yet' : `Based on ${total} review${total === 1 ? '' : 's'}`}
            </Text>

            {/* Distribution bars */}
            {total > 0 && (
              <View style={styles.distGrid}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = data?.feedbacks?.filter((f: any) => f.rating === star).length || 0;
                  const pct = total > 0 ? count / total : 0;
                  return (
                    <View key={star} style={styles.distRow}>
                      <Text style={styles.distStar}>{star}</Text>
                      <Star size={9} color={G.amber} fill={G.amber} />
                      <View style={styles.distTrack}>
                        <View style={[styles.distFill, { width: `${pct * 100}%` as any }]} />
                      </View>
                      <Text style={styles.distCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Reviews */}
          {total > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <MessageSquare size={12} color={G.muted} />
                <Text style={styles.sectionLabel}>REVIEWS</Text>
              </View>
              {data.feedbacks.map((fb: any) => (
                <View key={fb.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <StarRow rating={fb.rating} size={14} />
                    <Text style={styles.reviewDate}>
                      {new Date(fb.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={styles.reviewOrder}>Order #{fb.order_display_id}</Text>
                  {fb.comment ? (
                    <Text style={styles.reviewComment}>"{fb.comment}"</Text>
                  ) : (
                    <Text style={styles.reviewNoComment}>No comment left</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {total === 0 && (
            <View style={styles.empty}>
              <Star size={40} color={G.muted} strokeWidth={1} />
              <Text style={styles.emptyText}>No feedback yet</Text>
              <Text style={styles.emptySubText}>Reviews will appear here after orders are delivered</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  safeTop: { backgroundColor: G.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: G.faint,
  },
  headerSub: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4, marginBottom: 4 },
  headerTitle: { color: G.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 24 },

  scoreCard: {
    backgroundColor: G.card, borderRadius: 24, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: G.border, marginBottom: 28,
  },
  scoreNum: { color: G.white, fontSize: 72, fontWeight: '900', letterSpacing: -3, lineHeight: 80, marginBottom: 8 },
  scoreTotal: { color: G.muted, fontSize: 11, fontWeight: '700', marginTop: 10 },
  distGrid: { width: '100%', marginTop: 24, gap: 8 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distStar: { color: G.dim, fontSize: 11, fontWeight: '900', width: 10 },
  distTrack: { flex: 1, height: 4, backgroundColor: G.faint, borderRadius: 2 },
  distFill: { height: 4, backgroundColor: G.amber, borderRadius: 2 },
  distCount: { color: G.muted, fontSize: 10, fontWeight: '700', width: 18, textAlign: 'right' },

  section: {},
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionLabel: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4 },

  reviewCard: {
    backgroundColor: G.card, borderRadius: 18, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: G.border,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewDate: { color: G.muted, fontSize: 10, fontWeight: '700' },
  reviewOrder: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  reviewComment: { color: G.dim, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  reviewNoComment: { color: G.muted, fontSize: 12, fontStyle: 'italic' },

  empty: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: G.muted, fontSize: 16, fontWeight: '900' },
  emptySubText: { color: G.muted, fontSize: 12, fontWeight: '500', textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
});

export default FeedbackScreen;
