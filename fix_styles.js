const fs = require('fs');
const file = 'mobile/src/screens/HomeScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('viewCartText: {')) {
  content = content.replace('viewCartAction: {', 'viewCartText: {\n    color: "#fff",\n    fontFamily: fontFamily.black,\n    fontSize: 14,\n  },\n  viewCartAction: {');
  fs.writeFileSync(file, content);
}
