import { ArrowLeft, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

const RateOrderScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/orders/${orderId}/feedback`, data),
    onSuccess: () => {
      Alert.alert('Thank You!', 'Your feedback helps us improve.');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft size={24} color="#1A1A2E" />
      </TouchableOpacity>

      <Text style={styles.title}>Rate your experience</Text>
      <Text style={styles.orderIdText}>Order #{orderId.slice(-6).toUpperCase()}</Text>

      {/* Food Rating */}
      <Text style={styles.sectionLabel}>Taste & Quality</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity 
            key={star} 
            onPress={() => setFoodRating(star)}
            style={styles.starBtn}
          >
            <Star size={24} color={foodRating >= star ? "#EAB308" : "#E5E7EB"} fill={foodRating >= star ? "#EAB308" : "none"} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Delivery Rating */}
      <Text style={styles.sectionLabel}>Delivery Speed & Care</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity 
            key={star} 
            onPress={() => setDeliveryRating(star)}
            style={styles.starBtn}
          >
            <Star size={24} color={deliveryRating >= star ? "#EAB308" : "#E5E7EB"} fill={deliveryRating >= star ? "#EAB308" : "none"} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Additional Comments</Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Anything else you'd like to share?"
        placeholderTextColor="#9ca3af"
        multiline
        value={comment}
        onChangeText={setComment}
        textAlignVertical="top"
      />

      <TouchableOpacity 
        onPress={() => mutation.mutate({ foodRating, deliveryRating, comment })}
        disabled={foodRating === 0 || deliveryRating === 0 || mutation.isPending}
        style={[styles.submitBtn, (foodRating === 0 || deliveryRating === 0) ? styles.submitBtnDisabled : styles.submitBtnEnabled]}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitBtnText}>Submit Feedback</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 32,
    paddingTop: 64,
  },
  backButton: {
    marginBottom: 24,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  orderIdText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 40,
  },
  sectionLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  starBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  commentInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    fontSize: 18,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 40,
    height: 128,
  },
  submitBtn: {
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnEnabled: {
    backgroundColor: '#FF6B35',
  },
  submitBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

export default RateOrderScreen;
