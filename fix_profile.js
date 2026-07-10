const fs = require('fs');
const path = 'mobile/src/screens/ProfileScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add feature flags to selector
content = content.replace(
  "const { user } = useSelector((state: RootState) => state.auth);",
  "const { user } = useSelector((state: RootState) => state.auth);\n  const { featureLoyalty, featureReferrals } = useSelector((state: RootState) => state.app);"
);

// 2. Restore Loyalty
// Previous:
//               <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Wallet')}>
//                 <Wallet size={20} color="#6B7280" />
//                 <Text style={styles.statLabel}>Wallet Balance</Text>
//                 <Text style={styles.statValue}>{wallet ? `₹${(wallet.balancePaise / 100).toFixed(2)}` : '₹0.00'}</Text>
//               </BouncingButton>
// Change to conditionally include Loyalty
const newCustomerStats = `
              <BouncingButton style={[styles.statBox, !featureLoyalty && { flex: 1 }]} activeOpacity={0.8} onPress={() => navigation.navigate('Wallet')}>
                <Wallet size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Wallet Balance</Text>
                <Text style={styles.statValue}>{wallet ? \`₹\${(wallet.balancePaise / 100).toFixed(2)}\` : '₹0.00'}</Text>
              </BouncingButton>
              {featureLoyalty && (
                <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Loyalty')}>
                  <Sparkles size={20} color="#FC4603" />
                  <Text style={styles.statLabel}>Loyalty Points</Text>
                  <Text style={[styles.statValue, { color: '#FC4603' }]}>{loyalty?.points || 0}</Text>
                </BouncingButton>
              )}
`;

content = content.replace(
  /<BouncingButton style=\{styles\.statBox\} activeOpacity=\{0\.8\} onPress=\{\(\) => navigation\.navigate\('Wallet'\)\}>\s*<Wallet size=\{20\} color="#6B7280" \/>\s*<Text style=\{styles\.statLabel\}>Wallet Balance<\/Text>\s*<Text style=\{styles\.statValue\}>\{wallet \? `₹\$\{\(wallet\.balancePaise \/ 100\)\.toFixed\(2\)\}` : '₹0\.00'\}<\/Text>\s*<\/BouncingButton>/,
  newCustomerStats.trim()
);

// 3. Restore Invite & Earn banner
const newReferralBanner = `
        {/* STATS ROW (Swish Style) */}
        {!isRider && featureReferrals && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <BouncingButton style={styles.referralBanner} activeOpacity={0.8} onPress={() => navigation.navigate('Referral')}>
              <View style={styles.referralIconBox}>
                <Gift size={20} color="#FFFFFF" />
              </View>
              <View style={styles.referralTexts}>
                <Text style={styles.referralTitle}>Invite & Earn ₹50</Text>
                <Text style={styles.referralSub}>Get ₹50 for every friend who orders.</Text>
              </View>
              <ChevronRight size={20} color="#FFFFFF" />
            </BouncingButton>
          </Animated.View>
        )}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
`;

content = content.replace(
  /\{\/\* STATS ROW \(Swish Style\) \*\/\}\s*<Animated\.View entering=\{FadeInDown\.delay\(100\)\.duration\(400\)\} style=\{styles\.statsRow\}>/,
  newReferralBanner.trim()
);

fs.writeFileSync(path, content, 'utf8');
