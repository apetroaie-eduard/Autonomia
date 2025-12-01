const express = require('express');
const router = express.Router();
const { getServicesStatus } = require('../services/monitor');
const { incidents, checks } = require('../models/database');

// Get all services with status
router.get('/status', (req, res) => {
  try {
    const servicesStatus = getServicesStatus();
    res.json(servicesStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get overall status summary
router.get('/summary', (req, res) => {
  try {
    const servicesStatus = getServicesStatus();
    
    const total = servicesStatus.length;
    const online = servicesStatus.filter(s => s.current_status === 'online').length;
    const offline = servicesStatus.filter(s => s.current_status === 'offline').length;
    const degraded = servicesStatus.filter(s => s.current_status === 'degraded').length;
    
    let overallStatus = 'operational';
    if (offline > 0) {
      overallStatus = 'major_outage';
    } else if (degraded > 0) {
      overallStatus = 'partial_outage';
    }
    
    res.json({
      overall_status: overallStatus,
      total_services: total,
      services_online: online,
      services_offline: offline,
      services_degraded: degraded
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent incidents
router.get('/incidents', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recentIncidents = incidents.getRecent(limit);
    res.json(recentIncidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uptime history for a service
router.get('/services/:id/history', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const dailyStats = checks.getDailyStats(req.params.id, days);
    res.json(dailyStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
