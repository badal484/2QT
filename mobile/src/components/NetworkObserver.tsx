import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { WifiOff, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const NetworkObserver = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [showRestored, setShowRestored] = useState(false);
  const translateY = useSharedValue(-100);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (isConnected !== null && isConnected === false && state.isConnected === true) {
        // Just reconnected
        setShowRestored(true);
        setIsConnected(true);
        setTimeout(() => {
          translateY.value = withTiming(-100, { duration: 400 }, () => {
            runOnJS(setShowRestored)(false);
          });
        }, 3000);
      } else if (state.isConnected === false) {
        // Disconnected
        setIsConnected(false);
        translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
      } else {
        setIsConnected(true);
      }
    });

    return () => unsubscribe();
  }, [isConnected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  if (isConnected && !showRestored) return null;

  const isOffline = !isConnected;

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top || 40 }, animatedStyle, { backgroundColor: isOffline ? '#EF4444' : '#22C55E' }]}>
      <View style={styles.content}>
        {isOffline ? <WifiOff size={20} color="white" /> : <Wifi size={20} color="white" />}
        <Text style={styles.text}>
          {isOffline ? "No Internet Connection" : "Back Online!"}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, paddingBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { color: 'white', fontWeight: '800', marginLeft: 8, fontSize: 14 }
});
