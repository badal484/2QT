import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Alert, StyleSheet, StatusBar, TextInput,
} from 'react-native';
import { SkeletonScreenList, SkeletonListItem } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  ArrowLeft, FileText, Car, CreditCard, Upload,
  CheckCircle, Clock, XCircle, Camera, MapPin,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

const VEHICLE_TYPES = ['bicycle', 'motorcycle', 'scooter', 'car'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  pending:  { label: 'Under Review', color: R.amber,  bg: R.amberLight, Icon: Clock },
  approved: { label: 'Verified',     color: R.green,  bg: R.greenLight, Icon: CheckCircle },
  rejected: { label: 'Rejected',     color: R.red,    bg: R.redLight,   Icon: XCircle },
};

const RiderDocumentsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['rider-documents'],
    queryFn: () => api.get('/riders/documents'),
  });

  const [vehicleType, setVehicleType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);
  const [idPhotoUri, setIdPhotoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    if (doc) {
      setVehicleType(doc.vehicle_type || '');
      setLicenseNumber(doc.license_number || '');
      setIdPhotoUrl(doc.id_photo_url || null);
    }
  }, [doc]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.patch('/riders/documents', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-documents'] });
      Alert.alert('Submitted', 'Your documents have been sent for review.');
    },
    onError: () => Alert.alert('Error', 'Could not save documents. Please try again.'),
  });

  const pickPhoto = async (useCamera: boolean) => {
    const result = useCamera
      ? await launchCamera({ mediaType: 'photo', quality: 0.8 })
      : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setIdPhotoUri(asset.uri ?? null);
    setIdPhotoUrl(null);
    setIsUploading(true);
    try {
      const uploaded = await uploadToImageKit(asset, 'rider_docs');
      setIdPhotoUrl(uploaded.url);
    } catch {
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
      setIdPhotoUri(null);
    } finally {
      setIsUploading(false);
    }
  };

  const showPhotoPicker = () => {
    Alert.alert('Upload ID Document', 'Choose source', [
      { text: 'Camera', onPress: () => pickPhoto(true) },
      { text: 'Gallery', onPress: () => pickPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = () => {
    if (!vehicleType) { Alert.alert('Required', 'Please select your vehicle type.'); return; }
    saveMutation.mutate({ vehicleType, licenseNumber, idPhotoUrl });
  };

  const status = doc?.status ?? null;
  const cfg = status ? STATUS_CONFIG[status] : null;
  const photoToShow = idPhotoUri || idPhotoUrl;

  if (isLoading) return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Documents</Text>
        <View style={{ width: 40 }} />
      </View>
      <SkeletonScreenList item={<SkeletonListItem />} />
    </View>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        {cfg && (
          <View style={[s.statusBanner, { backgroundColor: cfg.bg, borderColor: cfg.color + '30' }]}>
            <cfg.Icon size={18} color={cfg.color} />
            <View style={{ flex: 1 }}>
              <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
              {status === 'rejected' && doc?.rejection_reason && (
                <Text style={s.statusReason}>{doc.rejection_reason}</Text>
              )}
            </View>
          </View>
        )}

        {/* Vehicle type */}
        <Text style={s.sectionLabel}>Vehicle Type</Text>
        <View style={s.vehicleGrid}>
          {VEHICLE_TYPES.map(v => (
            <TouchableOpacity
              key={v}
              style={[s.vehicleChip, vehicleType === v && s.vehicleChipSelected]}
              onPress={() => setVehicleType(v)}
              activeOpacity={0.8}
            >
              <Car size={14} color={vehicleType === v ? R.orange : R.muted} />
              <Text style={[s.vehicleChipText, vehicleType === v && s.vehicleChipTextSelected]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* License number */}
        <Text style={s.sectionLabel}>License / Registration Number</Text>
        <View style={s.inputRow}>
          <CreditCard size={16} color={R.muted} />
          <TextInput
            style={s.inputText}
            placeholder="Enter license number"
            placeholderTextColor={R.muted}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
            returnKeyType="done"
          />
        </View>

        {/* ID photo */}
        <Text style={s.sectionLabel}>ID / License Photo</Text>
        {photoToShow ? (
          <View style={s.photoWrapper}>
            <Image source={{ uri: photoToShow }} style={s.docPhoto} resizeMode="cover" />
            {isUploading && (
              <View style={s.photoOverlay}>
                <ActivityIndicator color={R.orange} />
                <Text style={s.uploadingText}>Uploading…</Text>
              </View>
            )}
            {idPhotoUrl && !isUploading && (
              <View style={s.uploadedBadge}>
                <CheckCircle size={14} color={R.green} />
                <Text style={s.uploadedText}>Uploaded</Text>
              </View>
            )}
            <TouchableOpacity style={s.reuploadBtn} onPress={showPhotoPicker} activeOpacity={0.85}>
              <Upload size={13} color={R.white} />
              <Text style={s.reuploadBtnText}>Re-upload</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.uploadArea} onPress={showPhotoPicker} activeOpacity={0.85}>
            {isUploading ? (
              <ActivityIndicator color={R.orange} />
            ) : (
              <>
                <View style={s.uploadIconWrap}>
                  <Camera size={28} color={R.orange} />
                </View>
                <Text style={s.uploadAreaTitle}>Tap to upload photo</Text>
                <Text style={s.uploadAreaSub}>JPG or PNG · max 10 MB</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Info card */}
        <View style={s.infoCard}>
          <MapPin size={14} color={R.muted} />
          <Text style={s.infoText}>Documents are reviewed within 24 hours. You'll be notified once verified.</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveBtn, (saveMutation.isPending || isUploading) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saveMutation.isPending || isUploading}
          activeOpacity={0.9}
        >
          {saveMutation.isPending
            ? <ActivityIndicator color={R.white} />
            : <Text style={s.saveBtnText}>Submit for Verification</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: R.bg,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: R.ink },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20,
  },
  statusLabel: { fontSize: 14, fontWeight: '700' },
  statusReason: { color: R.gray, fontSize: 12, marginTop: 4, lineHeight: 18 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: R.muted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 10, marginTop: 20,
  },

  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: R.white, borderWidth: 1, borderColor: R.border,
  },
  vehicleChipSelected: { borderColor: R.orange, backgroundColor: R.orangeLight },
  vehicleChipText: { color: R.muted, fontSize: 13, fontWeight: '600' },
  vehicleChipTextSelected: { color: R.orange, fontWeight: '700' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: R.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: R.border,
  },
  inputText: { flex: 1, color: R.ink, fontSize: 14, fontWeight: '600' },

  uploadArea: {
    height: 160, borderRadius: 16, backgroundColor: R.white,
    borderWidth: 1.5, borderColor: R.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  uploadIconWrap: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadAreaTitle: { color: R.ink, fontSize: 14, fontWeight: '700' },
  uploadAreaSub: { color: R.muted, fontSize: 12 },

  photoWrapper: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  docPhoto: { width: '100%', height: 200, backgroundColor: R.bg },
  photoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadingText: { color: R.orange, fontSize: 13, fontWeight: '600' },
  uploadedBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: R.greenLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  uploadedText: { color: R.green, fontSize: 12, fontWeight: '700' },
  reuploadBtn: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  reuploadBtnText: { color: R.white, fontSize: 12, fontWeight: '700' },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: R.white, borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: R.border,
  },
  infoText: { flex: 1, color: R.gray, fontSize: 12, lineHeight: 18 },

  saveBtn: {
    marginTop: 24, backgroundColor: R.orange, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center',
    shadowColor: R.orange, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  saveBtnDisabled: { backgroundColor: R.border, shadowOpacity: 0 },
  saveBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },
});

export default RiderDocumentsScreen;
