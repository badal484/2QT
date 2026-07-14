// test-sa.js
require('dotenv').config();
const { cert } = require('firebase-admin/app');

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
console.log('Env var present:', !!serviceAccountEnv);

if (serviceAccountEnv) {
  try {
    const serviceAccount = JSON.parse(serviceAccountEnv);
    console.log('Parsed type:', typeof serviceAccount);
    console.log('Has private_key:', !!serviceAccount.private_key);
    console.log('Private key length:', serviceAccount.private_key ? serviceAccount.private_key.length : 0);
    console.log('Private key preview:', serviceAccount.private_key ? serviceAccount.private_key.slice(0, 50) + '...' + serviceAccount.private_key.slice(-50) : '');
    
    // Test the replace
    const processedKey = serviceAccount.private_key.replace(/\\n/g, '\n');
    console.log('After replace length:', processedKey.length);
    console.log('After replace contains literal \\n:', processedKey.includes('\\n'));
    console.log('After replace contains real newline:', processedKey.includes('\n'));
    
    serviceAccount.private_key = processedKey;
    const cred = cert(serviceAccount);
    console.log('Credential created successfully:', !!cred);
  } catch (err) {
    console.error('Error testing:', err);
  }
}
