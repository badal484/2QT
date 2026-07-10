const fs = require('fs');
const path = 'mobile/src/screens/CheckoutScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Import RootState
content = content.replace(
  "import { clearCart } from '../store/slices/cartSlice';",
  "import { clearCart } from '../store/slices/cartSlice';\nimport { RootState } from '../store';"
);

// Get featureLoyalty
content = content.replace(
  "  const { user } = useSelector((state: any) => state.auth);",
  "  const { user } = useSelector((state: any) => state.auth);\n  const { featureLoyalty } = useSelector((state: RootState) => state.app);"
);

// Restore Loyalty Bill Row
const newBillRow = `
          {p.discountPaise > 0 && <View style={styles.billRow}><Text style={styles.billGreenLabel}>Promo Discount</Text><Text style={styles.billGreenValue}>-₹{p.discountPaise / 100}</Text></View>}
          {featureLoyalty && p.loyaltyDiscountPaise > 0 && <View style={styles.billRow}><Text style={styles.billGreenLabel}>2QT Points Used</Text><Text style={styles.billGreenValue}>-₹{p.loyaltyDiscountPaise / 100}</Text></View>}
          {p.walletDeductionPaise > 0 && <View style={styles.billRow}><Text style={styles.billGreenLabel}>Wallet Used</Text><Text style={styles.billGreenValue}>-₹{p.walletDeductionPaise / 100}</Text></View>}
`;

content = content.replace(
  /\{p\.discountPaise > 0 && <View style=\{styles\.billRow\}><Text style=\{styles\.billGreenLabel\}>Promo Discount<\/Text><Text style=\{styles\.billGreenValue\}>-₹\{p\.discountPaise \/ 100\}<\/Text><\/View>\}\s*\{p\.walletDeductionPaise > 0 && <View style=\{styles\.billRow\}><Text style=\{styles\.billGreenLabel\}>Wallet Used<\/Text><Text style=\{styles\.billGreenValue\}>-₹\{p\.walletDeductionPaise \/ 100\}<\/Text><\/View>\}/,
  newBillRow.trim()
);

// Restore Loyalty apply savings block
const newSavingsBlock = `
        {/* Use Wallet / Loyalty */}
        {(walletBal > 0 || (featureLoyalty && loyaltyPts > 0)) && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.card}>
            <Text style={styles.sectionTitle}>Apply Savings</Text>
            {walletBal > 0 && (
              <TouchableOpacity style={styles.savingsRow} activeOpacity={0.8} onPress={() => { triggerHaptic(); setUseWallet(!useWallet); }}>
                <View style={[styles.savingsIcon, useWallet && { backgroundColor: colors.primary }]}>
                  <Wallet size={16} color={useWallet ? '#fff' : colors.primary} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsTitle}>2QT Wallet</Text>
                  <Text style={styles.savingsSub}>Balance: ₹{walletBal / 100}</Text>
                </View>
                <View style={[styles.customCheckbox, useWallet && styles.customCheckboxActive]}>
                  {useWallet && <View style={styles.customCheckboxInner} />}
                </View>
              </TouchableOpacity>
            )}
            {featureLoyalty && loyaltyPts > 0 && (
              <TouchableOpacity style={[styles.savingsRow, { marginTop: walletBal > 0 ? 16 : 0 }]} activeOpacity={0.8} onPress={() => { triggerHaptic(); setUseLoyalty(!useLoyalty); }}>
                <View style={[styles.savingsIcon, useLoyalty && { backgroundColor: '#FC4603' }]}>
                  <Sparkles size={16} color={useLoyalty ? '#fff' : '#FC4603'} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsTitle}>Loyalty Points</Text>
                  <Text style={styles.savingsSub}>{loyaltyPts} points available</Text>
                </View>
                <View style={[styles.customCheckbox, useLoyalty && { borderColor: '#FC4603' }]}>
                  {useLoyalty && <View style={[styles.customCheckboxInner, { backgroundColor: '#FC4603' }]} />}
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
`;

content = content.replace(
  /\{walletBal > 0 && \(\s*<Animated\.View entering=\{FadeInDown\.delay\(150\)\.duration\(400\)\} style=\{styles\.card\}>\s*<Text style=\{styles\.sectionTitle\}>Apply Savings<\/Text>\s*<TouchableOpacity style=\{styles\.savingsRow\}.*?<\/TouchableOpacity>\s*<\/Animated\.View>\s*\)\}/s,
  newSavingsBlock.trim()
);

fs.writeFileSync(path, content, 'utf8');
