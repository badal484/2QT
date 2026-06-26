const fs = require('fs');
let content = fs.readFileSync('mobile/src/screens/HomeScreen.tsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, TextInput, Switch, FlatList, Dimensions, ActivityIndicator, Image, RefreshControl } from 'react-native';",
  "import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, TextInput, Switch, FlatList, SectionList, Dimensions, ActivityIndicator, Image, RefreshControl } from 'react-native';"
);
content = content.replace(
  "import { MapPin, Search, PackageOpen, ChefHat, ChevronDown, ShoppingBag, User } from 'lucide-react-native';",
  "import { MapPin, Search, PackageOpen, ChefHat, ChevronDown, ShoppingBag, User, Menu } from 'lucide-react-native';"
);

// 2. State
content = content.replace(
  "const [searchQuery, setSearchQuery] = useState('');",
  "const [searchQuery, setSearchQuery] = useState('');\n  const [showSearch, setShowSearch] = useState(false);\n  const sectionListRef = React.useRef<SectionList>(null);\n  const [showMenuPopup, setShowMenuPopup] = useState(false);"
);

// 3. Sections instead of filteredItems
const filteredItemsStr = `  const filteredItems = useMemo(() => {
    if (!menuData?.items) return [];
    return menuData.items.filter((item: any) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (isVegOnly && !item.is_veg) return false;
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [menuData?.items, selectedCategory, isVegOnly, searchQuery]);`;

const sectionsStr = `  const sections = useMemo(() => {
    if (!menuData?.items) return [];
    let items = menuData.items;
    
    if (isVegOnly) items = items.filter((item: any) => item.is_veg);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item: any) => item.name.toLowerCase().includes(q));
    }

    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    if (selectedCategory !== 'All') {
      return grouped[selectedCategory] ? [{ title: selectedCategory, data: grouped[selectedCategory] }] : [];
    }

    return Object.keys(grouped).sort().map(key => ({
      title: key,
      data: grouped[key]
    }));
  }, [menuData?.items, selectedCategory, isVegOnly, searchQuery]);`;

content = content.replace(filteredItemsStr, sectionsStr);

// 4. Header UI
const headerUiStr = `      <View style={[styles.minimalHeader, { paddingTop: Math.max(insets.top + spacing.md, 50) }]}>
        {/* ── Logo row ─────────────────────────────────────────── */}
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.logoText}>2QT<Text style={styles.logoDot}>.</Text></Text>
            <View style={styles.deliveryTagRow}>
              <Text style={styles.deliveryTagIcon}>⚡</Text>
              <Text style={styles.deliveryTagText}>15-MIN DELIVERY</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Address pill */}
            <TouchableOpacity
              style={styles.addressPill}
              onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}
            >
              <MapPin size={12} color={unserviceableLocation || showNoLocation ? colors.danger : colors.primary} />
              <Text style={[styles.addressPillText, (unserviceableLocation || showNoLocation) && { color: colors.danger }]} numberOfLines={1}>
                {location?.addressText?.split(',')[0] || selectedAddress?.address_text?.split(',')[0] || 'Set location'}
              </Text>
              <ChevronDown size={12} color={colors.inkMuted} />
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => { triggerHaptic(); navigation.navigate('ProfileTab'); }}
            >
              {user?.photo_url ? (
                <NetworkImage uri={user.photo_url} style={styles.profileImage} fallbackText={user?.name?.[0]?.toUpperCase() || '?'} />
              ) : (
                <User size={18} color={colors.primary} />
              )}
            </TouchableOpacity>

          </View>
        </View>
      </View>`;

const newHeaderUiStr = `      <View style={[styles.minimalHeader, { paddingTop: Math.max(insets.top + spacing.xs, 40), paddingBottom: spacing.sm }]}>
        <View style={styles.headerTopRow}>
          
          <View style={{ flex: 1, marginRight: 12 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}
              onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}
            >
              <MapPin size={16} color={unserviceableLocation || showNoLocation ? colors.danger : colors.primary} />
              <Text style={[styles.addressPillText, { fontSize: 16, marginLeft: 4 }, (unserviceableLocation || showNoLocation) && { color: colors.danger }]} numberOfLines={1}>
                {location?.addressText?.split(',')[0] || selectedAddress?.address_text?.split(',')[0] || 'Set location'}
              </Text>
              <ChevronDown size={14} color={colors.inkMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            {!unserviceableLocation && !showNoLocation && !showNetworkError && menuData?.kitchenName && (
              <Text style={{ fontSize: 12, fontFamily: fontFamily.bold, color: colors.success, marginLeft: 20 }}>
                ⚡ Live from {menuData.kitchenName} (10-15m)
              </Text>
            )}
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => { triggerHaptic(); setShowSearch(!showSearch); }}
            >
              <Search size={22} color={colors.ink} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => { triggerHaptic(); navigation.navigate('ProfileTab'); }}
            >
              {user?.photo_url ? (
                <NetworkImage uri={user.photo_url} style={styles.profileImage} fallbackText={user?.name?.[0]?.toUpperCase() || '?'} />
              ) : (
                <User size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>`;

content = content.replace(headerUiStr, newHeaderUiStr);

// 5. Replace FlatList with SectionList
const flatListStr = `<FlatList
        data={
          isServiceabilityChecking || unserviceableLocation || showNoLocation || showNetworkError
            ? []
            : filteredItems
        }
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={6}
        ListHeaderComponent={`;

const sectionListStr = `<SectionList
        ref={sectionListRef}
        sections={
          isServiceabilityChecking || unserviceableLocation || showNoLocation || showNetworkError
            ? []
            : sections
        }
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={`;

content = content.replace(flatListStr, sectionListStr);

// 6. Remove the big live banner from ListHeaderComponent and hide search appropriately
const liveBannerRegex = /\{!unserviceableLocation && !showNoLocation && !showNetworkError && \(\s*<Animated\.View entering=\{FadeInDown\.duration\(400\)\}>\s*<TouchableOpacity[\s\S]*?<\/TouchableOpacity>\s*<\/Animated\.View>\s*\)\}/;
content = content.replace(liveBannerRegex, "");

const searchBarRegex = /\{!unserviceableLocation && !showNoLocation && !showNetworkError && \(\s*<View style=\{styles\.searchBarContainer\}>[\s\S]*?<\/View>\s*\)\}/;
const newSearchBar = `{showSearch && !unserviceableLocation && !showNoLocation && !showNetworkError && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.searchBarContainer}>
                <Search size={20} color={colors.primary} style={styles.searchIcon} />
                <TextInput
                  placeholder="Search for a craving..."
                  placeholderTextColor={colors.inkFaint}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </Animated.View>
            )}`;
content = content.replace(searchBarRegex, newSearchBar);

// Move Veg Toggle into Categories row
const vegToggleCode = `
                <View style={[styles.vegToggleWrapper, { marginRight: spacing.md }]}>
                  <Text style={[styles.vegText, isVegOnly && styles.vegTextActive]}>VEG</Text>
                  <Switch
                    value={isVegOnly}
                    onValueChange={(val) => {
                      triggerHaptic();
                      setIsVegOnly(val);
                    }}
                    trackColor={{ false: colors.border, true: colors.primaryTint }}
                    thumbColor={isVegOnly ? colors.primary : colors.white}
                    style={styles.vegSwitch}
                  />
                </View>`;

const categoriesRegex = /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{styles\.mindScroll\}>/;
content = content.replace(categoriesRegex, `<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mindScroll}>\n${vegToggleCode}`);

// Replace FlatList closing with SectionList closing
content = content.replace(/\n      <\/FlatList>/, "\n      </SectionList>");

// 7. Add Floating Menu Button
const floatingMenuButtonStr = `      {/* ── Floating Menu FAB ── */}
      {!unserviceableLocation && !showNoLocation && !showNetworkError && categories.length > 1 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity 
            style={styles.menuFab}
            activeOpacity={0.9}
            onPress={() => { triggerHaptic(); setShowMenuPopup(!showMenuPopup); }}
          >
            <Menu size={20} color={colors.white} />
            <Text style={styles.menuFabText}>MENU</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu Popup */}
      {showMenuPopup && (
        <TouchableOpacity 
          style={styles.menuPopupOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMenuPopup(false)}
        >
          <View style={styles.menuPopupContainer}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {categories.map((cat: any) => (
                <TouchableOpacity 
                  key={cat} 
                  style={styles.menuPopupItem}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedCategory(cat);
                    setShowMenuPopup(false);
                    if (cat === 'All') {
                      sectionListRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0 });
                    } else {
                      const sIdx = sections.findIndex(s => s.title === cat);
                      if (sIdx >= 0) {
                        sectionListRef.current?.scrollToLocation({ sectionIndex: sIdx, itemIndex: 0 });
                      }
                    }
                  }}
                >
                  <Text style={[styles.menuPopupText, selectedCategory === cat && { color: colors.primary, fontFamily: fontFamily.bold }]}>
                    {cat}
                  </Text>
                  <Text style={styles.menuPopupCount}>
                    {cat === 'All' ? menuData?.items?.length : sections.find(s => s.title === cat)?.data?.length || 0}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      )}`;

content = content.replace("      {/* ── Sticky Floating Cart ── */}", floatingMenuButtonStr + "\n\n      {/* ── Sticky Floating Cart ── */}");

// 8. Add new styles
const newStyles = `
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    zIndex: 1000,
  },
  menuFab: {
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  menuFabText: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 14,
    marginLeft: spacing.sm,
    letterSpacing: 1,
  },
  menuPopupOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1001,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 160,
  },
  menuPopupContainer: {
    backgroundColor: colors.surface,
    width: 250,
    borderRadius: radius.xl,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  menuPopupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuPopupText: {
    fontSize: 15,
    fontFamily: fontFamily.medium,
    color: colors.ink,
  },
  menuPopupCount: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: colors.inkFaint,
  },
`;

const lastBracketRegex = /\}\);\s*export default HomeScreen;/;
content = content.replace(lastBracketRegex, newStyles + "\n});\nexport default HomeScreen;");

fs.writeFileSync('mobile/src/screens/HomeScreen.tsx', content, 'utf8');
console.log("Refactor complete.");
