# Status Page

A complete status page for monitoring websites and services. Track uptime, response times, and incidents with a beautiful public dashboard.

![Status Page](https://img.shields.io/badge/Status-Active-success)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- 📊 **Public Status Dashboard** - Beautiful, responsive status page showing all your services
- 🔒 **Admin Panel** - Secure admin interface to manage services
- 📈 **90-Day Uptime History** - Visual timeline showing uptime for the last 90 days
- ⚡ **Real-time Monitoring** - Automatic health checks at configurable intervals
- 🔔 **Incident Tracking** - Automatic incident creation when services go down
- 🌐 **Multi-Protocol Support** - HTTP, HTTPS, and TCP ping monitoring

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd status-page
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_session_secret_key
PORT=3000
NODE_ENV=development
DATABASE_URL=./data/statuspage.db
```

5. Start the server:
```bash
npm start
```

6. Open your browser:
   - Public Status Page: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

## Configuration Options

### Service Configuration

When adding a service to monitor, you can configure:

| Option | Description | Default |
|--------|-------------|---------|
| Name | Display name for the service | Required |
| URL | The URL or endpoint to monitor | Required |
| Port | Custom port (optional) | Auto-detect |
| Method | HTTP method: GET, POST, HEAD, or TCP | GET |
| Check Interval | How often to check (minutes) | 5 |
| Timeout | Request timeout (seconds) | 30 |
| Expected Status | Expected HTTP status code | 200 |
| Keywords | Keywords to search in response | None |
| Headers | Custom HTTP headers (JSON) | None |
| Notifications | Enable/disable notifications | Enabled |
| Description | Service description | None |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_USERNAME` | Admin panel username | admin |
| `ADMIN_PASSWORD` | Admin panel password | admin |
| `SESSION_SECRET` | Session encryption key | Random |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `DATABASE_URL` | SQLite database path | ./data/statuspage.db |

## API Endpoints

### Public API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get all services with current status |
| `/api/summary` | GET | Get overall system status summary |
| `/api/incidents` | GET | Get recent incidents |
| `/api/services/:id/history` | GET | Get uptime history for a service |

### Admin API (requires authentication)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/api/services` | GET | List all services |
| `/admin/api/services` | POST | Create a new service |
| `/admin/api/services/:id` | GET | Get a service by ID |
| `/admin/api/services/:id` | PUT | Update a service |
| `/admin/api/services/:id` | DELETE | Delete a service |
| `/admin/api/services/:id/check` | POST | Trigger manual check |

## Project Structure

```
/
├── .env.example          # Environment variables template
├── package.json          # Dependencies and scripts
├── README.md             # Documentation
├── server.js             # Entry point
├── /src
│   ├── /routes
│   │   ├── admin.js      # Admin panel routes
│   │   ├── api.js        # Public API routes
│   │   └── public.js     # Public page routes
│   ├── /models
│   │   └── database.js   # SQLite database models
│   ├── /services
│   │   └── monitor.js    # Monitoring service
│   └── /middleware
│       └── auth.js       # Authentication middleware
├── /public
│   ├── /css
│   │   └── style.css     # Styles
│   ├── /js
│   │   └── app.js        # Frontend JavaScript
│   └── index.html        # Public status page
└── /views
    ├── admin.html        # Admin panel
    └── login.html        # Login page
```

## Status Indicators

- 🟢 **Online** - Service is responding correctly
- 🟡 **Degraded** - Service is slow or returning unexpected content
- 🔴 **Offline** - Service is not responding or returning errors

## Development

### Running in Development Mode

```bash
npm run dev
```

### Database

The application uses SQLite for data storage. The database file is created automatically in the `data/` directory.

To reset the database, simply delete the `data/statuspage.db` file and restart the server.

## Security Considerations

1. **Change default credentials** - Always update `ADMIN_USERNAME` and `ADMIN_PASSWORD`
2. **Use a strong session secret** - Generate a random string for `SESSION_SECRET`
3. **Enable HTTPS in production** - Use a reverse proxy like nginx with SSL
4. **Keep dependencies updated** - Regularly run `npm audit` and update packages

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Uptime Robot](https://uptimerobot.com) and [Better Uptime](https://betteruptime.com)
- Built with [Express.js](https://expressjs.com)
- Database powered by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
