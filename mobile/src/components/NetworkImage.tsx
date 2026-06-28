import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  fallbackText?: string;
}

export const NetworkImage: React.FC<Props> = React.memo(({ uri, style, fallbackText = 'V' }) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>{fallbackText}</Text>
      </View>
    );
  }

  return (
    <Image 
      source={{ 
        uri,
        // Using headers to spoof browser UA just in case ImageKit blocks React Native default UA
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }} 
      style={style}
      resizeMode="cover"
      onError={(e) => {
        console.warn('NetworkImage failed to load:', uri, e.nativeEvent.error);
        setError(true);
      }}
    />
  );
});

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 24,
  }
});
