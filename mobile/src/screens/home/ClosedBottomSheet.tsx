import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { isKitchenOpen, minutesUntilOpen, formatTime12h } from '../../utils/kitchenHours';

export const ClosedBottomSheet = ({
  openingTime,
  paused,
  pauseReason,
  pauseUntil,
  kitchenId,
  onDismiss,
}: {
  openingTime?: string | null;
  paused?: boolean;
  pauseReason?: string | null;
  pauseUntil?: string | null;
  kitchenId?: string | null;
  onDismiss: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = paused ? 5000 : 30000;
    const id = setInterval(() => setTick(t => t + 1), interval);
    return () => clearInterval(id);
  }, [paused]);

  const minsLeft = minutesUntilOpen(openingTime);
  const opensVerySoon = minsLeft > 0 && minsLeft <= 30;
  const openLabel = openingTime ? formatTime12h(openingTime) : '10:00 AM';

  const pauseSecsLeft = pauseUntil
    ? Math.max(0, Math.floor((new Date(pauseUntil).getTime() - Date.now()) / 1000))
    : null;
  const pauseMinsLeft = pauseSecsLeft !== null ? Math.floor(pauseSecsLeft / 60) : null;
  const pauseSecsRem = pauseSecsLeft !== null ? pauseSecsLeft % 60 : null;

  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const headerHeight = Math.max(insets.top + 8, 12) + 128;
  const sheetHeight = SCREEN_HEIGHT - headerHeight;

  const translateY = useRef(new RNAnimated.Value(sheetHeight)).current;

  useEffect(() => {
    RNAnimated.timing(translateY, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const dismiss = useCallback(() => {
    RNAnimated.timing(translateY, {
      toValue: sheetHeight,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [sheetHeight, onDismiss]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy, dx }) => dy > 0 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 50 || vy > 0.3) {
          RNAnimated.timing(translateY, {
            toValue: sheetHeight,
            duration: 150,
            useNativeDriver: true,
          }).start(() => onDismiss());
        } else {
          RNAnimated.timing(translateY, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <RNAnimated.View
      style={[closedSS.sheet, { top: headerHeight, height: sheetHeight, transform: [{ translateY }] }]}
      {...panResponder.panHandlers}
    >
      <View style={closedSS.dragHandle} />

      <View style={closedSS.content}>
        <Image
          source={require('../../images/closed_store.jpg')}
          style={{ width: 250, height: 180, marginBottom: 24 }}
          resizeMode="contain"
        />

        {paused ? (
          <>
            <Text allowFontScaling={false} style={closedSS.title}>Kitchen Paused</Text>

            {pauseReason ? (
              <Text allowFontScaling={false} style={closedSS.subtitle}>"{pauseReason}"</Text>
            ) : (
              <Text allowFontScaling={false} style={closedSS.subtitle}>Taking a short break to catch up.</Text>
            )}

            {pauseSecsLeft !== null && pauseSecsLeft > 0 ? (
              <View style={closedSS.countdownRow}>
                <Text allowFontScaling={false} style={closedSS.countdownLabel}>Back in </Text>
                <Text allowFontScaling={false} style={closedSS.countdown}>
                  {pauseMinsLeft}:{String(pauseSecsRem).padStart(2, '0')}
                </Text>
              </View>
            ) : (
              <Text allowFontScaling={false} style={closedSS.body}>We'll reopen shortly — thank you for your patience.</Text>
            )}
          </>
        ) : (
          <>
            <Text allowFontScaling={false} style={closedSS.title}>Closed for Now, Back Soon!</Text>

            {opensVerySoon ? (
              <Text allowFontScaling={false} style={closedSS.subtitle}>
                Opening in <Text allowFontScaling={false} style={closedSS.highlight}>{minsLeft} min</Text>
              </Text>
            ) : (
              <Text allowFontScaling={false} style={closedSS.subtitle}>
                We open at <Text allowFontScaling={false} style={closedSS.highlight}>{openLabel}</Text>
              </Text>
            )}

            <Text allowFontScaling={false} style={closedSS.body}>
              We're closed for now, but we'll be back soon!{'\n'}Thank you for your patience.
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[closedSS.btn, { marginBottom: Math.max(insets.bottom, 16) + 16 }]}
        onPress={dismiss}
        activeOpacity={0.85}
      >
        <Text allowFontScaling={false} style={closedSS.btnText}>Browse Menu</Text>
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

const closedSS = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1100,
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadows.soft,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 20,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 22,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  highlight: {
    fontFamily: tokens.typography.family.extrabold,
    color: tokens.colors.primary,
  },
  body: {
    fontSize: 13,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 15,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
  },
  countdown: {
    fontSize: 32,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.primary,
  },
  btn: {
    width: '100%',
    backgroundColor: tokens.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnText: {
    color: tokens.colors.surface,
    fontSize: 16,
    fontFamily: tokens.typography.family.extrabold,
  },
});
