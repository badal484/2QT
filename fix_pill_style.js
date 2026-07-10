const fs = require('fs');
let content = fs.readFileSync('mobile/src/screens/HomeScreen.tsx', 'utf8');

// Remove the old buggy definition
content = content.replace(/  const activeOrderPillStyle = useAnimatedStyle\(\(\) => \{\n    return \{\n      bottom: withTiming\(totalCartQty > 0 \? Math\.max\(insets\.bottom, 16\) \+ 84 : Math\.max\(insets\.bottom, 16\) \+ 16, \{ duration: 250 \}\),\n    \};\n  \}, \[totalCartQty, insets\.bottom\]\);\n/, '');

// Add the shared value instead
const insertionPoint = "  const totalCartQty = cartItems.reduce((acc, i) => acc + i.quantity, 0);\n";
const newLogic = `
  const pillBottomAnim = useSharedValue(Math.max(insets.bottom, 16) + 16);
  React.useEffect(() => {
    pillBottomAnim.value = withTiming(totalCartQty > 0 ? Math.max(insets.bottom, 16) + 84 : Math.max(insets.bottom, 16) + 16, { duration: 250 });
  }, [totalCartQty, insets.bottom]);
  
  const safePillStyle = useAnimatedStyle(() => ({
    bottom: pillBottomAnim.value
  }));
`;
content = content.replace(insertionPoint, insertionPoint + newLogic);

// Replace the usage
content = content.replace(/activeOrderPillStyle/g, 'safePillStyle');

fs.writeFileSync('mobile/src/screens/HomeScreen.tsx', content, 'utf8');
