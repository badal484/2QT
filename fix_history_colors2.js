const fs = require('fs');
const path = 'mobile/src/screens/OrderHistoryScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/'#A7F3D0'/g, "colors.primaryTint");

fs.writeFileSync(path, content, 'utf8');
