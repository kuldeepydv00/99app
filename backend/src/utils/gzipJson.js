// Big JSON replies (16 KB+) are:
// - gzip-compressed when the browser accepts it (all browsers do): lists like all bets or the game
//   ledger can be many MB; compressed they are about 10x smaller;
// - tagged with an ETag, so a browser asking again for the same data gets "304 Not Modified" and no
//   body at all (browsers do this by themselves when they have the earlier reply).
// The last few compressed replies are kept, so the same big reply is not compressed again for every
// player. Small replies go through Express as before (Express adds ETag / 304 to those itself).
const zlib = require('zlib');
const crypto = require('crypto');

const MIN_BYTES = 16 * 1024;
const KEEP = 40;               // compressed replies kept in memory
const zipped = new Map();      // etag -> gzip Buffer (oldest first)

function remember(tag, buf) {
  zipped.set(tag, buf);
  if (zipped.size > KEEP) zipped.delete(zipped.keys().next().value);
}

function matches(req, tag) {
  const inm = String(req.headers['if-none-match'] || '');
  return !!inm && inm.split(',').some(t => t.trim() === tag || t.trim() === '*');
}

module.exports = function gzipJson(req, res, next) {
  const gzipOk = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  const plainJson = res.json.bind(res);
  res.json = (body) => {
    let text;
    try { text = JSON.stringify(body); } catch (e) { return plainJson(body); }
    if (text === undefined || text.length < MIN_BYTES) return plainJson(body);
    const tag = `W/"${crypto.createHash('sha1').update(text).digest('base64').slice(0, 27)}"`;
    const ok = (res.statusCode || 200) === 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');
    if (ok) res.setHeader('ETag', tag);
    if (ok && (req.method === 'GET' || req.method === 'HEAD') && matches(req, tag)) {
      res.statusCode = 304;
      res.removeHeader('Content-Type');
      return res.end();
    }
    if (!gzipOk) { res.setHeader('Content-Length', Buffer.byteLength(text)); return res.end(text); }
    const send = buf => {
      if (res.headersSent) return;
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', buf.length);
      res.end(buf);
    };
    const hit = ok && zipped.get(tag);
    if (hit) { send(hit); return res; }
    zlib.gzip(text, { level: 6 }, (err, buf) => {
      if (res.headersSent) return;
      if (err) return res.end(text);
      if (ok) remember(tag, buf);
      send(buf);
    });
    return res;
  };
  next();
};
