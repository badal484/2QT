import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface RiderStatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  backgroundColor: string;
  textColor?: string;
  iconColor?: string;
}

const RiderStatsCard = ({ label, value, icon: Icon, backgroundColor, iconColor = 'white' }: RiderStatsCardProps) => {
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor }]}>
        <Icon size={20} color={iconColor} strokeWidth={2.5} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  value: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
});

export default RiderStatsCard;
