fetch('http://localhost:8000/api/v1/menu/zones').then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(e => console.error(e));
