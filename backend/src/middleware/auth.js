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
    req.authMobile = decoded.mobile;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
};

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

module.exports = { protectUser, protectAdmin };
