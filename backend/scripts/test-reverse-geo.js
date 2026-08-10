const axios = require('axios');
async function test() {
  try {
    // 23.8504, 85.0601 is approx Keredari, Jharkhand
    const res = await axios.get('http://localhost:8000/api/v1/menu/geocode/reverse?lat=23.8504&lng=85.0601');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.message);
  }
}
test();
