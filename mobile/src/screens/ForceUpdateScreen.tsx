import { tokens } from '../theme/tokens';
import React from 'react';
import { View, Text, Linking, Platform, StyleSheet } from 'react-native';
import { DownloadCloud, AlertTriangle } from 'lucide-react-native';
import { PressableScale } from '../components/ui/internal/PressableScale';

const ForceUpdateScreen = () => {
  const handleUpdate = () => {
    const link = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/id123456789' 
      : 'market://details?id=com.2qtmobile';
      
    Linking.canOpenURL(link).then(supported => {
      if (supported) {
        Linking.openURL(link);
      } else {
        Linking.openURL('https://2qt.com/download');
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <AlertTriangle size={12} color={tokens.colors.primary} />
        <Text style={styles.badgeText}>Critical Update</Text>
      </View>

      <View style={styles.iconOuter}>
        <View style={styles.iconInner}>
          <DownloadCloud size={40} color={tokens.colors.textInverse} />
        </View>
      </View>
      
      <Text style={styles.title}>Time to Upgrade</Text>
      <Text style={styles.description}>
        We've supercharged the 2QT experience! You're using an older version that is no longer supported by our kitchen servers. Please update to continue.
      </Text>

      <PressableScale
        onPress={handleUpdate}
        style={styles.updateBtn}
      >
        <Text style={styles.updateBtnText}>Update Now</Text>
      </PressableScale>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    position: 'absolute',
    top: 80,
    right: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  badgeText: {
    color: tokens.colors.primary,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 6,
  },
  iconOuter: {
    width: 160,
    height: 160,
    backgroundColor: tokens.colors.background,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  iconInner: {
    width: 96,
    height: 96,
    backgroundColor: tokens.colors.primary,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: 32,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -1,
    textTransform: 'uppercase',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.family.bold,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 64,
    paddingHorizontal: 16,
  },
  updateBtn: {
    width: '100%',
    backgroundColor: tokens.colors.textPrimary,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
  },
  updateBtnText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});

export default ForceUpdateScreen;
