const { put } = require('@vercel/blob');
const crypto = require('node:crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const source = body && body.source;

    if (typeof source !== 'string' || !source) {
      return res.status(400).json({ error: 'source is required' });
    }

    const id = crypto.createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 8);
    const pathname = `jso/${id}.js`;

    const blob = await put(pathname, source, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/javascript; charset=utf-8',
      cacheControlMaxAge: 31536000,
    });

    return res.status(200).json({
      id,
      filename: `${id}.js`,
      url: `/jso/${id}.js`,
      blobUrl: blob.url,
    });
  } catch (error) {
    console.error('create-jso error:', error);
    return res.status(500).json({
      error: 'Failed to store JSO',
      message: error?.message || 'Unknown error',
    });
  }
};
