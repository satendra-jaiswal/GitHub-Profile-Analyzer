# Deployment Guide

## Option A — Railway (Recommended, ~5 minutes)

Railway gives you a free MySQL database + Node.js server in one place.

### Steps

1. **Push code to GitHub first**
   ```bash
   git init
   git add .
   git commit -m "feat: initial GitHub Profile Analyzer API"
   git remote add origin https://github.com/YOUR_USERNAME/github-profile-analyzer.git
   git push -u origin main
   ```

2. **Create Railway account** → https://railway.app (sign in with GitHub)

3. **New Project → Deploy from GitHub repo** → select your repo

4. **Add a MySQL database**
   - In your Railway project: **New** → **Database** → **MySQL**
   - Railway auto-injects `MYSQL_URL` — but we use individual vars, so go to the MySQL service → **Variables** and note the values

5. **Set environment variables** on your Node.js service:
   ```
   PORT=3000
   NODE_ENV=production
   DB_HOST=<from Railway MySQL MYSQLHOST>
   DB_PORT=<from Railway MySQL MYSQLPORT>
   DB_USER=<from Railway MySQL MYSQLUSER>
   DB_PASSWORD=<from Railway MySQL MYSQLPASSWORD>
   DB_NAME=<from Railway MySQL MYSQLDATABASE>
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

6. **Run migrations once** — in Railway console for your Node service:
   ```bash
   npm run db:migrate
   ```
   Or add it as a start command: `npm run db:migrate && npm start`

7. **Get your live URL** from Railway dashboard → your Node service → **Settings → Domains**

---

## Option B — Render (Also free)

1. Push code to GitHub (same as above)
2. https://render.com → **New Web Service** → connect repo
3. Build command: `npm install`
4. Start command: `npm run db:migrate && npm start`
5. Add a **Render PostgreSQL** ... actually use **PlanetScale** or **Aiven** for free MySQL:
   - https://aiven.io (free MySQL tier) — copy host/user/password/dbname into Render env vars
6. Set the same environment variables as above

---

## Option C — Fly.io

```bash
npm install -g flyctl
fly auth login
fly launch          # auto-detects Node.js
fly secrets set DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... GITHUB_TOKEN=...
fly deploy
```

---

## Verifying Your Live Deployment

Once deployed, test these URLs in your browser or Postman:

```
GET  https://your-app.railway.app/health
GET  https://your-app.railway.app/
POST https://your-app.railway.app/api/profiles/analyze/torvalds
GET  https://your-app.railway.app/api/profiles
GET  https://your-app.railway.app/api/profiles/torvalds
```

---

## Update Postman Collection Base URL

After deploying, update the `baseUrl` variable in `postman_collection.json`:

```json
{ "key": "baseUrl", "value": "https://your-app.railway.app" }
```

Or in Postman UI: **Collections → GitHub Profile Analyzer → Variables → baseUrl**
