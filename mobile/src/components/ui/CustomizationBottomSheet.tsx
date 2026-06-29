import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Image } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { BouncingButton } from './BouncingButton';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface CustomizationBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  item: any;
  onAddToCart: (customizations: any[], instructions: string) => void;
}

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export const CustomizationBottomSheet: React.FC<CustomizationBottomSheetProps> = ({
  visible,
  onClose,
  item,
  onAddToCart
}) => {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState('');

  const groups = item?.customization_groups || [];
  const basePrice = (item?.price_paise || 0) / 100;

  let extraCost = 0;
  Object.keys(selectedOptions).forEach(groupName => {
    const optName = selectedOptions[groupName];
    const group = groups.find((g: any) => g.name === groupName);
    const option = group?.options.find((o: any) => o.name === optName);
    if (option?.price_paise) extraCost += option.price_paise / 100;
  });

  const totalPrice = basePrice + extraCost;

  const handleSelect = (groupName: string, optionName: string) => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setSelectedOptions(prev => ({
      ...prev,
      [groupName]: optionName
    }));
  };

  const handleAdd = () => {
    ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
    const customArray = Object.keys(selectedOptions).map(g => {
      const group = groups.find((gr: any) => gr.name === g);
      const option = group?.options.find((o: any) => o.name === selectedOptions[g]);
      return {
        group: g,
        option: selectedOptions[g],
        photo_url: option?.photo_url || undefined
      };
    });
    onAddToCart(customArray, instructions);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Customise {item?.name}</Text>
              <Text style={styles.subtitle}>₹{basePrice}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Customization Groups */}
            {groups.map((group: any, idx: number) => (
              <View key={idx} style={styles.groupContainer}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.name}</Text>
                  {group.required && <Text style={styles.requiredBadge}>REQUIRED</Text>}
                </View>
                
                {group.options.map((opt: any, optIdx: number) => {
                  const isSelected = selectedOptions[group.name] === opt.name;
                  return (
                    <TouchableOpacity
                      key={optIdx}
                      style={[styles.optionRow, isSelected && styles.optionSelected]}
                      activeOpacity={0.8}
                      onPress={() => handleSelect(group.name, opt.name)}
                    >
                      <View style={styles.optionLeft}>
                        <View style={[styles.radio, isSelected && styles.radioActive]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        {!!opt.photo_url && (
                          <Image source={{ uri: opt.photo_url }} style={styles.optionImage} />
                        )}
                        <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                          {opt.name}
                        </Text>
                      </View>
                      {!!opt.price_paise && (
                        <Text style={styles.optionPrice}>+₹{opt.price_paise / 100}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Special Instructions */}
            <View style={styles.groupContainer}>
              <Text style={styles.groupTitle}>Special Instructions</Text>
              <TextInput
                style={styles.instructionInput}
                placeholder="e.g. Make it less spicy, no onions..."
                placeholderTextColor={colors.inkFaint}
                value={instructions}
                onChangeText={setInstructions}
                multiline
                maxLength={100}
              />
            </View>
          </ScrollView>

          {/* Sticky Bottom Add Button */}
          <View style={styles.bottomBar}>
            <BouncingButton style={styles.addBtn} onPress={handleAdd} activeOpacity={0.9}>
              <Text style={styles.addBtnText}>Add Item  ·  ₹{totalPrice}</Text>
            </BouncingButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: { ...StyleSheet.absoluteFill as any },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink },
  subtitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.inkMuted, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  
  scroll: { paddingHorizontal: 20 },
  groupContainer: { paddingTop: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  groupTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink },
  requiredBadge: { fontSize: 10, fontFamily: fontFamily.bold, color: '#DC2626', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  optionSelected: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioActive: { borderColor: '#22C55E' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  optionImage: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: '#f1f1f1' },
  optionName: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  optionNameSelected: { fontFamily: fontFamily.bold, color: '#166534' },
  optionPrice: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  
  instructionInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, paddingTop: 16, fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, minHeight: 100, textAlignVertical: 'top'
  },
  
  bottomBar: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },
  addBtn: { backgroundColor: '#22C55E', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  addBtnText: { fontSize: 16, fontFamily: fontFamily.black, color: '#fff' },
});
