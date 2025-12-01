// Status Page Frontend Application

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  loadIncidents();
  
  // Refresh every 60 seconds
  setInterval(() => {
    loadStatus();
    loadIncidents();
  }, 60000);
});

async function loadStatus() {
  try {
    // Load overall summary
    const summaryResponse = await fetch('/api/summary');
    const summary = await summaryResponse.json();
    updateStatusBanner(summary);
    
    // Load services status
    const servicesResponse = await fetch('/api/status');
    const services = await servicesResponse.json();
    renderServices(services);
  } catch (error) {
    console.error('Error loading status:', error);
    document.getElementById('services-container').innerHTML = 
      '<div class="loading">Error loading services</div>';
  }
}

function updateStatusBanner(summary) {
  const banner = document.getElementById('status-banner');
  const statusText = document.getElementById('overall-status');
  const description = document.getElementById('status-description');
  
  // Remove previous status classes
  banner.classList.remove('operational', 'partial_outage', 'major_outage');
  
  let icon = '✓';
  let text = 'All Systems Operational';
  let desc = 'All services are running smoothly';
  
  if (summary.overall_status === 'major_outage') {
    banner.classList.add('major_outage');
    icon = '✕';
    text = 'Major Outage';
    desc = `${summary.services_offline} service${summary.services_offline > 1 ? 's' : ''} currently down`;
  } else if (summary.overall_status === 'partial_outage') {
    banner.classList.add('partial_outage');
    icon = '!';
    text = 'Partial Outage';
    desc = `${summary.services_degraded} service${summary.services_degraded > 1 ? 's' : ''} experiencing issues`;
  } else {
    banner.classList.add('operational');
  }
  
  banner.querySelector('.status-icon').textContent = icon;
  statusText.textContent = text;
  description.textContent = desc;
}

function renderServices(services) {
  const container = document.getElementById('services-container');
  
  if (services.length === 0) {
    container.innerHTML = '<div class="no-services">No services configured</div>';
    return;
  }
  
  container.innerHTML = services.map(service => `
    <div class="service-card">
      <div class="service-header">
        <span class="service-name">${escapeHtml(service.name)}</span>
        <span class="status-indicator status-${service.current_status}">
          ${formatStatus(service.current_status)}
        </span>
      </div>
      <div class="service-stats">
        <div class="service-stat">
          <span>Uptime:</span>
          <strong>${service.uptime_percentage}%</strong>
        </div>
        <div class="service-stat">
          <span>Response:</span>
          <strong>${service.avg_response_time}ms</strong>
        </div>
        <div class="service-stat">
          <span>Last check:</span>
          <strong>${formatTime(service.last_check)}</strong>
        </div>
      </div>
      <div class="uptime-container">
        <div class="uptime-timeline" title="Last 90 days uptime">
          ${renderUptimeTimeline(service.daily_stats)}
        </div>
        <div class="uptime-legend">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderUptimeTimeline(dailyStats) {
  // Create 90 days array
  const days = [];
  const today = new Date();
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const stat = dailyStats.find(s => s.date === dateStr);
    
    if (stat) {
      const uptimeRatio = stat.total_checks > 0 
        ? stat.successful_checks / stat.total_checks 
        : 1;
      
      let status = 'online';
      if (uptimeRatio < 0.9) {
        status = 'offline';
      } else if (uptimeRatio < 0.99) {
        status = 'degraded';
      }
      
      days.push({
        date: dateStr,
        status,
        uptime: (uptimeRatio * 100).toFixed(1),
        checks: stat.total_checks
      });
    } else {
      days.push({
        date: dateStr,
        status: 'no-data',
        uptime: 'N/A',
        checks: 0
      });
    }
  }
  
  return days.map(day => 
    `<div class="uptime-day ${day.status}" 
         title="${day.date}: ${day.uptime}% uptime (${day.checks} checks)">
    </div>`
  ).join('');
}

async function loadIncidents() {
  try {
    const response = await fetch('/api/incidents?limit=5');
    const incidents = await response.json();
    renderIncidents(incidents);
  } catch (error) {
    console.error('Error loading incidents:', error);
    document.getElementById('incidents-container').innerHTML = 
      '<div class="loading">Error loading incidents</div>';
  }
}

function renderIncidents(incidents) {
  const container = document.getElementById('incidents-container');
  
  if (incidents.length === 0) {
    container.innerHTML = '<div class="no-incidents">No recent incidents 🎉</div>';
    return;
  }
  
  container.innerHTML = incidents.map(incident => `
    <div class="incident-card ${incident.status === 'resolved' ? 'resolved' : ''}">
      <div class="incident-header">
        <span class="incident-title">${escapeHtml(incident.title)}</span>
        <span class="incident-badge ${incident.status}">${incident.status}</span>
      </div>
      ${incident.description ? `<div class="incident-description">${escapeHtml(incident.description)}</div>` : ''}
      <div class="incident-meta">
        <span>${escapeHtml(incident.service_name)}</span> • 
        <span>${formatDateTime(incident.started_at)}</span>
        ${incident.resolved_at ? ` • Resolved: ${formatDateTime(incident.resolved_at)}` : ''}
      </div>
    </div>
  `).join('');
}

// Helper functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatStatus(status) {
  const statusMap = {
    'online': 'Operational',
    'offline': 'Outage',
    'degraded': 'Degraded',
    'unknown': 'Unknown'
  };
  return statusMap[status] || status;
}

function formatTime(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString();
}
