const { verifyToken } = require('../utils/tokens');

// Requires a valid user JWT (issued at OTP verification). Sets req.authMobile so
// controllers can confirm the caller is acting on their own account, never someone
// else's — this app identifies users by mobile number everywhere, so that's what
// the token carries and what every protected controller must check ownership against.
const protectUser = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = verifyToken(header.split(' ')[1]);
    if (!decoded || !decoded.mobile) {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
    }
    const ended = sessionEnded(decoded);
    if (ended) return res.status(401).json(ended);
    req.authMobile = decoded.mobile;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
};

// A deleted account, or a login from before the account was deleted, is logged out.
// The apps log out when they see is_deleted / message 'No Authentication'.
function sessionEnded(decoded) {
  const { deletedMobiles, sessionCutoffs } = require('../store');
  const m = String(decoded.mobile || '').replace(/[^0-9]/g, '').slice(-10);
  const cutoff = sessionCutoffs && sessionCutoffs[m];
  const deleted = Array.isArray(deletedMobiles) && deletedMobiles.includes(m);
  const issued = Number(decoded.ims) || (Number(decoded.iat) || 0) * 1000;
  const old = cutoff && issued <= cutoff;
  if (!deleted && !old) return null;
  return {
    success: false, is_deleted: true, isDeleted: true, logout: true,
    message: 'No Authentication',
    detail: 'This account was deleted. Please log in again.'
  };
}

// Requires a valid admin JWT (issued at admin login + OTP verification).
const protectAdmin = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized, admin login required' });
  }
  try {
    const decoded = verifyToken(header.split(' ')[1]);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized as admin' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, admin session invalid or expired' });
  }
};

module.exports = { protectUser, protectAdmin, sessionEnded };
