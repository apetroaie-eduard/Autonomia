const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const path = require('path');
const { isAuthenticated, validateLogin } = require('../middleware/auth');
const { services } = require('../models/database');
const { scheduleService, unscheduleService, checkService } = require('../services/monitor');

// Login rate limiter - stricter limits for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Login page
router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, '../../views/login.html'));
});

// Login POST with rate limiting
router.post('/login', loginLimiter, express.urlencoded({ extended: true }), async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const isValid = await validateLogin(username, password);
    if (isValid) {
      req.session.isAdmin = true;
      res.redirect('/admin');
    } else {
      res.redirect('/admin/login?error=1');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/admin/login?error=1');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Admin dashboard (protected)
router.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../views/admin.html'));
});

// API: Get all services
router.get('/api/services', isAuthenticated, (req, res) => {
  try {
    const allServices = services.getAll();
    res.json(allServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get single service
router.get('/api/services/:id', isAuthenticated, (req, res) => {
  try {
    const service = services.getById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Create service
router.post('/api/services', isAuthenticated, express.json(), (req, res) => {
  try {
    const service = services.create(req.body);
    // Schedule monitoring for new service
    scheduleService({ id: service.id, ...req.body });
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update service
router.put('/api/services/:id', isAuthenticated, express.json(), (req, res) => {
  try {
    const existing = services.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = services.update(req.params.id, req.body);
    // Reschedule monitoring
    scheduleService({ id: parseInt(req.params.id), ...req.body });
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete service
router.delete('/api/services/:id', isAuthenticated, (req, res) => {
  try {
    const existing = services.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }
    // Stop monitoring
    unscheduleService(parseInt(req.params.id));
    services.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Manual check for a service
router.post('/api/services/:id/check', isAuthenticated, async (req, res) => {
  try {
    const service = services.getById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const result = await checkService(service);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
