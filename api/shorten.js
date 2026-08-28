/**
 * POST /api/shorten { url: "https://..." }
 * GET  /api/shorten?url=https://...
 * Support bit.ly jika BITLY_TOKEN ada, fallback is.gd -> tinyurl
 */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function doShorten(longUrl) {
  if (process.env.BITLY_TOKEN) {
    try {
      const r = await fetch('https://api-ssl.bitly.com/v4/shorten', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.BITLY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ long_url: longUrl })
      });
      if (r.ok) {
        const j = await r.json();
        if (j.link) return { shortUrl: j.link, provider: 'bit.ly' };
      }
    } catch {}
  }
  try {
    const r = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
    if (r.ok) {
      const j = await r.json();
      if (j.shorturl) return { shortUrl: j.shorturl, provider: 'is.gd' };
    }
  } catch {}
  try {
    const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    if (r.ok) {
      const t = (await r.text()).trim();
      if (t.startsWith('http')) return { shortUrl: t, provider: 'tinyurl' };
    }
  } catch {}
  return null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let targetUrl = '';
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    targetUrl = body && body.url ? String(body.url) : '';
  } else if (req.method === 'GET') {
    targetUrl = String(req.query?.url || '');
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!targetUrl || !/^https?:\/\/.+/i.test(targetUrl)) {
    return res.status(400).json({ error: 'url harus https://...' });
  }

  const short = await doShorten(targetUrl);
  if (short) return res.status(200).json(short);
  return res.status(200).json({ shortUrl: targetUrl, provider: 'none', fallback: true });
};
