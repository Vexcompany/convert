const { head } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  const id = String(req.query?.id || '').replace(/[^a-f0-9]/gi, '').toLowerCase();

  if (!/^[a-f0-9]{8}$/.test(id)) {
    return res.status(400).type('text/plain').send('Invalid JSO id');
  }

  try {
    const blob = await head(`jso/${id}.js`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.redirect(302, blob.url);
  } catch (error) {
    console.error('jso lookup error:', error);
    return res.status(404).type('text/plain').send('JSO file not found');
  }
};
