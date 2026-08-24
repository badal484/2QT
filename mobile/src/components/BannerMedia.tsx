import React, { useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import Video from 'react-native-video';
import { NetworkImage } from './NetworkImage';

interface BannerMediaProps {
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | string;
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  borderRadius?: number;
}

export const BannerMedia: React.FC<BannerMediaProps> = React.memo(({
  imageUrl,
  videoUrl,
  mediaType = 'IMAGE',
  isActive = true,
  style,
  imageStyle,
  borderRadius = 16,
}) => {
  const [videoError, setVideoError] = useState(false);
  const isVideo = (mediaType === 'VIDEO' || (!mediaType && !!videoUrl)) && !!videoUrl && !videoError;

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {/* Base Poster / Fallback Image (always rendered or used as backdrop) */}
      {imageUrl ? (
        <NetworkImage
          uri={imageUrl}
          style={[styles.image, { borderRadius }, imageStyle]}
        />
      ) : (
        <View style={[styles.image, styles.darkPlaceholder, { borderRadius }]} />
      )}

      {/* Video Overlay Layer */}
      {isVideo && (
        <Video
          source={{ uri: videoUrl }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          resizeMode="cover"
          repeat={true}
          muted={true}
          paused={!isActive}
          playInBackground={false}
          ignoreSilentSwitch="obey"
          poster={imageUrl}
          posterResizeMode="cover"
          onError={() => setVideoError(true)}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  darkPlaceholder: {
    backgroundColor: '#18181b',
  },
});
