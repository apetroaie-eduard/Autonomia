const http = require('http');
const https = require('https');
const net = require('net');
const { URL } = require('url');
const cron = require('node-cron');
const { services, checks, incidents } = require('../models/database');

// Store for scheduled tasks
const scheduledTasks = new Map();

// Perform HTTP/HTTPS check
const performHttpCheck = async (service) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let url;
    
    try {
      url = new URL(service.url);
    } catch (e) {
      resolve({
        status: 'offline',
        response_time: null,
        status_code: null,
        error_message: 'Invalid URL'
      });
      return;
    }

    // Override port if specified
    if (service.port) {
      url.port = service.port;
    }

    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Parse custom headers
    let customHeaders = {};
    if (service.headers) {
      try {
        customHeaders = JSON.parse(service.headers);
      } catch (e) {
        // Invalid headers, ignore
      }
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: service.method || 'GET',
      timeout: (service.timeout || 30) * 1000,
      headers: {
        'User-Agent': 'StatusPage-Monitor/1.0',
        ...customHeaders
      },
      rejectUnauthorized: false // Allow self-signed certificates
    };

    const req = httpModule.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        let status = 'online';
        let errorMessage = null;

        // Check expected status code
        const expectedStatus = service.expected_status || 200;
        if (res.statusCode !== expectedStatus) {
          status = 'offline';
          errorMessage = `Expected status ${expectedStatus}, got ${res.statusCode}`;
        }

        // Check keywords if specified
        if (status === 'online' && service.keywords) {
          const keywords = service.keywords.split(',').map(k => k.trim());
          const foundAll = keywords.every(keyword => body.includes(keyword));
          if (!foundAll) {
            status = 'degraded';
            errorMessage = 'Expected keywords not found in response';
          }
        }

        // Check for slow response (>2 seconds is considered degraded)
        if (status === 'online' && responseTime > 2000) {
          status = 'degraded';
          errorMessage = 'Slow response time';
        }

        resolve({
          status,
          response_time: responseTime,
          status_code: res.statusCode,
          error_message: errorMessage
        });
      });
    });

    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        status: 'offline',
        response_time: responseTime,
        status_code: null,
        error_message: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        status: 'offline',
        response_time: responseTime,
        status_code: null,
        error_message: 'Request timeout'
      });
    });

    req.end();
  });
};

// Perform TCP ping
const performTcpCheck = async (service) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let url;
    
    try {
      url = new URL(service.url);
    } catch (e) {
      // If it's not a valid URL, try to parse as host:port
      const parts = service.url.split(':');
      url = {
        hostname: parts[0],
        port: parts[1] || service.port || 80
      };
    }

    const port = service.port || url.port || 80;
    const host = url.hostname || service.url;

    const socket = new net.Socket();
    socket.setTimeout((service.timeout || 30) * 1000);

    socket.on('connect', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        status: 'online',
        response_time: responseTime,
        status_code: null,
        error_message: null
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        status: 'offline',
        response_time: responseTime,
        status_code: null,
        error_message: 'Connection timeout'
      });
    });

    socket.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        status: 'offline',
        response_time: responseTime,
        status_code: null,
        error_message: err.message
      });
    });

    socket.connect(port, host);
  });
};

// Check a single service
const checkService = async (service) => {
  let result;
  
  if (service.method === 'TCP') {
    result = await performTcpCheck(service);
  } else {
    result = await performHttpCheck(service);
  }

  // Save check result
  checks.create({
    service_id: service.id,
    status: result.status,
    response_time: result.response_time,
    status_code: result.status_code,
    error_message: result.error_message
  });

  // Auto-create incident if service goes offline
  const lastCheck = checks.getLatestByServiceId(service.id);
  if (result.status === 'offline' && (!lastCheck || lastCheck.status !== 'offline')) {
    incidents.create({
      service_id: service.id,
      title: `${service.name} is down`,
      description: result.error_message || 'Service is not responding',
      status: 'investigating'
    });
  }

  return result;
};

// Schedule monitoring for a service
const scheduleService = (service) => {
  // Clear existing task if any
  if (scheduledTasks.has(service.id)) {
    scheduledTasks.get(service.id).stop();
  }

  // Schedule new task (every X minutes)
  const interval = service.check_interval || 5;
  const cronExpression = `*/${interval} * * * *`;
  
  const task = cron.schedule(cronExpression, async () => {
    await checkService(service);
  });

  scheduledTasks.set(service.id, task);
  
  // Perform initial check
  checkService(service);
};

// Remove scheduled task for a service
const unscheduleService = (serviceId) => {
  if (scheduledTasks.has(serviceId)) {
    scheduledTasks.get(serviceId).stop();
    scheduledTasks.delete(serviceId);
  }
};

// Initialize monitoring for all services
const initializeMonitoring = () => {
  const allServices = services.getAll();
  allServices.forEach(service => {
    scheduleService(service);
  });
  
  // Schedule cleanup of old checks (daily at midnight)
  cron.schedule('0 0 * * *', () => {
    checks.cleanupOldChecks(90);
  });
  
  console.log(`Monitoring initialized for ${allServices.length} services`);
};

// Get current status of all services with stats
const getServicesStatus = () => {
  const allServices = services.getAll();
  
  return allServices.map(service => {
    const latestCheck = checks.getLatestByServiceId(service.id);
    const uptime = checks.getUptimePercentage(service.id, 30);
    const avgResponseTime = checks.getAverageResponseTime(service.id, 30);
    const dailyStats = checks.getDailyStats(service.id, 90);
    
    return {
      ...service,
      current_status: latestCheck ? latestCheck.status : 'unknown',
      last_check: latestCheck ? latestCheck.checked_at : null,
      uptime_percentage: uptime,
      avg_response_time: avgResponseTime,
      daily_stats: dailyStats
    };
  });
};

module.exports = {
  checkService,
  scheduleService,
  unscheduleService,
  initializeMonitoring,
  getServicesStatus,
  performHttpCheck,
  performTcpCheck
};
