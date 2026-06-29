const jwt = require('jsonwebtoken');
require('dotenv').config();
const token = jwt.sign({ id: 'super_admin_123', role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);
