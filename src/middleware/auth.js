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
const validateLogin = (username, password) => {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  
  // For simplicity, we're doing a direct comparison
  // In production, you should hash the password in .env and compare hashes
  return username === adminUsername && password === adminPassword;
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
