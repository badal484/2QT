const fetch = require('node-fetch');

async function test() {
  const res = await fetch('https://2-qt.vercel.app/api/proxy/admin/zones/fake-id', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test' })
  });
  console.log(res.status);
  console.log(await res.text());
}
test().catch(console.error);
