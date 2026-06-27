import React, { useState, useCallback } from 'react';
import {
  View, Modal, StyleSheet, TouchableOpacity, Text,
  TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { ENV } from '../config/env';

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (lat: number, lon: number, displayName: string) => void;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&components=country:in&types=geocode&language=en&key=${ENV.GOOGLE_GEOCODING_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        setResults(data.predictions || []);
      } else {
        // Fallback to Nominatim if Google fails
        await searchNominatim(text);
      }
    } catch {
      await searchNominatim(text);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchNominatim = async (text: string) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6&countrycodes=in`;
      const res = await fetch(url, { headers: { 'User-Agent': '2QT-FoodDelivery/1.0' } });
      const data = await res.json();
      // Convert Nominatim format to match our Prediction shape
      const converted: Prediction[] = data.map((item: any) => {
        const parts = item.display_name.split(', ');
        return {
          place_id: String(item.place_id),
          description: item.display_name,
          structured_formatting: {
            main_text: parts[0] || item.display_name,
            secondary_text: parts.slice(1, 4).join(', '),
          },
          _nominatim: { lat: item.lat, lon: item.lon },
        } as any;
      });
      setResults(converted);
    } catch {
      setResults([]);
    }
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(text), 350);
  };

  const handleSelect = async (item: Prediction & { _nominatim?: { lat: string; lon: string } }) => {
    ReactNativeHapticFeedback.trigger('impactMedium');

    // Nominatim fallback results have lat/lon directly
    if ((item as any)._nominatim) {
      const { lat, lon } = (item as any)._nominatim;
      onSelect(parseFloat(lat), parseFloat(lon), item.structured_formatting.main_text);
      setQuery(''); setResults([]);
      return;
    }

    // Google result — resolve place_id to lat/lng
    setResolving(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${item.place_id}&key=${ENV.GOOGLE_GEOCODING_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        onSelect(lat, lng, item.structured_formatting.main_text);
      }
    } catch {}
    setResolving(false);
    setQuery(''); setResults([]);
  };

  const handleClose = () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setQuery(''); setResults([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
            <ArrowLeft color="#1A1A2E" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Location</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Search for area, street, city..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={onChangeText}
            autoFocus
            returnKeyType="search"
          />
          {(loading || resolving) && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
        </View>

        <FlatList
          data={results}
          keyExtractor={item => item.place_id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => handleSelect(item as any)} activeOpacity={0.7}>
              <View style={styles.pinBox}>
                <MapPin size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.structured_formatting.main_text}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.structured_formatting.secondary_text}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            query.length >= 2 && !loading ? (
              <Text style={styles.empty}>No results found</Text>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontFamily: fontFamily.extrabold, color: '#1A1A2E' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, backgroundColor: '#F9FAFB',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  input: { flex: 1, height: 48, fontSize: 15, fontFamily: fontFamily.medium, color: '#1A1A2E' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  pinBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#1A1A2E', marginBottom: 2 },
  rowSub: { fontSize: 13, fontFamily: fontFamily.regular, color: '#6B7280' },
  sep: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 64 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 32, fontFamily: fontFamily.medium },
});
