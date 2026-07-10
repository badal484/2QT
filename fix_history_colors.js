const fs = require('fs');
const path = 'mobile/src/screens/OrderHistoryScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace JSX prop strings: color="#10B981" -> color={colors.primary}
content = content.replace(/color="#10B981"/g, "color={colors.primary}");

// Replace styles
content = content.replace(/'#10B981'/g, "colors.primary");
content = content.replace(/'#ECFDF5'/g, "colors.primaryTint");
content = content.replace(/'#D1FAE5'/g, "colors.primaryTint");
content = content.replace(/'#059669'/g, "colors.primary");

fs.writeFileSync(path, content, 'utf8');
