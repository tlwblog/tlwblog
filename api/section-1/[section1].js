// GET /home  and  GET /board  (rewritten here by vercel.json)
//
// Same idea as api/post/[id].js: crawlers don't run this site's JavaScript,
// so the Home and Wonder Board tabs (which are really just the same
// index.html with a hash like #home / #board) all showed one identical,
// generic preview no matter which one you shared. This gives each of
// those two sections its own title, description and real image.

const SUPABASE_URL = 'https://ccfmstjugpmewgfbsiwi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZm1zdGp1Z3BtZXdnZmJzaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzg5NDksImV4cCI6MjEwNTg1NDk0OX0.7ajmoWHggJKsFX-B2TZojSMzZFVaNOEXbBJKmG9pdx0';

const fs = require('fs');
const path = require('path');

const SECTIONS = {
  home: {
    title: 'to live wonderfully',
    description: 'A gentle little blog about living well.'
  },
  board: {
    title: 'The Wonder Board — to live wonderfully',
    description: "A little vision board — quiet anchors for my mind, my heart, and my days."
  }
};

module.exports = async (req, res) => {
  const section = req.query.section;
  const meta = SECTIONS[section];
  if (!meta) {
    res.status(404).send('Not found');
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const siteUrl = `${proto}://${host}`;

  let settings = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=thumbnail,profile_photo,profile_photo_type,vision_board`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    settings = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    // Supabase unreachable — fall through and serve the page with defaults below.
  }

  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  } catch (err) {
    res.status(500).send('Site template missing.');
    return;
  }

  const pageUrl = `${siteUrl}/${section}`;
  const imageUrl = `${siteUrl}/api/section-image/${section}`;

  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(meta.title)}</title>`);
  html = setContentById(html, 'og-title', meta.title);
  html = setContentById(html, 'twitter-title', meta.title);
  html = setContentById(html, 'og-description', meta.description);
  html = setContentById(html, 'twitter-description', meta.description);
  html = setContentById(html, 'og-url', pageUrl);
  html = setContentById(html, 'og-image', imageUrl);
  html = setContentById(html, 'twitter-image', imageUrl);

  // The Wonder Board's vision board can hold videos, not just photos. If
  // there's no photo tile at all but there is a video, also point crawlers
  // that support inline video previews (Facebook does) at the real video —
  // og:image above still carries the site's fallback photo for everyone else.
  if (section === 'board' && settings && hasVideoButNoImage(settings.vision_board)) {
    html = html.replace(
      '</head>',
      `<meta property="og:video" content="${siteUrl}/api/section-video/board">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="640">
<meta property="og:video:height" content="640"></head>`
    );
  }

  // Send real visitors straight into the right tab of the app — 'home' and
  // 'board' are already valid tab names the app understands.
  html = html.replace('</head>', `<script>try{ location.hash = '${section}'; }catch(e){}</script></head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};

function hasVideoButNoImage(visionBoard) {
  if (!Array.isArray(visionBoard)) return false;
  const hasImage = visionBoard.some((t) => t && t.media && (t.mediaType || 'image') === 'image');
  if (hasImage) return false;
  return visionBoard.some((t) => t && t.media && t.mediaType === 'video');
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setContentById(html, id, value) {
  const re = new RegExp(`(id="${id}"[^>]*content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}
