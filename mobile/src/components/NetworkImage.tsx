import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  fallbackText?: string;
  width?: number;
  height?: number;
}

const buildImageKitUrl = (uri: string, width?: number, height?: number): string => {
  if (!uri.includes('ik.imagekit.io') || uri.includes('tr=')) return uri;
  const transforms = ['f-auto', 'q-80', 'pr-true'];
  if (width)  transforms.push(`w-${Math.round(width)}`);
  if (height) transforms.push(`h-${Math.round(height)}`);
  const tr = transforms.join(',');
  return uri.includes('?') ? `${uri}&tr=${tr}` : `${uri}?tr=${tr}`;
};

export const NetworkImage: React.FC<Props> = React.memo(({ uri, style, fallbackText = 'V', width, height }) => {
  const [error, setError] = useState(false);

  if (error || !uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>{fallbackText}</Text>
      </View>
    );
  }

  const optimizedUri = buildImageKitUrl(uri, width, height);

  return (
    <Image
      source={{ uri: optimizedUri, cache: 'force-cache' }}
      style={style}
      resizeMode="cover"
      onError={() => setError(true)}
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
