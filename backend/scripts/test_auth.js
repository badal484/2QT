const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });
const token = jwt.sign({ id: '11111111-1111-1111-1111-111111111111', role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
console.log(token);
