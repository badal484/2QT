const axios = require('axios');

async function main() {
  const API_URL = 'https://twoqt-3kjw.onrender.com/api/v1';
  console.log('Logging in as super_admin to Render backend...');
  
  try {
    const loginRes = await axios.post(`${API_URL}/auth/verify-otp`, {
      phone: '917896495426',
      otp: '123456'
    });
    console.log('Login successful! User role:', loginRes.data.user?.role);
    const token = loginRes.data.accessToken || loginRes.data.token;
    
    if (token) {
      console.log('Calling /admin/orders/complete-all-live...');
      const completeRes = await axios.post(`${API_URL}/admin/orders/complete-all-live`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Complete all live orders result:', completeRes.data);
    }
  } catch (err) {
    console.error('Error during API call:', err.response?.data || err.message);
  }
}

main();
