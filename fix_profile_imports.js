const fs = require('fs');
const path = 'mobile/src/screens/ProfileScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("  Award,\n  BarChart2,\n}", "  Award,\n  BarChart2,\n  Gift,\n  Sparkles,\n}");
fs.writeFileSync(path, content, 'utf8');
