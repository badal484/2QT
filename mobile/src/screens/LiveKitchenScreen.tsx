import React, { useEffect, useState } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, Dimensions } from 'react-native';
import { ArrowLeft, Play, ShieldCheck, Thermometer, Info, ChevronRight, UserCircle, Droplets, Utensils, X } from 'lucide-react-native';
import Animated, { FadeInDown, BounceIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { RootState } from '../store';

const { width, height } = Dimensions.get('window');
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const sampleVideo = require('./sample.mp4');

const STORIES = [
  { id: '1', title: 'Morning Prep', emoji: '🔪', video: sampleVideo },
  { id: '2', title: 'Farm Fresh', emoji: '🥬', video: sampleVideo },
  { id: '3', title: 'Sanitization', emoji: '🧼', video: sampleVideo },
  { id: '4', title: 'Packaging', emoji: '📦', video: sampleVideo },
];

const LiveKitchenScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const triggerHaptic = () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
  
  const zoneId = useSelector((state: RootState) => state.cart.zoneId);

  const { data: metricsData } = useQuery({
    queryKey: ['kitchen_metrics', zoneId],
    queryFn: () => api.get(`/menu/kitchen-metrics?zoneId=${zoneId}`),
    enabled: !!zoneId,
    refetchInterval: 30000, // Refetch every 30s
  });

  const metrics = metricsData?.metrics || {
      fssai_status: 'FSSAI Certified',
      fssai_valid_till: 'Valid \'27',
      staff_temp_value: '98.6°F Staff Temp',
      staff_temp_time: '10m ago',
      sanitization_percent: '100% Sanitized',
      sanitization_freq: 'Hourly',
      pure_veg_status: '100% Pure Veg',
      pure_veg_audited: 'Audited'
  };

  const [activeStoryVideo, setActiveStoryVideo] = useState<any>(null);

  const pulseAnim = useSharedValue(0.2);
  useEffect(() => {
      pulseAnim.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);
  
  const liveDotStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulseAnim.value }],
      opacity: 1 - pulseAnim.value
  }));

  const handleStoryPress = (videoUrl: string) => {
    triggerHaptic();
    setActiveStoryVideo(videoUrl);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* CINEMATIC LIVE STREAM PLAYER */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.videoPlayerContainer}>
          <View style={[styles.videoBackground, { backgroundColor: '#1A1A2E' }]}>
            <Video
              source={sampleVideo}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              repeat={true}
              muted={true}
              playInBackground={false}
              ignoreSilentSwitch="obey"
            />
            
            <View style={styles.videoOverlay}>
                {/* Header inside video */}
                <View style={[styles.videoHeader, { paddingTop: Math.max(insets.top + 10, 40) }]}>
                    <BouncingButton style={styles.backButton} onPress={() => { triggerHaptic(); navigation.goBack(); }}>
                        <ArrowLeft size={24} color="#FFFFFF" />
                    </BouncingButton>
                    
                    <View style={styles.liveBadgeContainer}>
                        <View style={styles.liveDotWrapper}>
                            <Animated.View style={[styles.liveDot, liveDotStyle]} />
                            <View style={styles.liveDotCore} />
                        </View>
                        <Text style={styles.liveBadgeText}>LIVE STREAM</Text>
                        <View style={styles.viewerBadge}>
                            <UserCircle size={10} color="#FFFFFF" />
                            <Text style={styles.viewerText}>1,204</Text>
                        </View>
                    </View>
                </View>

                {/* Footer inside video */}
                <View style={styles.videoFooter}>
                    <Text style={styles.kitchenName}>2QT Primary Kitchen</Text>
                    <Text style={styles.kitchenZone}>Zone A • Bangalore</Text>
                </View>
            </View>
          </View>
        </Animated.View>

        {/* INSTAGRAM-STYLE STORIES */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.storiesContainer}>
            <Text style={styles.sectionTitle}>Behind the Scenes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
                {STORIES.map((story) => (
                    <BouncingButton key={story.id} style={styles.storyItem} onPress={() => handleStoryPress(story.video)} activeOpacity={0.7}>
                        <View style={styles.storyRing}>
                            <View style={[styles.storyImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }]}>
                                <Text style={{ fontSize: 32 }}>{story.emoji}</Text>
                            </View>
                        </View>
                        <Text style={styles.storyTitle}>{story.title}</Text>
                    </BouncingButton>
                ))}
            </ScrollView>
        </Animated.View>

        {/* TRUST & HYGIENE DASHBOARD */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.dashboardContainer}>
            <Text style={styles.sectionTitle}>Hygiene & Safety</Text>
            
            <View style={styles.metricList}>
                <View style={styles.metricRow}>
                    <View style={[styles.metricIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                        <ShieldCheck size={20} color="#10B981" />
                    </View>
                    <View style={styles.metricRowInfo}>
                        <Text style={styles.metricValue}>{metrics.fssai_status}</Text>
                        <Text style={styles.metricLabel}>Top Hygiene Rating</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={styles.statusPillText}>{metrics.fssai_valid_till}</Text>
                    </View>
                </View>

                <View style={styles.metricRow}>
                    <View style={[styles.metricIconWrapper, { backgroundColor: '#FEF2F2' }]}>
                        <Thermometer size={20} color="#EF4444" />
                    </View>
                    <View style={styles.metricRowInfo}>
                        <Text style={styles.metricValue}>{metrics.staff_temp_value}</Text>
                        <Text style={styles.metricLabel}>Daily health checks</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={styles.statusPillText}>{metrics.staff_temp_time}</Text>
                    </View>
                </View>

                <View style={styles.metricRow}>
                    <View style={[styles.metricIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                        <Droplets size={20} color="#3B82F6" />
                    </View>
                    <View style={styles.metricRowInfo}>
                        <Text style={styles.metricValue}>{metrics.sanitization_percent}</Text>
                        <Text style={styles.metricLabel}>Deep cleaned surfaces</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={styles.statusPillText}>{metrics.sanitization_freq}</Text>
                    </View>
                </View>

                <View style={styles.metricRow}>
                    <View style={[styles.metricIconWrapper, { backgroundColor: '#FEFCE8' }]}>
                        <Utensils size={20} color="#EAB308" />
                    </View>
                    <View style={styles.metricRowInfo}>
                        <Text style={styles.metricValue}>{metrics.pure_veg_status}</Text>
                        <Text style={styles.metricLabel}>Dedicated prep stations</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={styles.statusPillText}>{metrics.pure_veg_audited}</Text>
                    </View>
                </View>
            </View>
        </Animated.View>

        {/* CHEF PROFILE */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.chefContainer}>
            <View style={styles.chefCard}>
                <View style={styles.chefHeaderRow}>
                    <View style={[styles.chefAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                        <UserCircle size={40} color="#9CA3AF" />
                    </View>
                    <View style={styles.chefInfo}>
                        <Text style={styles.chefRole}>EXECUTIVE HEAD CHEF</Text>
                        <Text style={styles.chefName}>Chef Rahul Sharma</Text>
                        <Text style={styles.chefExp}>12+ Years Experience • Ex-Taj Hotels</Text>
                    </View>
                </View>
                <View style={styles.chefDivider} />
                <Text style={styles.chefQuote}>"We treat every meal leaving this kitchen exactly as we would if we were serving our own family at home. Hygiene and taste are our absolute obsessions."</Text>
            </View>
        </Animated.View>

      </ScrollView>

      {/* FULL SCREEN STORY VIEWER MODAL */}
      <Modal visible={!!activeStoryVideo} transparent={true} animationType="fade" onRequestClose={() => setActiveStoryVideo(null)}>
        <View style={styles.storyViewerContainer}>
            {activeStoryVideo && (
                <Video
                    source={activeStoryVideo}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    repeat={true}
                    playInBackground={false}
                    ignoreSilentSwitch="obey"
                />
            )}
            
            <View style={[styles.storyViewerOverlay, { paddingTop: Math.max(insets.top + 20, 50) }]}>
                {/* Progress bar simulation */}
                <View style={styles.storyProgressBar}>
                    <View style={styles.storyProgressFill} />
                </View>

                {/* Close Button */}
                <BouncingButton 
                    style={styles.storyCloseButton} 
                    onPress={() => { triggerHaptic(); setActiveStoryVideo(null); }}
                >
                    <X size={24} color="#FFFFFF" />
                </BouncingButton>
            </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  
  // Player Styles
  videoPlayerContainer: { width: '100%', height: 380, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 15, zIndex: 10, backgroundColor: '#1A1A2E' },
  videoBackground: { width: '100%', height: '100%' },
  videoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'space-between' },
  videoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.4)', paddingBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  liveBadgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  liveDotWrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  liveDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444' },
  liveDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginRight: 12 },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16 },
  viewerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginLeft: 6 },
  
  videoFooter: { padding: 24, paddingTop: 60, backgroundColor: 'rgba(0,0,0,0.6)' },
  kitchenName: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  kitchenZone: { color: '#10B981', fontSize: 14, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },

  sectionTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900', marginBottom: 16, paddingHorizontal: 16, letterSpacing: -0.5 },

  // Stories Styles
  storiesContainer: { marginTop: 32 },
  storiesScroll: { paddingHorizontal: 16, gap: 16 },
  storyItem: { alignItems: 'center', width: 76 },
  storyRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#10B981', padding: 4, marginBottom: 10, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  storyImage: { width: '100%', height: '100%', borderRadius: 32, overflow: 'hidden' },
  storyTitle: { fontSize: 12, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },

  // Dashboard Styles
  dashboardContainer: { marginTop: 40 },
  metricList: { paddingHorizontal: 16, gap: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 16, elevation: 4 },
  metricIconWrapper: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  metricRowInfo: { flex: 1, marginLeft: 16 },
  metricValue: { fontSize: 16, fontWeight: '900', color: '#1A1A2E', letterSpacing: -0.3 },
  metricLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  statusPillText: { fontSize: 9, fontWeight: '900', color: '#4B5563', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Chef Styles
  chefContainer: { marginTop: 32, paddingHorizontal: 16 },
  chefCard: { backgroundColor: '#F9FAFB', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  chefHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  chefAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E5E7EB' },
  chefInfo: { flex: 1, marginLeft: 16 },
  chefRole: { fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 1 },
  chefName: { fontSize: 18, fontWeight: '900', color: '#1A1A2E', marginTop: 2 },
  chefExp: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 4 },
  chefDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  chefQuote: { fontSize: 13, fontStyle: 'italic', color: '#4B5563', lineHeight: 20 },

  // Full Screen Story Viewer
  storyViewerContainer: { flex: 1, backgroundColor: '#000000' },
  storyViewerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  storyProgressBar: { marginHorizontal: 16, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  storyProgressFill: { width: '70%', height: '100%', backgroundColor: '#FFFFFF' },
  storyCloseButton: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});

export default LiveKitchenScreen;
