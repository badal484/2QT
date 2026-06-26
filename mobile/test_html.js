const fs = require('fs');
const content = fs.readFileSync('src/components/TrackingLeafletMap.tsx', 'utf8');

// The html string is inside `const html = \`...\`;`
const match = content.match(/const html = `([\s\S]*?)`;/);
if (!match) {
  console.log("Could not extract html string");
  process.exit(1);
}

const htmlStr = match[1];

// We know the script tag is inside <script> ... </script>
const scriptMatch = htmlStr.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.log("Could not extract script block");
  process.exit(1);
}

let scriptContent = scriptMatch[1];
scriptContent = scriptContent.replace('${initialLat}', '20');
scriptContent = scriptContent.replace('${initialLng}', '78');
scriptContent = scriptContent.replace('${initialZoom}', '5');
scriptContent = scriptContent.replace('${iK}', '');
scriptContent = scriptContent.replace('${iH}', '');

try {
  // Use acorn to parse the script and check for syntax errors
  const acorn = require('acorn');
  acorn.parse(scriptContent, { ecmaVersion: 2020 });
  console.log("No syntax errors found in Leaflet script!");
} catch (e) {
  console.log("Syntax Error:", e);
}
