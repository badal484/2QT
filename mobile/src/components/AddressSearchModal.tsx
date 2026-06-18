import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { ArrowLeft, Search, MapPin } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { api } from '../api/client';

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (lat: number, lon: number, displayName: string) => void;
}

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setNetworkError(false);
    }
  }, [visible]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 2) {
        searchAddress(query);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const searchAddress = async (searchQuery: string) => {
    setLoading(true);
    setNetworkError(false);
    try {
      const data = await api.get(`/menu/geocode/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setResults([]);
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    onSelect(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            ReactNativeHapticFeedback.trigger('impactLight');
            onClose();
          }} style={styles.backBtn}>
            <ArrowLeft color="#1A1A2E" size={24} />
          </TouchableOpacity>
          <View style={styles.searchContainer}>
            <Search color="#9CA3AF" size={20} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for your city or address..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Searching globally...</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id.toString()}
            contentContainerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                <View style={styles.iconContainer}>
                  <MapPin color="#FF6B35" size={24} />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {item.name || item.address?.city || item.address?.town || item.address?.village || 'Unknown Place'}
                  </Text>
                  <Text style={styles.resultSubtitle} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              query.length > 2 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {networkError
                      ? 'Search unavailable. Check your internet connection.'
                      : 'No matching locations found.'}
                  </Text>
                </View>
              ) : null
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A2E',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 16,
  },
});
