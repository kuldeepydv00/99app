// Banners for the website, light version.
//
// Banners uploaded in the admin panel are stored as images inside the data (base64, often 200-500 KB
// each). The website used to download them again and again with every refresh. Here the website gets
// the banner list with a short image address instead; the image itself is served once from
// /api/game/promo-image/<version>, and the phone keeps it (a new image gets a new address).
// The admin panel still reads the full banners from /api/admin/... .
const crypto = require('crypto');

const isData = v => typeof v === 'string' && (v.startsWith('data:image') || (v.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 200))));

// version of an image: a short hash, remembered per image so big strings aren't hashed every time
const versions = new Map(); // fingerprint -> hash
function versionOf(str) {
  const fp = `${str.length}:${str.slice(0, 48)}:${str.slice(-48)}`;
  let v = versions.get(fp);
  if (!v) {
    v = crypto.createHash('sha1').update(str).digest('hex').slice(0, 12);
    versions.set(fp, v);
    if (versions.size > 200) versions.delete(versions.keys().next().value);
  }
  return v;
}

const FIELDS = ['previewUrl', 'imageUrl', 'image', 'link'];
const dataField = obj => FIELDS.map(f => obj && obj[f]).find(isData) || null;
const imageUrl = data => `/api/game/promo-image/${versionOf(data)}`;

function lightBanner(b) {
  if (!b || typeof b !== 'object') return b;
  const data = dataField(b);
  if (!data) return b;
  const out = { ...b };
  for (const f of FIELDS) if (isData(out[f])) delete out[f];
  out.previewUrl = imageUrl(data);
  return out;
}

exports.publicBanners = (req, res) => {
  const { bannersListStore } = require('../store');
  res.json((bannersListStore || []).map(b => lightBanner(b)));
};

exports.publicBannerConfig = (req, res) => {
  const { bannerConfig } = require('../store');
  const cfg = { ...(bannerConfig || {}) };
  // The old default image pointed at a placeholder domain that doesn't exist
  if (/newmatkadomain\.com\/app_header\.png/.test(String(cfg.imageUrl || ''))) cfg.imageUrl = '';
  const data = dataField(cfg);
  if (data) {
    for (const f of FIELDS) if (isData(cfg[f])) delete cfg[f];
    cfg.imageUrl = imageUrl(data);
  }
  res.json(cfg);
};

// The image bytes, found by their version. Kept decoded for the few current images.
const decoded = new Map(); // version -> { type, buf }
exports.promoImage = (req, res) => {
  const { bannersListStore, bannerConfig } = require('../store');
  const v = String(req.params.v || '').replace(/[^a-f0-9]/g, '');
  let img = decoded.get(v);
  if (!img) {
    const data = [bannerConfig, ...(bannersListStore || [])].map(dataField).find(d => d && versionOf(d) === v);
    if (!data) return res.status(404).json({ success: false, message: 'Image not found' });
    const m = /^data:(image\/[A-Za-z0-9.+-]+);base64,/.exec(data);
    const b64 = m ? data.slice(m[0].length) : data.replace(/^data:[^,]*,/, '');
    const buf = Buffer.from(b64.replace(/\s/g, ''), 'base64');
    const type = m ? m[1] : (buf[0] === 0x89 ? 'image/png' : buf[0] === 0x47 ? 'image/gif' : buf.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg');
    img = { type, buf };
    decoded.set(v, img);
    if (decoded.size > 20) decoded.delete(decoded.keys().next().value);
  }
  // the address is the image's version, so the phone can keep it for good
  const etag = `"${v}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (String(req.headers['if-none-match'] || '') === etag) return res.status(304).end();
  res.setHeader('Content-Type', img.type);
  res.setHeader('Content-Length', img.buf.length);
  res.end(img.buf);
};

exports._light = lightBanner;
