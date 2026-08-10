import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../theme/tokens';

export const ExploreMenuBanner = React.memo(() => (
  <View style={ebS.wrapper}>
    {/* Giant ghost "MENU" — 5% opacity, gives depth without any background */}
    <Text allowFontScaling={false} style={ebS.ghost} numberOfLines={1}>MENU</Text>

    {/* Top diamond rule */}
    <View style={ebS.ruleRow}>
      <View style={ebS.ruleLine} />
      <Text allowFontScaling={false} style={ebS.diamond}>◆</Text>
      <View style={ebS.ruleLine} />
    </View>

    {/* Eyebrow label */}
    <Text allowFontScaling={false} style={ebS.eyebrow}>E X P L O R E</Text>

    {/* Main title — two weights inline */}
    <View style={ebS.titleRow}>
      <Text allowFontScaling={false} style={ebS.titleLight}>our </Text>
      <Text allowFontScaling={false} style={ebS.titleBold}>menu</Text>
    </View>

    {/* Bottom diamond rule */}
    <View style={ebS.ruleRow}>
      <View style={ebS.ruleLine} />
      <Text allowFontScaling={false} style={ebS.diamond}>◆</Text>
      <View style={ebS.ruleLine} />
    </View>
    <View style={{ height: 24 }} />
  </View>
));

const ebS = StyleSheet.create({
  wrapper: {
    paddingVertical: 20,
    paddingHorizontal: tokens.spacing.lg,
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  ghost: {
    position: 'absolute',
    fontFamily: tokens.typography.family.black,
    fontSize: 108,
    color: 'rgba(46, 125, 50, 0.05)',
    letterSpacing: 10,
    top: '50%',
    marginTop: -54,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '78%',
    marginVertical: 5,
  },
  ruleLine: {
    flex: 1,
    height: 0.8,
    backgroundColor: 'rgba(94, 175, 99, 0.45)',
  },
  diamond: {
    fontSize: 7,
    color: 'rgba(94, 175, 99, 0.7)',
  },
  eyebrow: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 10,
    color: '#7DC880',
    letterSpacing: 5,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleLight: {
    fontFamily: tokens.typography.family.medium,
    fontStyle: 'italic',
    fontSize: 38,
    color: '#81C784',
    letterSpacing: 0.5,
  },
  titleBold: {
    fontFamily: tokens.typography.family.black,
    fontSize: 42,
    color: '#1B5E20',
    letterSpacing: -0.5,
  },
});
