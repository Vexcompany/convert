const fs = require('node:fs');
const path = require('node:path');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const rawId = String(req.query?.id || '').trim();
  const id = rawId.replace(/[^a-f0-9]/gi, '').toLowerCase();

  if (!/^[a-f0-9]{8}$/.test(id)) {
    return res.status(400).type('text/plain').send('Invalid JSO id');
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  // Hobby: coba filesystem dulu (/tmp shared per instance + tmp lokal untuk dev)
  const candidates = [
    path.join('/tmp', 'jso', `${id}.js`),
    path.join(__dirname, '..', '..', 'tmp', 'jso', `${id}.js`),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        return res.status(200).send(content);
      }
    } catch {}
  }

  // fallback: kalau file tidak ada di /tmp (cold start / instance beda), kembalikan not found yang helpful
  // user bisa re-publish (id deterministik dari hash source, jadi publish ulang akan recreate)
  return res.status(404).type('text/plain').send(
    `// JSO ${id}.js not found on this instance (Vercel Hobby /tmp ephemeral).\n` +
    `// Silakan Publish ulang dari halaman converter — id bersifat deterministik jadi URL akan sama.\n` +
    `console.error('JSO ${id} not found');`
  );
};
