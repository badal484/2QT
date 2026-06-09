const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = 'http://localhost:8000/api/v1';

async function test() {
  const cToken = jwt.sign({ userId: '900b1a0e-a4be-419b-ab86-277e9233682f', role: 'rider' }, process.env.JWT_SECRET || 'secret');
  // Need a real rider id and order id
}
