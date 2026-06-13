import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

const OrderConfirmedScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[styles.successIcon, animatedStyle]}
      >
        <Check size={64} color="white" />
      </Animated.View>

      <Text style={styles.title}>Order Confirmed!</Text>
      <Text style={styles.description}>
        Your delicious meal is being prepared in our central kitchen.
      </Text>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Order ID</Text>
          <Text style={styles.detailValue}>{orderId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Est. Delivery</Text>
          <Text style={styles.estTime}>25 Mins</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.trackBtn}
        onPress={() => navigation.navigate('OrderTracking', { orderId })}
      >
        <Text style={styles.trackBtnText}>TRACK MY ORDER</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.homeBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
      >
        <Text style={styles.homeBtnText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    width: 128,
    height: 128,
    backgroundColor: '#22C55E',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: '#9ca3af',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    marginTop: 48,
    width: '100%',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailLabel: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  detailValue: {
    color: '#1A1A2E',
    fontWeight: '900',
  },
  estTime: {
    color: '#FF6B35',
    fontWeight: '900',
  },
  trackBtn: {
    width: '100%',
    height: 64,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  trackBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  homeBtn: {
    marginTop: 24,
  },
  homeBtnText: {
    color: '#9ca3af',
    fontWeight: '700',
  },
});

export default OrderConfirmedScreen;
