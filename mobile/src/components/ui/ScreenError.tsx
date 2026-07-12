import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';

interface ScreenErrorProps {
  onRetry: () => void;
  message?: string;
  type?: 'network' | 'generic';
}

export const ScreenError: React.FC<ScreenErrorProps> = ({
  onRetry,
  message = 'Something went wrong',
  type = 'generic',
}) => {
  const Icon = type === 'network' ? WifiOff : AlertCircle;
  return (
    <Animated.View entering={FadeIn.duration(300)} style={s.root}>
      <View style={s.iconWrap}>
        <Icon size={28} color="#9CA3AF" strokeWidth={1.5} />
      </View>
      <Text style={s.title}>{message}</Text>
      <Text style={s.sub}>Pull to refresh or tap below</Text>
      <TouchableOpacity style={s.btn} onPress={onRetry} activeOpacity={0.85}>
        <RefreshCw size={14} color="#FFFFFF" />
        <Text style={s.btnText}>Try Again</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 8,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1A1F1C', textAlign: 'center' },
  sub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FC4603', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
