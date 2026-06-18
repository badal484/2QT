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
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
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
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
});

export default RiderStatsCard;
