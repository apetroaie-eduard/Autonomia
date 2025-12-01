const bcrypt = require('bcryptjs');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  
  // Check if it's an API request
  if (req.xhr || req.path.startsWith('/api/admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Redirect to login page
  res.redirect('/admin/login');
};

// Login validation
// Supports both plain text password (for simple setup) and bcrypt hashed password
// To use hashed password, set ADMIN_PASSWORD_HASH in .env with bcrypt hash
const validateLogin = async (username, password) => {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  
  if (username !== adminUsername) {
    return false;
  }
  
  // If a password hash is provided, use secure bcrypt comparison
  if (adminPasswordHash) {
    return bcrypt.compare(password, adminPasswordHash);
  }
  
  // Fallback to plain text comparison (for development/simple setups)
  // Use constant-time comparison to prevent timing attacks
  const crypto = require('crypto');
  return crypto.timingSafeEqual(
    Buffer.from(password),
    Buffer.from(adminPassword)
  );
};

// Hash password helper (for future use with user management)
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare password helper
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = {
  isAuthenticated,
  validateLogin,
  hashPassword,
  comparePassword
};
