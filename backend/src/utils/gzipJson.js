// Sends big JSON replies gzip-compressed when the browser accepts it (all browsers do).
// Admin lists like all bets or the game ledger can be many MB; compressed they are about 10x smaller.
const zlib = require('zlib');

const MIN_BYTES = 16 * 1024;

module.exports = function gzipJson(req, res, next) {
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
  const plainJson = res.json.bind(res);
  res.json = (body) => {
    let text;
    try { text = JSON.stringify(body); } catch (e) { return plainJson(body); }
    if (text === undefined || text.length < MIN_BYTES) return plainJson(body);
    zlib.gzip(text, { level: 6 }, (err, buf) => {
      if (res.headersSent) return;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Vary', 'Accept-Encoding');
      if (err) return res.end(text);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', buf.length);
      res.end(buf);
    });
    return res;
  };
  next();
};
