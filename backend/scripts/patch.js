const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.ts', 'utf8');
code = code.replace(
  "router.post('/menu/upload', authenticate, requireRole('super_admin', 'admin'), upload.single('image'), async (req: AuthRequest, res) => {",
  "router.post('/menu/upload', authenticate, requireRole('super_admin', 'admin'), upload.single('image'), async (req: AuthRequest, res) => {\n    console.log('UPLOAD REQUEST RECEIVED:', !!req.file);"
);
fs.writeFileSync('src/routes/admin.ts', code);
