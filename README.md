# GitHub Profile Analyzer API

A production-ready Node.js/Express backend service that fetches GitHub public profiles, analyzes them across several dimensions, and stores rich insights in a MySQL database.

---

## Features

- **Full profile analysis** — name, bio, location, company, social links, account type
- **Repository metrics** — total stars, forks, watchers, open issues across all public repos
- **Language breakdown** — counts repos per language, identifies most-used language
- **Top 5 repositories** — ranked by stars with full repo metadata
- **Historical snapshots** — every analysis run appends a stats snapshot so you can track growth over time
- **Activity score** — weighted composite score (0–100) based on followers, stars, forks, repos, and engagement ratio
- **Pagination & sorting** — list endpoint supports `page`, `limit`, `sort`, and `order`
- **Security** — Helmet headers, CORS, rate limiting (100 req / 15 min)
- **Input validation** — GitHub username format validated on every route

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | MySQL 8+ via `mysql2` |
| External API | GitHub REST API v3 |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |

---

## Project Structure

```
github-analyzer/
├── src/
│   ├── config/
│   │   ├── database.js        # MySQL connection pool
│   │   └── migrate.js         # DB setup / migration runner
│   ├── controllers/
│   │   └── profileController.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validateRequest.js
│   ├── routes/
│   │   └── profileRoutes.js
│   ├── services/
│   │   ├── githubService.js   # GitHub API calls + repo analysis
│   │   └── profileService.js  # DB read/write logic
│   ├── utils/
│   │   └── response.js        # Consistent JSON response helpers
│   ├── app.js                 # Express app setup
│   └── server.js              # Entry point
├── sql/
│   └── schema.sql             # Full database schema export
├── postman_collection.json
├── .env.example
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8+
- (Optional) A GitHub Personal Access Token — unauthenticated requests are limited to 60/hour

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/github-profile-analyzer.git
cd github-profile-analyzer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=github_analyzer

# Optional but strongly recommended (raises GitHub rate limit from 60 → 5000 req/hr)
# Generate at: https://github.com/settings/tokens (no scopes needed for public data)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### 4. Run database migrations

This creates the database and all tables automatically:

```bash
npm run db:migrate
```

Alternatively, import the schema manually:

```bash
mysql -u root -p < sql/schema.sql
```

### 5. Start the server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3000`.

---

## API Reference

### Base URL
```
http://localhost:3000
```

---

### `GET /health`
Health check.

**Response:**
```json
{
  "success": true,
  "message": "GitHub Profile Analyzer API is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

### `POST /api/profiles/analyze/:username`
Fetch a GitHub user's profile, analyze it, and store/update insights in the database. Re-running the same username re-fetches from GitHub and appends a new stats snapshot.

**Example:**
```bash
curl -X POST http://localhost:3000/api/profiles/analyze/torvalds
```

**Response (`201`):**
```json
{
  "success": true,
  "message": "Profile analyzed and stored successfully",
  "data": {
    "id": 1,
    "username": "torvalds",
    "name": "Linus Torvalds",
    "avatar_url": "https://avatars.githubusercontent.com/...",
    "location": "Portland, OR",
    "public_repos": 7,
    "followers": 230000,
    "activity_score": 89.5,
    "most_used_language": "C",
    ...
  }
}
```

---

### `GET /api/profiles`
List all analyzed profiles with pagination and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |
| `sort` | string | `analyzed_at` | Sort field: `analyzed_at`, `username`, `followers`, `total_stars`, `activity_score` |
| `order` | string | `DESC` | `ASC` or `DESC` |

**Example:**
```bash
curl "http://localhost:3000/api/profiles?page=1&limit=10&sort=activity_score&order=DESC"
```

**Response (`200`):**
```json
{
  "success": true,
  "message": "Profiles retrieved successfully",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### `GET /api/profiles/:username`
Get full details of a single analyzed profile.

Returns: profile info, latest stats, language breakdown, top 5 repos, and the last 10 stats snapshots for trend tracking.

**Example:**
```bash
curl http://localhost:3000/api/profiles/torvalds
```

**Response (`200`):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "username": "torvalds",
    "activity_score": 89.5,
    "account_age_days": 5200,
    "latestStats": { "followers": 230000, "total_stars": 12500, ... },
    "languages": [ { "language": "C", "repo_count": 4 }, ... ],
    "topRepos": [ { "repo_name": "linux", "stars": 180000, ... }, ... ],
    "statsHistory": [ ... ]
  }
}
```

---

### `DELETE /api/profiles/:username`
Remove a profile and all related data from the database.

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/profiles/torvalds
```

---

## Database Schema

Five tables store all insights:

| Table | Purpose |
|-------|---------|
| `profiles` | Core GitHub user info |
| `profile_stats` | Snapshot of counts on each analysis run |
| `profile_languages` | Language distribution across repos |
| `top_repositories` | Top 5 repos by stars |
| `profile_activity` | Computed insights: activity score, ratios, account age |

See [`sql/schema.sql`](sql/schema.sql) for the full DDL.

---

## Activity Score

The composite **activity score (0–100)** is calculated as:

| Signal | Weight |
|--------|--------|
| Followers (up to 1,000) | 30% |
| Total stars (up to 500) | 25% |
| Public repos (up to 50) | 20% |
| Total forks (up to 200) | 15% |
| Public gists (up to 20) | 5% |
| Follower/following ratio bonus | 5% |

---

## Deployment

### Railway / Render / Fly.io
1. Set all environment variables from `.env.example` in your platform dashboard
2. Set `NODE_ENV=production`
3. Deploy — the server starts with `npm start`
4. Run migrations once: `npm run db:migrate`

### Environment Variables (Production)
```
PORT=3000
NODE_ENV=production
DB_HOST=<your-mysql-host>
DB_PORT=3306
DB_USER=<user>
DB_PASSWORD=<password>
DB_NAME=github_analyzer
GITHUB_TOKEN=<your-token>
```
