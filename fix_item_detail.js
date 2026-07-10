const fs = require('fs');
let content = fs.readFileSync('mobile/src/screens/ItemDetailScreen.tsx', 'utf8');
content = content.replace(/const GREEN = colors\.primary;\n/, '');
content = content.replace(/const GREEN_LIGHT = colors\.primaryTint;\n/, '');
content = content.replace(/\bGREEN_LIGHT\b/g, 'colors.primaryTint');
content = content.replace(/\bGREEN\b/g, 'colors.primary');
fs.writeFileSync('mobile/src/screens/ItemDetailScreen.tsx', content, 'utf8');
