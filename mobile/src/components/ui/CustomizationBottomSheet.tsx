import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image } from 'react-native';
import { tokens } from '../../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { haptics } from '../../utils/haptics';

interface CustomizationBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  item: any;
  onAddToCart: (customizations: any[], instructions: string) => void;
}

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
  groups.forEach((g: any) => {
    if (selectedOptions[g.name]) {
      const opt = g.options.find((o: any) => o.name === selectedOptions[g.name]);
      if (opt?.price_paise) extraCost += opt.price_paise / 100;
    }
  });

  const totalPrice = basePrice + extraCost;

  const handleSelect = (groupName: string, optionName: string) => {
    haptics.selection();
    setSelectedOptions(prev => ({ ...prev, [groupName]: optionName }));
  };

  const handleAdd = () => {
    for (const g of groups) {
      if (g.required && !selectedOptions[g.name]) {
        haptics.error();
        return;
      }
    }

    haptics.success();
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Customise ${item?.name || 'Item'}`}
      subtitle={`₹${basePrice}`}
    >
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
                    <Text 
                      style={[styles.optionName, isSelected && styles.optionNameSelected]}
                     
                    >
                      {opt.name}
                    </Text>
                  </View>
                  {!!opt.price_paise && (
                    <Text style={styles.optionPrice}>
                      +₹{opt.price_paise / 100}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={styles.groupContainer}>
          <Text style={styles.groupTitle}>Special Instructions</Text>
          <TextInput
            style={styles.instructionInput}
            placeholder="e.g. Make it less spicy, no onions..."
            placeholderTextColor={tokens.colors.textSecondary}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            maxLength={100}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          />
        </View>
      </ScrollView>

      {/* Sticky Bottom Add Button */}
      <View style={styles.bottomBar}>
        <Button 
          label={`Add Item  ·  ₹${totalPrice}`}
          onPress={handleAdd}
          variant="primary"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: tokens.spacing.lg, maxHeight: '80%' },
  groupContainer: { paddingTop: tokens.spacing.lg, paddingBottom: tokens.spacing.sm, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.md },
  groupTitle: { fontSize: tokens.typography.size.bodyLarge, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  requiredBadge: { fontSize: 10, fontFamily: tokens.typography.family.bold, color: tokens.colors.danger, backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: tokens.spacing.md, paddingHorizontal: tokens.spacing.md, borderRadius: tokens.radii.md, marginBottom: tokens.spacing.sm, borderWidth: 1, borderColor: 'transparent' },
  optionSelected: { backgroundColor: '#FFEDD5', borderColor: tokens.colors.primary },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing.md },
  radioActive: { borderColor: tokens.colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colors.primary },
  optionImage: { width: 32, height: 32, borderRadius: tokens.radii.sm, marginRight: tokens.spacing.md, backgroundColor: '#f1f1f1' },
  optionName: { fontSize: tokens.typography.size.body, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary },
  optionNameSelected: { fontFamily: tokens.typography.family.bold, color: tokens.colors.primary },
  optionPrice: { fontSize: tokens.typography.size.body, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary },
  
  instructionInput: {
    backgroundColor: tokens.colors.background, borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.border,
    padding: tokens.spacing.lg, paddingTop: tokens.spacing.lg, fontSize: tokens.typography.size.body, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary, minHeight: 100, textAlignVertical: 'top'
  },
  
  bottomBar: { padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl, borderTopWidth: 1, borderTopColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
});
