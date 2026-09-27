// GET /post/:id  (rewritten here by vercel.json)
//
// Facebook/WhatsApp/Slack/etc. never run this site's JavaScript when they
// generate a link preview — they only read the <meta> tags in the raw HTML
// that comes back from the URL. Since this site is a single static
// index.html whose content loads from Supabase after the page runs, every
// shared link showed the same generic title with no image.
//
// This function fetches the real post from Supabase, takes the same
// index.html the rest of the site uses, and swaps in that post's title,
// an excerpt, and a real (fetchable) image URL before sending it back —
// so crawlers see the right preview and real visitors still get the full,
// working blog with the right post scrolled into view.

const SUPABASE_URL = 'https://ccfmstjugpmewgfbsiwi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZm1zdGp1Z3BtZXdnZmJzaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzg5NDksImV4cCI6MjEwNTg1NDk0OX0.7ajmoWHggJKsFX-B2TZojSMzZFVaNOEXbBJKmG9pdx0';

const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const id = req.query.id;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const siteUrl = `${proto}://${host}`;

  let post = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=id,title,content,media_data,media_type`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    post = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    // Supabase unreachable — fall through and just serve the page with
    // its normal default title/description below.
  }

  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  } catch (err) {
    res.status(500).send('Site template missing.');
    return;
  }

  const title = post ? plainText(post.title).slice(0, 95) || 'to live wonderfully' : 'to live wonderfully';
  const description = post
    ? excerpt(post.content)
    : 'A gentle little blog about living well.';
  const pageUrl = `${siteUrl}/post/${encodeURIComponent(id)}`;
  const imageUrl = `${siteUrl}/api/post-image/${encodeURIComponent(id)}`;

  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(title)}</title>`);
  html = setContentById(html, 'og-title', title);
  html = setContentById(html, 'twitter-title', title);
  html = setContentById(html, 'og-description', description);
  html = setContentById(html, 'twitter-description', description);
  html = setContentById(html, 'og-url', pageUrl);
  html = setContentById(html, 'og-image', imageUrl);
  html = setContentById(html, 'twitter-image', imageUrl);

  // Send real visitors' browsers straight to that post inside the app
  // (crawlers ignore this script and only read the meta tags above).
  if (post) {
    html = html.replace(
      '</head>',
      `<script>try{ location.hash = 'post-${id}'; }catch(e){}</script></head>`
    );
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};

function plainText(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function excerpt(html) {
  const text = plainText(html);
  if (!text) return 'A gentle little blog about living well.';
  return text.length > 160 ? text.slice(0, 157) + '…' : text;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Rewrites content="..." on the <meta ... id="X" ...> tag that already
// exists in index.html (see the meta tags near the top of <head>).
function setContentById(html, id, value) {
  const re = new RegExp(`(id="${id}"[^>]*content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}
