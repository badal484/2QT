const fs = require('fs');
const path = 'mobile/src/screens/OrderSavingsScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Import RootState & useSelector
content = content.replace(
  "import { useSafeAreaInsets } from 'react-native-safe-area-context';",
  "import { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { useSelector } from 'react-redux';\nimport { RootState } from '../store';"
);

// Get featureLoyalty
content = content.replace(
  "const OrderSavingsScreen = ({ route, navigation }: any) => {",
  "const OrderSavingsScreen = ({ route, navigation }: any) => {\n  const { featureLoyalty } = useSelector((state: RootState) => state.app);"
);

// Restore loyalty row in savingsLines
const newSavingsLines = `
    campaignDiscountPaise > 0 && {
      icon: <Zap size={18} color="#7C3AED" />,
      label: 'Campaign Deal',
      amount: campaignDiscountPaise / 100,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    featureLoyalty && loyaltyDiscountPaise > 0 && {
      icon: <Zap size={18} color="#D97706" />,
      label: 'Loyalty Points',
      amount: loyaltyDiscountPaise / 100,
      color: '#D97706',
      bg: '#FFFBEB',
    },
    walletDeductionPaise > 0 && {
`;

content = content.replace(
  /campaignDiscountPaise > 0 && \{\s*icon: <Zap size=\{18\} color="#7C3AED" \/>,\s*label: 'Campaign Deal',\s*amount: campaignDiscountPaise \/ 100,\s*color: '#7C3AED',\s*bg: '#F5F3FF',\s*\},\s*walletDeductionPaise > 0 && \{/,
  newSavingsLines.trim() + " {"
);

fs.writeFileSync(path, content, 'utf8');
