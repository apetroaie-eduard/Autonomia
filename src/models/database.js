const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.dirname(process.env.DATABASE_URL || './data/statuspage.db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_URL || './data/statuspage.db';
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    port INTEGER,
    method TEXT DEFAULT 'GET',
    check_interval INTEGER DEFAULT 5,
    timeout INTEGER DEFAULT 30,
    headers TEXT,
    expected_status INTEGER DEFAULT 200,
    keywords TEXT,
    notifications_enabled INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    response_time INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'investigating',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_checks_service_id ON checks(service_id);
  CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
  CREATE INDEX IF NOT EXISTS idx_incidents_service_id ON incidents(service_id);
`);

// Service CRUD operations
const serviceOperations = {
  getAll: () => {
    return db.prepare('SELECT * FROM services ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  },

  create: (service) => {
    const stmt = db.prepare(`
      INSERT INTO services (name, url, port, method, check_interval, timeout, headers, expected_status, keywords, notifications_enabled, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      service.name,
      service.url,
      service.port || null,
      service.method || 'GET',
      service.check_interval || 5,
      service.timeout || 30,
      service.headers || null,
      service.expected_status || 200,
      service.keywords || null,
      service.notifications_enabled !== undefined ? (service.notifications_enabled ? 1 : 0) : 1,
      service.description || null
    );
    return { id: result.lastInsertRowid, ...service };
  },

  update: (id, service) => {
    const stmt = db.prepare(`
      UPDATE services SET
        name = ?,
        url = ?,
        port = ?,
        method = ?,
        check_interval = ?,
        timeout = ?,
        headers = ?,
        expected_status = ?,
        keywords = ?,
        notifications_enabled = ?,
        description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      service.name,
      service.url,
      service.port || null,
      service.method || 'GET',
      service.check_interval || 5,
      service.timeout || 30,
      service.headers || null,
      service.expected_status || 200,
      service.keywords || null,
      service.notifications_enabled ? 1 : 0,
      service.description || null,
      id
    );
    return { id, ...service };
  },

  delete: (id) => {
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    return true;
  }
};

// Check operations
const checkOperations = {
  create: (check) => {
    const stmt = db.prepare(`
      INSERT INTO checks (service_id, status, response_time, status_code, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      check.service_id,
      check.status,
      check.response_time || null,
      check.status_code || null,
      check.error_message || null
    );
    return { id: result.lastInsertRowid, ...check };
  },

  getLatestByServiceId: (serviceId) => {
    return db.prepare(`
      SELECT * FROM checks 
      WHERE service_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1
    `).get(serviceId);
  },

  getByServiceIdLast90Days: (serviceId) => {
    return db.prepare(`
      SELECT * FROM checks 
      WHERE service_id = ? 
      AND checked_at >= datetime('now', '-90 days')
      ORDER BY checked_at ASC
    `).all(serviceId);
  },

  getDailyStats: (serviceId, days = 90) => {
    return db.prepare(`
      SELECT 
        date(checked_at) as date,
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as successful_checks,
        AVG(response_time) as avg_response_time,
        MIN(CASE WHEN status != 'online' THEN 1 ELSE 0 END) as had_issues
      FROM checks 
      WHERE service_id = ? 
      AND checked_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(checked_at)
      ORDER BY date ASC
    `).all(serviceId, days);
  },

  getUptimePercentage: (serviceId, days = 30) => {
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online
      FROM checks 
      WHERE service_id = ? 
      AND checked_at >= datetime('now', '-' || ? || ' days')
    `).get(serviceId, days);
    
    if (!result || result.total === 0) return 100;
    return ((result.online / result.total) * 100).toFixed(2);
  },

  getAverageResponseTime: (serviceId, days = 30) => {
    const result = db.prepare(`
      SELECT AVG(response_time) as avg_time
      FROM checks 
      WHERE service_id = ? 
      AND checked_at >= datetime('now', '-' || ? || ' days')
      AND response_time IS NOT NULL
    `).get(serviceId, days);
    
    return result ? Math.round(result.avg_time || 0) : 0;
  },

  cleanupOldChecks: (days = 90) => {
    db.prepare(`
      DELETE FROM checks 
      WHERE checked_at < datetime('now', '-' || ? || ' days')
    `).run(days);
  }
};

// Incident operations
const incidentOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT i.*, s.name as service_name 
      FROM incidents i 
      JOIN services s ON i.service_id = s.id 
      ORDER BY i.started_at DESC
    `).all();
  },

  getRecent: (limit = 10) => {
    return db.prepare(`
      SELECT i.*, s.name as service_name 
      FROM incidents i 
      JOIN services s ON i.service_id = s.id 
      ORDER BY i.started_at DESC 
      LIMIT ?
    `).all(limit);
  },

  create: (incident) => {
    const stmt = db.prepare(`
      INSERT INTO incidents (service_id, title, description, status)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      incident.service_id,
      incident.title,
      incident.description || null,
      incident.status || 'investigating'
    );
    return { id: result.lastInsertRowid, ...incident };
  },

  resolve: (id) => {
    db.prepare(`
      UPDATE incidents SET 
        status = 'resolved', 
        resolved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
  }
};

module.exports = {
  db,
  services: serviceOperations,
  checks: checkOperations,
  incidents: incidentOperations
};
