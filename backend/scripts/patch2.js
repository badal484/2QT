const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.ts', 'utf8');
code = code.replace(
  "const response = await imagekit.files.upload({",
  "console.log('Sending to ImageKit... Size:', req.file.buffer.length);\ntry {\nconst response = await imagekit.files.upload({"
);
code = code.replace(
  "res.json({ url: (response as any).url });",
  "console.log('ImageKit upload success:', (response as any).url);\nres.json({ url: (response as any).url });\n} catch (ikErr) { console.error('IK ERROR', ikErr); throw ikErr; }"
);
fs.writeFileSync('src/routes/admin.ts', code);
