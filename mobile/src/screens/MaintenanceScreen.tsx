import React from 'react';
import { View, Text, StyleSheet, StatusBar, Image } from 'react-native';
import { ChefHat, Hammer, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MaintenanceScreen = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.content}>
        <View style={styles.iconContainer}>
          <ChefHat size={64} color="#FF6B35" strokeWidth={1.5} />
          <View style={styles.toolIcon}>
            <Hammer size={24} color="#1A1A2E" />
          </View>
        </View>

        <Text style={styles.title}>Refining the Flavor</Text>
        <Text style={styles.description}>
          Our digital kitchen is currently undergoing a scheduled cleaning to serve you better. We'll be back shortly!
        </Text>

        <View style={styles.timeCard}>
          <Clock size={20} color="#FF6B35" />
          <Text style={styles.timeText}>ETA: 45 Minutes</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>2QT BENGALURU PILOT</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 40,
  },
  toolIcon: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -1,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  timeCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
  },
  timeText: {
    color: '#FF6B35',
    fontWeight: '900',
    marginLeft: 12,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 64,
  },
  footerText: {
    color: '#D1D5DB',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 4,
  },
});

export default MaintenanceScreen;
