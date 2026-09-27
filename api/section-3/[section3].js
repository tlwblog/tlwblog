// GET /api/section-video/:section  (only "board" is used)

const SUPABASE_URL = 'https://ccfmstjugpmewgfbsiwi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZm1zdGp1Z3BtZXdnZmJzaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzg5NDksImV4cCI6MjEwNTg1NDk0OX0.7ajmoWHggJKsFX-B2TZojSMzZFVaNOEXbBJKmG9pdx0';

module.exports = async (req, res) => {
  const section = req.query.section;
  if (section !== 'board') {
    res.status(404).send('Not found');
    return;
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=vision_board`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    const settings = Array.isArray(rows) ? rows[0] : null;
    const tiles = settings && Array.isArray(settings.vision_board) ? settings.vision_board : [];
    const videoTile = tiles.find((t) => t && t.media && t.mediaType === 'video' && t.media.startsWith('data:video'));
    if (!videoTile) {
      res.status(404).send('No video');
      return;
    }
    sendDataUrl(res, videoTile.media);
  } catch (err) {
    res.status(500).send('Error loading video');
  }
};

function sendDataUrl(res, dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    res.status(404).send('No video');
    return;
  }
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(buffer);
}
