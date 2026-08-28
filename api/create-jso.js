const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// coba shorten ke bit.ly kalau BITLY_TOKEN ada, fallback is.gd -> tinyurl
async function tryShorten(longUrl) {
  // 1. bit.ly (prioritas karena user minta bit.ly)
  if (process.env.BITLY_TOKEN) {
    try {
      const r = await fetch('https://api-ssl.bitly.com/v4/shorten', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ long_url: longUrl })
      });
      if (r.ok) {
        const j = await r.json();
        if (j.link) return { shortUrl: j.link, provider: 'bit.ly' };
      } else {
        console.warn('bit.ly failed', await r.text());
      }
    } catch (e) {
      console.warn('bit.ly error', e.message);
    }
  }
  // 2. is.gd (gratis, tanpa token, hasil mirip bit.ly)
  try {
    const r = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
    if (r.ok) {
      const j = await r.json();
      if (j.shorturl) return { shortUrl: j.shorturl, provider: 'is.gd' };
    }
  } catch (e) {
    console.warn('is.gd error', e.message);
  }
  // 3. tinyurl
  try {
    const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    if (r.ok) {
      const t = (await r.text()).trim();
      if (t.startsWith('http')) return { shortUrl: t, provider: 'tinyurl' };
    }
  } catch (e) {
    console.warn('tinyurl error', e.message);
  }
  return null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const source = body && body.source;
    const wantShort = body && body.shorten !== false; // default true

    if (typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ error: 'source is required' });
    }
    if (source.length > 2_000_000) {
      return res.status(413).json({ error: 'Payload terlalu besar (max 2MB)' });
    }

    const id = crypto.createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 8);
    const filename = `${id}.js`;

    // simpan ke filesystem (hobby-compatible, tanpa vercel blob)
    // di Vercel hobby /tmp ephemeral tapi tetap bisa di-serve untuk request berikutnya di instance yang sama
    // kita juga simpan mapping untuk di-serve via api/jso
    const dirs = ['/tmp/jso', path.join(__dirname, '..', 'tmp', 'jso')];
    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, filename), source, 'utf8');
        // simpan juga meta untuk jso handler
        fs.writeFileSync(path.join(dir, `${id}.meta.json`), JSON.stringify({ id, created: Date.now() }), 'utf8');
      } catch (e) {
        console.warn('fs write failed', dir, e.message);
      }
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`;
    const longUrl = `${origin}/jso/${id}.js`;

    let short = null;
    let shortUrl = null;
    if (wantShort) {
      short = await tryShorten(longUrl);
      if (short) shortUrl = short.shortUrl;
    }

    // tag tanpa kutip sesuai request: <script src=https://bit.ly/xxxx></script>
    const tag = shortUrl ? `<script src=${shortUrl}><\/script>` : `<script src=${longUrl}><\/script>`;

    return res.status(200).json({
      id,
      filename,
      url: `/jso/${id}.js`,
      longUrl,
      shortUrl,
      provider: short ? short.provider : null,
      tag,
      via: 'fs-hobby',
    });
  } catch (error) {
    console.error('create-jso error:', error);
    return res.status(500).json({ error: 'Failed to store JSO', message: error?.message || 'Unknown error' });
  }
};
