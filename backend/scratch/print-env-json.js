// print-env-json.js
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('No .env file found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*'([^']+)'/);

if (!match) {
  const matchDouble = envContent.match(/FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*"([^"]+)"/);
  if (!matchDouble) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON not found in .env');
    process.exit(1);
  }
  console.log('--- COPY THE VALUE BELOW (DO NOT INCLUDE QUOTES): ---');
  console.log(matchDouble[1]);
} else {
  console.log('--- COPY THE VALUE BELOW (DO NOT INCLUDE QUOTES): ---');
  console.log(match[1]);
}
