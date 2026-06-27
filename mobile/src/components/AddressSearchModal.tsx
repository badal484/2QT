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

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (lat: number, lon: number, displayName: string) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6&countrycodes=in`;
      const res = await fetch(url, {
        headers: { 'User-Agent': '2QT-FoodDelivery/1.0', 'Accept-Language': 'en' },
      });
      const data: NominatimResult[] = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(text), 400);
  };

  const handleSelect = (item: NominatimResult) => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    // Build a short readable display name from address components
    const a = item.address || {};
    const parts = [
      a.suburb || a.neighbourhood || a.village || a.town || a.city_district,
      a.county || a.district || a.state_district,
      a.state,
    ].filter(Boolean);
    const shortName = parts.length > 0 ? parts.join(', ') : item.display_name.split(', ').slice(0, 3).join(', ');
    onSelect(parseFloat(item.lat), parseFloat(item.lon), shortName);
    setQuery('');
    setResults([]);
  };

  const handleClose = () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
            <ArrowLeft color="#1A1A2E" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Location</Text>
        </View>

        {/* Search input */}
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
          {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
        </View>

        {/* Results */}
        <FlatList
          data={results}
          keyExtractor={item => String(item.place_id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const a = item.address || {};
            const title = a.suburb || a.village || a.town || a.city_district || a.road || item.display_name.split(', ')[0];
            const subtitle = item.display_name.split(', ').slice(1, 4).join(', ');
            return (
              <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                <View style={styles.pinBox}>
                  <MapPin size={18} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
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
    margin: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1, height: 48,
    fontSize: 15, fontFamily: fontFamily.medium, color: '#1A1A2E',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  pinBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#1A1A2E', marginBottom: 2 },
  rowSub: { fontSize: 13, fontFamily: fontFamily.regular, color: '#6B7280' },
  sep: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 64 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 32, fontFamily: fontFamily.medium },
});
