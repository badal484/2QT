const fs = require('fs');

const b64 = fs.readFileSync('/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/src/assets').toString('base64');
const htmlStr = `<img src="data:image/png;base64,${b64}" style="width:100%;height:100%;object-fit:contain;"/>`;

let file = fs.readFileSync('/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/src/components/TrackingLeafletMap.tsx', 'utf8');

// Find the existing img tag and replace it
file = file.replace(/<img src="data:image\/png;base64,[^"]+" style="width:100%;height:100%;object-fit:contain;"\/>/, htmlStr);
file = file.replace(/key="tracking-map-v5"/, 'key="tracking-map-v6"');

fs.writeFileSync('/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/src/components/TrackingLeafletMap.tsx', file);
console.log('Done replacing base64 in TrackingLeafletMap.tsx');
