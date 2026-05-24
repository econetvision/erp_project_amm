# Deployment Guide

This guide explains how to deploy the ERP system with:
- **Frontend** → Vercel
- **Backend** → Railway
- **Database** → Railway PostgreSQL

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
3. [Backend Deployment (Railway)](#backend-deployment-railway)
4. [GitHub Actions Setup](#github-actions-setup)
5. [Environment Variables](#environment-variables)
6. [Logging and Monitoring](#logging-and-monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:
- GitHub repository with this code
- Vercel account (https://vercel.com)
- Railway account (https://railway.app)
- Access to configure GitHub Secrets

---

## Frontend Deployment (Vercel)

### Step 1: Create Vercel Project

1. Go to https://vercel.com/dashboard
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

### Step 2: Set Environment Variables in Vercel

In Vercel Project Settings → Environment Variables:

```
REACT_APP_API_URL=https://your-backend.railway.app/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Step 3: Get Vercel Credentials

From Vercel dashboard:
1. Go to **Settings** → **Tokens**
2. Create a new token and save it
3. From your project URL, extract:
   - **Project ID**: Settings → General → Project ID
   - **Org ID**: Account Settings → Your Org ID

---

## Backend Deployment (Railway)

### Step 1: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **"New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create the database and provide a `DATABASE_URL`

### Step 3: Configure Backend Service

1. Click **"New"** → **"GitHub Repo"**
2. Select your repository
3. In service settings:
   - **Root Directory**: Leave empty (we'll use Dockerfile path)
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Start Command**: `cd backend && python migrate.py upgrade && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8088} --workers 2 --log-level info`

### Step 4: Set Environment Variables in Railway

In Railway service → Variables tab:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-linked from PostgreSQL service
SECRET_KEY=your-secure-secret-key-here
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
LOG_LEVEL=INFO

# Twilio (optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_VERIFY_SERVICE_SID=your_twilio_verify_service_sid

# KYC (optional)
KYC_PROVIDER=manual
KYC_API_KEY=
KYC_API_SECRET=
```

### Step 5: Deploy

1. Railway will automatically deploy on push to master
2. Get your backend URL from Railway (e.g., `https://your-backend.railway.app`)
3. Update this URL in Vercel's `REACT_APP_API_URL`

---

## GitHub Actions Setup

### Step 1: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

#### For Vercel Deployment:
```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
REACT_APP_API_URL=https://your-backend.railway.app/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

#### For Railway Deployment:
```
RAILWAY_TOKEN=your_railway_token
RAILWAY_PROJECT_ID=your_railway_project_id
RAILWAY_BACKEND_URL=https://your-backend.railway.app
```

### Step 2: How to Get Railway Token

1. Go to Railway dashboard
2. Click your profile → **Account Settings**
3. Go to **Tokens** tab
4. Click **"Create Token"**
5. Copy the token and add it to GitHub secrets

### Step 3: How to Get Railway Project ID

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login
railway login

# Link project
railway link

# Get project ID (it will be in .railway/config.json)
cat .railway/config.json
```

### Step 4: Workflow Triggers

The workflows will automatically trigger when:
- You push to `master` branch
- Files in `frontend/**` or `backend/**` change
- You manually trigger via GitHub Actions tab

---

## Environment Variables

### Frontend (.env)

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:8088/api

# Google Maps (optional)
REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here
```

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security
SECRET_KEY=your-secret-key-change-in-production

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app

# Logging
LOG_LEVEL=INFO

# Twilio (Optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=

# KYC Provider (Optional)
KYC_PROVIDER=manual
KYC_API_KEY=
KYC_API_SECRET=
```

---

## Logging and Monitoring

### Backend Logging

The backend now uses structured logging that outputs to stdout/stderr:

```python
# Log format
[2026-05-25T12:34:56.789Z] [INFO] [module_name] Log message
```

### Viewing Logs

#### Railway Logs:
1. Go to Railway dashboard
2. Select your backend service
3. Click **"Logs"** tab
4. Use filters to search logs

#### Vercel Logs:
1. Go to Vercel dashboard
2. Select your project
3. Go to **"Deployments"**
4. Click on a deployment → **"View Function Logs"**

### Log Levels

Set via `LOG_LEVEL` environment variable:
- `DEBUG`: Detailed debug information
- `INFO`: General information (default)
- `WARNING`: Warning messages
- `ERROR`: Error messages
- `CRITICAL`: Critical errors

---

## Troubleshooting

### Frontend Issues

**Build fails with "Module not found"**
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

**API requests fail (CORS errors)**
- Check `ALLOWED_ORIGINS` in backend includes your Vercel domain
- Verify `REACT_APP_API_URL` in Vercel environment variables

### Backend Issues

**Database connection fails**
```bash
# Check DATABASE_URL format
postgresql://user:password@host:port/database

# Verify database is accessible
railway run --service backend python -c "from database import engine; print(engine.url)"
```

**Migrations fail**
```bash
# Run migrations manually
railway run --service backend alembic upgrade head

# Check migration status
railway run --service backend alembic current
```

**Import errors or module not found**
```bash
# Verify all dependencies in requirements.txt
# Rebuild the service in Railway
```

### Viewing Logs

**Railway logs not showing**
- Check if service is running: Railway dashboard → Service → Status
- View deployment logs: Railway dashboard → Deployments → Latest
- View runtime logs: Railway dashboard → Service → Logs tab

**High memory usage**
- Reduce uvicorn workers in start command (default: 2)
- Check for memory leaks in scheduled jobs
- Monitor Railway metrics dashboard

---

## Manual Deployment

### Frontend (Manual to Vercel)

```bash
cd frontend
npm install
npm run build

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Backend (Manual to Railway)

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login and link
railway login
railway link

# Deploy
cd backend
railway up
```

---

## Next Steps

After deployment:

1. ✅ Test the health endpoint: `https://your-backend.railway.app/health`
2. ✅ Verify frontend can connect to backend
3. ✅ Create admin user via seed script or API
4. ✅ Set up monitoring and alerts
5. ✅ Configure custom domains (optional)
6. ✅ Set up backup strategy for database

---

## Support

For issues or questions:
- Backend logs: Railway dashboard → Service → Logs
- Frontend logs: Vercel dashboard → Deployments → Function Logs
- GitHub Actions logs: Repository → Actions tab
