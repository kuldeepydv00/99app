const jwt = require('jsonwebtoken');

function getSecret() {
  return process.env.JWT_SECRET || 'dev_insecure_secret_change_me_in_env';
}

// Issued the moment a user completes real OTP verification. Encodes their mobile
// number (the identity this whole app is keyed on) + role, nothing more.
function signUserToken(mobile) {
  return jwt.sign({ mobile, role: 'user' }, getSecret(), { expiresIn: '30d' });
}

// Issued the moment an admin completes login + OTP verification.
function signAdminToken() {
  return jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: '12h' });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signUserToken, signAdminToken, verifyToken };
