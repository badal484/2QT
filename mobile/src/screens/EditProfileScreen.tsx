import { tokens } from '../theme/tokens';
import React, { useState } from 'react';
import {
  View, Text, TextInput, ActivityIndicator,
  Alert, Image, StyleSheet, KeyboardAvoidingView, ScrollView,
  Platform, StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setAuth } from '../store/slices/authSlice';
import { User, ShieldCheck } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haptics } from '../utils/haptics';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Button } from '../components/ui/Button';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useFeedback } from '../context/FeedbackContext';

const EditProfileScreen = ({ navigation }: any) => {
  const { user, accessToken, refreshToken } = useSelector((state: RootState) => state.auth);
  const { showDialog } = useFeedback();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const isRider = user?.role === 'rider' || user?.role === 'rider_captain';
  const accent = isRider ? tokens.colors.primary : tokens.colors.success;

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch('/customers/profile', data),
    onSuccess: (data) => {
      haptics.success();
      dispatch(setAuth({ user: { ...user, name: data.user.name, email: data.user.email, photo_url: data.user.photo_url }, accessToken, refreshToken, }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      showDialog({ title: 'Saved', message: 'Your profile has been updated successfully.', confirmText: 'Okay', type: 'success' });
      navigation.goBack();
    },
    onError: (err: any) => {
      haptics.error();
      showDialog({ title: 'Error', message: err.message || 'Failed to update profile', confirmText: 'Okay', type: 'error' });
    },
  });

  const handleSave = () => {
    if (!name.trim()) { showDialog({ title: 'Required', message: 'Name cannot be empty', confirmText: 'Okay', type: 'warning' }); return; }
    if (!email.trim() || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      showDialog({ title: 'Invalid Email', message: 'Please enter a valid email address', confirmText: 'Okay', type: 'warning' });
      return;
    }
    updateMutation.mutate({ name: name.trim(), email: email.trim(), photo_url: photoUrl });
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets && result.assets[0]) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadToImageKit(result.assets[0]);
        setPhotoUrl(uploadResult.url);
      } catch (err: any) {
        haptics.error();
        showDialog({ title: 'Upload Failed', message: err.message, confirmText: 'Okay', type: 'error' });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const hasChanges = name !== user?.name || email !== user?.email || photoUrl !== user?.photo_url;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={tokens.colors.background} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        <ScreenHeader title="Profile" />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <PressableScale 
                onPress={handlePickImage} 
                style={styles.avatarWrap}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <View style={styles.avatarCircle}>
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <User size={40} color={tokens.colors.textTertiary} />
                  )}
                  {isUploading && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color={tokens.colors.textInverse} />
                    </View>
                  )}
                </View>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={[styles.editPhotoText, { color: accent }]}>Edit Photo</Text>
              </PressableScale>
            </View>

            {/* Grouped Form Fields */}
            <View style={styles.formGroup}>
              {/* Name Field */}
              <View style={styles.fieldRow}>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={tokens.colors.textTertiary}
                  allowFontScaling
                  maxFontSizeMultiplier={1.4}
                  accessibilityLabel="Name input"
                />
              </View>
              <View style={styles.divider} />

              {/* Email Field */}
              <View style={styles.fieldRow}>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={tokens.colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  allowFontScaling
                  maxFontSizeMultiplier={1.4}
                  accessibilityLabel="Email input"
                />
              </View>
            </View>

            {/* Read-only / Verified Section */}
            <View style={styles.formGroup}>
              <View style={styles.fieldRow}>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.fieldLabel}>Phone</Text>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.readOnlyText}>+{user?.phone}</Text>
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={14} color={tokens.colors.success} />
                  <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>
            <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.footerNote}>
              Phone numbers cannot be changed directly. Please contact support if you need to update your verified number.
            </Text>

          </ScrollView>

          {/* Sticky Save Button (only visible if changes made) */}
          {hasChanges && (
            <View style={styles.stickyFooter}>
              <Button
                label="Save Changes"
                onPress={handleSave}
                loading={updateMutation.isPending}
                style={{ backgroundColor: accent }}
              />
            </View>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },

  scrollContent: { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.lg, paddingBottom: 100 },

  avatarSection: { alignItems: 'center', marginBottom: tokens.spacing.xxl },
  avatarWrap: { alignItems: 'center' },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...tokens.shadows.soft,
    marginBottom: 12,
  },
  avatarImage: { width: '100%', height: '100%' },
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.colors.overlay,
    alignItems: 'center', justifyContent: 'center',
  },
  editPhotoText: { fontSize: 15, fontFamily: tokens.typography.family.medium },

  formGroup: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.xl,
    overflow: 'hidden',
    marginBottom: tokens.spacing.xl,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg, minHeight: 52,
  },
  fieldLabel: {
    width: 80, fontSize: 15, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary,
    paddingVertical: tokens.spacing.md,
  },
  readOnlyText: {
    flex: 1, fontSize: 15, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: tokens.colors.border,
    marginLeft: tokens.spacing.lg,
  },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: tokens.colors.successTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  verifiedText: { color: tokens.colors.success, fontSize: 11, fontFamily: tokens.typography.family.semibold, textTransform: 'uppercase' },

  footerNote: {
    fontSize: 13, color: tokens.colors.textSecondary, lineHeight: 18,
    paddingHorizontal: 8, marginTop: -8, textAlign: 'center',
  },

  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl, paddingTop: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
});

export default EditProfileScreen;
