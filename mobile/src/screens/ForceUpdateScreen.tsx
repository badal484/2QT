import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { DownloadCloud, AlertTriangle } from 'lucide-react-native';

const ForceUpdateScreen = () => {
  const handleUpdate = () => {
    const link = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/id123456789' 
      : 'market://details?id=com.veltomobile';
      
    Linking.canOpenURL(link).then(supported => {
      if (supported) {
        Linking.openURL(link);
      } else {
        Linking.openURL('https://velto.com/download');
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <AlertTriangle size={12} color="#FF6B35" />
        <Text style={styles.badgeText}>Critical Update</Text>
      </View>

      <View style={styles.iconOuter}>
        <View style={styles.iconInner}>
          <DownloadCloud size={40} color="white" />
        </View>
      </View>
      
      <Text style={styles.title}>Time to Upgrade</Text>
      <Text style={styles.description}>
        We've supercharged the Velto experience! You're using an older version that is no longer supported by our kitchen servers. Please update to continue.
      </Text>

      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={handleUpdate}
        style={styles.updateBtn}
      >
        <Text style={styles.updateBtnText}>Update Now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  badgeText: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 6,
  },
  iconOuter: {
    width: 160,
    height: 160,
    backgroundColor: '#f9fafb',
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  iconInner: {
    width: 96,
    height: 96,
    backgroundColor: '#FF6B35',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    color: '#6b7280',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 64,
    paddingHorizontal: 16,
  },
  updateBtn: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  updateBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});

export default ForceUpdateScreen;
