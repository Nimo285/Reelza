/**
 * Reelza — one combined server
 * ------------------------------------------------
 * - Serves the pages from /public with the real domain filled in
 *   (canonical tags, Open Graph URLs, schema, contact e-mail)
 * - Generates /sitemap.xml and /robots.txt automatically
 * - 301-redirects old/duplicate URLs (/privacy.html, /index.html, www vs non-www, http → https)
 * - GET /api/fetch-video?url=<instagram link>  → looks up the public media
 * - GET /api/download?url=<cdn link>&type=video → streams the file as a real download
 *
 * SETUP: copy .env.example to .env, fill it in, then `npm install` and `npm start`.
 */

require('dotenv').config();
const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
app.set('trust proxy', 1);              // correct visitor IP + https detection behind Render/Railway/Nginx/Cloudflare
app.set('case sensitive routing', true); // /Privacy is not a duplicate of /privacy
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = (process.env.RAPIDAPI_KEY || '').trim();
const RAPIDAPI_HOST = (process.env.RAPIDAPI_HOST ||
  'instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com').trim();
const API_BASE = process.env.RAPIDAPI_BASE_URL || `https://${RAPIDAPI_HOST}`;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Site identity (SEO)
// ---------------------------------------------------------------------------
let SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (SITE_URL && !/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(SITE_URL)) {
  console.warn('⚠️  SITE_URL must look like https://yourdomain.com (no path, no trailing text). Ignoring it.');
  SITE_URL = '';
}
const SITE_HOST = SITE_URL ? new URL(SITE_URL).host : '';

// Redirect http → https. On by default when SITE_URL starts with https://.
// If your host already forces HTTPS and you see "too many redirects", set ENFORCE_HTTPS=false.
const ENFORCE_HTTPS = process.env.ENFORCE_HTTPS
  ? process.env.ENFORCE_HTTPS === 'true'
  : SITE_URL.startsWith('https://');

const GSC_TOKEN = /^[A-Za-z0-9_-]{10,100}$/.test((process.env.GSC_VERIFICATION || '').trim())
  ? process.env.GSC_VERIFICATION.trim() : '';
const CONTACT_EMAIL_ENV = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test((process.env.CONTACT_EMAIL || '').trim())
  ? process.env.CONTACT_EMAIL.trim() : '';

function baseUrl(req){
  if (SITE_URL) return SITE_URL;
  const host = req.get('host') || 'localhost';
  const safeHost = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : 'localhost';
  return `${req.protocol}://${safeHost}`;
}
function contactEmail(req){
  if (CONTACT_EMAIL_ENV) return CONTACT_EMAIL_ENV;
  const host = (SITE_HOST || req.get('host') || 'localhost').replace(/:\d+$/, '').replace(/^www\./, '');
  return 'hello@' + host;
}
function isLocalHost(host){
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host || '');
}

// ---------------------------------------------------------------------------
// 1) HTTPS + one canonical hostname (www vs non-www) + security headers
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const host = req.get('host') || '';
  if (isLocalHost(host)) return next();

  const wrongHost = SITE_HOST && host !== SITE_HOST &&
    (host === 'www.' + SITE_HOST || 'www.' + host === SITE_HOST);
  const needsHttps = ENFORCE_HTTPS && req.protocol !== 'https';

  if (wrongHost || needsHttps) {
    const origin = wrongHost ? SITE_URL : 'https://' + host;
    return res.redirect(301, origin + req.originalUrl);
  }
  if (req.protocol === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
});

app.use(compression());

// ---------------------------------------------------------------------------
// 2) Clean URLs: /privacy.html → /privacy, /index.html → /, no trailing slash
// ---------------------------------------------------------------------------
const CLEAN_URLS = { '/index.html': '/', '/privacy.html': '/privacy', '/terms.html': '/terms' };
app.use((req, res, next) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  if (CLEAN_URLS[req.path]) return res.redirect(301, CLEAN_URLS[req.path] + qs);
  if (req.path.length > 1 && req.path.endsWith('/')) return res.redirect(301, req.path.replace(/\/+$/, '') + qs);
  next();
});

// ---------------------------------------------------------------------------
// 3) Pages (HTML templates in /public with %SITE_URL% etc. filled in)
// ---------------------------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, 'public');
const PAGES = { '/': 'index.html', '/privacy': 'privacy.html', '/terms': 'terms.html' };
const pageCache = new Map();

function loadPage(file){
  const full = path.join(PUBLIC_DIR, file);
  const stat = fs.statSync(full);
  const cached = pageCache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;
  const entry = {
    html: fs.readFileSync(full, 'utf8'),
    mtimeMs: stat.mtimeMs,
    lastmod: stat.mtime.toISOString().slice(0, 10)
  };
  pageCache.set(file, entry);
  return entry;
}

function renderPage(file, req){
  return loadPage(file).html
    .split('%SITE_URL%').join(baseUrl(req))
    .split('%CONTACT_EMAIL%').join(contactEmail(req))
    .split('%GSC_META%').join(GSC_TOKEN ? `<meta name="google-site-verification" content="${GSC_TOKEN}">` : '');
}

for (const [route, file] of Object.entries(PAGES)) {
  app.get(route, (req, res) => {
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    res.type('html').send(renderPage(file, req));
  });
}

function notFound(req, res){
  res.status(404);
  try { return res.type('html').send(renderPage('404.html', req)); }
  catch { return res.type('text').send('404 — page not found'); }
}

// Raw .html files are never served directly (only through the clean URLs above)
app.use((req, res, next) => (/\.html?$/i.test(req.path) ? notFound(req, res) : next()));

// ---------------------------------------------------------------------------
// 4) robots.txt + sitemap.xml (always use the real domain)
// ---------------------------------------------------------------------------
app.get('/robots.txt', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('text/plain').send(
    'User-agent: *\n' +
    'Allow: /\n' +
    'Disallow: /api/\n\n' +
    `Sitemap: ${baseUrl(req)}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const base = baseUrl(req);
  const urls = Object.entries(PAGES).map(([route, file]) =>
    `  <url>\n    <loc>${base}${route}</loc>\n    <lastmod>${loadPage(file).lastmod}</lastmod>\n  </url>`
  ).join('\n');
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n'
  );
});

// ---------------------------------------------------------------------------
// 5) Static assets (og-image, favicons) — cached for a week
// ---------------------------------------------------------------------------
app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '7d' }));

// ---------------------------------------------------------------------------
// 6) API
// ---------------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow'); // API responses should never appear in search
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ---- small in-memory rate limiter (swap for express-rate-limit at real scale) ----
const hits = new Map();
function rateLimited(ip, bucket, max){
  const key = bucket + ':' + ip;
  const now = Date.now();
  const windowMs = 60_000;
  const record = hits.get(key) || { count: 0, start: now };
  if (now - record.start > windowMs){ record.count = 0; record.start = now; }
  record.count += 1;
  hits.set(key, record);
  return record.count > max;
}
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [k, v] of hits) if (v.start < cutoff) hits.delete(k);
}, 60_000).unref();

function isValidInstagramUrl(raw){
  try{
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'instagram.com') return false;
    return /^\/(reel|reels|p|tv)\//.test(u.pathname);
  }catch{
    return false;
  }
}

// Only Instagram/Facebook CDN hosts may be proxied — stops the download route being an open proxy.
const ALLOWED_CDN = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
function isAllowedMediaUrl(raw){
  try{
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_CDN.test(u.hostname);
  }catch{
    return false;
  }
}

// ---- PRIMARY: RapidAPI "Instagram Downloader" → GET /convert?url=... ----
// Response shape: { media: [{ type, quality, thumbnail, url }, ...] }
function normalizeMedia(data){
  const list = data && Array.isArray(data.media) ? data.media : [];
  return list
    .filter(m => m && typeof m.url === 'string' && /^https?:\/\//.test(m.url))
    .map(m => ({
      type: m.type === 'video' ? 'video' : 'image',
      quality: m.quality || '',
      url: m.url,
      thumbnail: m.thumbnail || ''
    }));
}

async function fetchViaProviderApi(targetUrl){
  if (!RAPIDAPI_KEY) return { items: [] };

  const apiRes = await fetch(`${API_BASE}/convert?url=${encodeURIComponent(targetUrl)}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST
    },
    timeout: 25_000
  });

  if (!apiRes.ok) {
    const body = (await apiRes.text().catch(() => '')).slice(0, 300);
    console.error(`[provider] HTTP ${apiRes.status} — ${body}`);
    const err = new Error('provider-' + apiRes.status);
    err.providerStatus = apiRes.status;
    throw err;
  }

  const data = await apiRes.json();
  return {
    items: normalizeMedia(data),
    caption: (data && (data.caption || data.title)) || ''
  };
}

// ---- FALLBACK: public og:video tag (only used if no API key is set) ----
async function fetchViaDirectScrape(targetUrl){
  const pageRes = await fetch(targetUrl, { headers: { 'User-Agent': BROWSER_UA }, timeout: 15_000 });
  if (!pageRes.ok) return { items: [] };

  const html = await pageRes.text();
  const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
  const captionMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (!videoMatch) return { items: [] };

  return {
    items: [{ type: 'video', quality: '', url: videoMatch[1].replace(/&amp;/g, '&'), thumbnail: '' }],
    caption: captionMatch ? captionMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : ''
  };
}

app.get('/api/fetch-video', async (req, res) => {
  if (rateLimited(req.ip, 'fetch', 20)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  const targetUrl = req.query.url;
  if (!targetUrl || !isValidInstagramUrl(targetUrl)) {
    return res.status(400).json({ error: 'That doesn\'t look like a public Instagram Reel, post, or IGTV link.' });
  }

  try {
    let result = { items: [] };
    try {
      result = RAPIDAPI_KEY ? await fetchViaProviderApi(targetUrl) : await fetchViaDirectScrape(targetUrl);
    } catch (err) {
      if (err.providerStatus) {
        return res.status(503).json({ error: 'The download service is busy right now. Please try again in a few minutes.' });
      }
      console.error('[fetch-video]', err.message);
    }

    if (!result.items.length) {
      return res.status(422).json({
        error: 'We couldn\'t find a video at that link. The post may be private, deleted, or not a video.'
      });
    }

    const firstVideo = result.items.find(i => i.type === 'video');
    const thumbnail = (firstVideo && firstVideo.thumbnail) || result.items[0].thumbnail || '';
    return res.json({ items: result.items, thumbnail, caption: result.caption || '' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong on our side. Please try again shortly.' });
  }
});

// ---- stream the file to the browser as a real download ----
app.get('/api/download', async (req, res) => {
  if (rateLimited(req.ip, 'dl', 30)) {
    return res.status(429).send('Too many requests. Please wait a minute and try again.');
  }

  const target = req.query.url;
  if (!target || !isAllowedMediaUrl(target)) {
    return res.status(400).send('Invalid media link.');
  }

  const isVideo = req.query.type === 'video';
  const filename = `reelza-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'manual', // a redirect to another host would bypass the allow-list
      timeout: 20_000
    });
    if (!upstream.ok) {
      console.error(`[download] upstream HTTP ${upstream.status}`);
      return res.status(502).send('That file is no longer available. Go back and fetch the link again.');
    }

    const upstreamType = upstream.headers.get('content-type') || '';
    const safeType = /^(video|image)\//.test(upstreamType) ? upstreamType : (isVideo ? 'video/mp4' : 'image/jpeg');
    res.setHeader('Content-Type', safeType);
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    upstream.body.on('error', () => res.destroy());
    res.on('close', () => { if (upstream.body.destroy) upstream.body.destroy(); });
    upstream.body.pipe(res);
  } catch (err) {
    console.error('[download]', err.message);
    if (!res.headersSent) res.status(502).send('Download failed. Please try again.');
    else res.destroy();
  }
});

// ---------------------------------------------------------------------------
// 7) Anything else → real 404 (not a "soft 404")
// ---------------------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  notFound(req, res);
});

app.listen(PORT, () => {
  console.log(`Reelza running at http://localhost:${PORT}`);
  console.log(RAPIDAPI_KEY ? '✅ RapidAPI key loaded.'
    : '⚠️  RAPIDAPI_KEY is not set — using the unreliable fallback scraper. Add your key to .env.');
  console.log(SITE_URL ? `✅ SITE_URL = ${SITE_URL} (HTTPS redirect ${ENFORCE_HTTPS ? 'ON' : 'OFF'})`
    : '⚠️  SITE_URL is not set — canonical tags will use whatever address the visitor used. Set SITE_URL=https://yourdomain.com in .env before launch.');
});
