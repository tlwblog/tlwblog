// GET /api/section-image/:section  (section is "home" or "board")
//
// Picks the best available real photo for that section's preview and
// serves it as actual image bytes (crawlers can't use base64 data: URLs).

const SUPABASE_URL = 'https://ccfmstjugpmewgfbsiwi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZm1zdGp1Z3BtZXdnZmJzaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzg5NDksImV4cCI6MjEwNTg1NDk0OX0.7ajmoWHggJKsFX-B2TZojSMzZFVaNOEXbBJKmG9pdx0';

module.exports = async (req, res) => {
  const section = req.query.section;

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=thumbnail,profile_photo,profile_photo_type,vision_board`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    const settings = Array.isArray(rows) ? rows[0] : null;
    if (!settings) {
      res.status(404).send('No image');
      return;
    }

    if (section === 'board') {
      const tiles = Array.isArray(settings.vision_board) ? settings.vision_board : [];
      const imageTile = tiles.find(
        (t) => t && t.media && (t.mediaType || 'image') === 'image' && t.media.startsWith('data:image')
      );
      if (imageTile) return sendDataUrl(res, imageTile.media);
    }

    // Home, or a Wonder Board with no photo tile of its own — fall back to
    // the site's thumbnail, then the profile photo.
    if (settings.thumbnail) return sendDataUrl(res, settings.thumbnail);
    if (settings.profile_photo && (settings.profile_photo_type || 'image') === 'image') {
      return sendDataUrl(res, settings.profile_photo);
    }

    res.status(404).send('No image');
  } catch (err) {
    res.status(500).send('Error loading image');
  }
};

function sendDataUrl(res, dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    res.status(404).send('No image');
    return;
  }
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(buffer);
}
