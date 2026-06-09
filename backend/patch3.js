const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');
if (!code.includes('app.use((req, res, next) => { console.log(req.method, req.url); next(); });')) {
  code = code.replace(
    "app.use(express.json({",
    "app.use((req, res, next) => { console.log('[HTTP]', req.method, req.url); next(); });\napp.use(express.json({"
  );
  fs.writeFileSync('src/index.ts', code);
}
