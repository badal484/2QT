const fs = require('fs');
const file = 'backend/src/routes/admin.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  /customization_groups \? JSON\.stringify\(customization_groups\) : null/g,
  "customization_groups ? (() => { console.log('SAVING CUST GROUPS:', JSON.stringify(customization_groups, null, 2)); return JSON.stringify(customization_groups); })() : null"
);
fs.writeFileSync(file, code);
