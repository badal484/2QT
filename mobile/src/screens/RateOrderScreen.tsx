import { tokens } from '../theme/tokens';
import { Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../api/client';
import { haptics } from '../utils/haptics';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useFeedback } from '../context/FeedbackContext';

const RateOrderScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const { showDialog } = useFeedback();
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/orders/${orderId}/feedback`, data),
    onSuccess: () => {
      haptics.success();
      showDialog({ title: 'Thank You!', message: 'Your feedback helps us improve.', confirmText: 'Okay', type: 'success' });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    },
    onError: () => {
      haptics.error();
      showDialog({ title: 'Error', message: 'Could not submit your feedback. Please try again.', confirmText: 'Okay', type: 'error' });
    },
  });

  const canSubmit = foodRating > 0 && deliveryRating > 0 && !mutation.isPending;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Rate your experience" subtitle={`Order #${orderId.slice(-6).toUpperCase()}`} />

      <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.body}>
        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.sectionLabel}>Taste & Quality</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <PressableScale
              key={star}
              onPress={() => { haptics.selection(); setFoodRating(star); }}
              style={styles.starBtn}
            >
              <Star size={24} color={foodRating >= star ? tokens.colors.warning : tokens.colors.border} fill={foodRating >= star ? tokens.colors.warning : 'none'} />
            </PressableScale>
          ))}
        </View>

        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.sectionLabel}>Delivery Speed & Care</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <PressableScale
              key={star}
              onPress={() => { haptics.selection(); setDeliveryRating(star); }}
              style={styles.starBtn}
            >
              <Star size={24} color={deliveryRating >= star ? tokens.colors.warning : tokens.colors.border} fill={deliveryRating >= star ? tokens.colors.warning : 'none'} />
            </PressableScale>
          ))}
        </View>

        <TextField
          label="Additional Comments"
          placeholder="Anything else you'd like to share?"
          multiline
          value={comment}
          onChangeText={setComment}
          textAlignVertical="top"
          style={styles.commentInput}
          containerStyle={{ marginBottom: tokens.spacing.xl }}
        />

        <Button
          label={mutation.isPending ? '' : 'Submit Feedback'}
          onPress={() => mutation.mutate({ foodRating, deliveryRating, comment })}
          disabled={!canSubmit}
          loading={mutation.isPending}
          haptic="none"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  body: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
  },
  sectionLabel: {
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
  },
  starBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.radii.lg,
  },
  commentInput: {
    minHeight: 96,
  },
});

export default RateOrderScreen;
