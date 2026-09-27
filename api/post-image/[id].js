// GET /api/post-image/:id
//
// Post photos are saved straight into Supabase as base64 data: URLs, which
// works fine for <img> tags in the browser but can't be used as an
// og:image — link-preview crawlers need an actual URL they can fetch.
// This endpoint decodes the post's first photo and serves it as a real
// image response. Falls back to the site-wide thumbnail if the post has
// no photo of its own, and to a plain 404 if neither exists.

const SUPABASE_URL = 'https://ccfmstjugpmewgfbsiwi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZm1zdGp1Z3BtZXdnZmJzaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzg5NDksImV4cCI6MjEwNTg1NDk0OX0.7ajmoWHggJKsFX-B2TZojSMzZFVaNOEXbBJKmG9pdx0';

module.exports = async (req, res) => {
  const id = req.query.id;

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=media_data,media_type`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    const post = Array.isArray(rows) ? rows[0] : null;
    const postImage = post && firstImageDataUrl(post);
    if (postImage) return sendDataUrl(res, postImage);

    // No photo on this post — fall back to the site's own thumbnail.
    const sr = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=thumbnail`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const srows = await sr.json();
    const fallback = srows[0] && srows[0].thumbnail;
    if (fallback) return sendDataUrl(res, fallback);

    res.status(404).send('No image');
  } catch (err) {
    res.status(500).send('Error loading image');
  }
};

function firstImageDataUrl(post) {
  if (!post.media_data) return null;
  let items;
  try {
    const parsed = JSON.parse(post.media_data);
    items = Array.isArray(parsed) ? parsed : [{ data: post.media_data, type: post.media_type }];
  } catch (err) {
    items = [{ data: post.media_data, type: post.media_type }];
  }
  const img = items.find(
    (m) => (m.type || 'image') === 'image' && typeof m.data === 'string' && m.data.startsWith('data:image')
  );
  return img ? img.data : null;
}

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
