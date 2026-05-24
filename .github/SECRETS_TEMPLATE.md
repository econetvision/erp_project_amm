# GitHub Secrets Configuration

This file contains a template for all required GitHub secrets for deployment workflows.

## How to Add Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add each secret below

---

## Required Secrets for Vercel Deployment

### VERCEL_TOKEN
- **Description**: Vercel API token for deployment
- **How to get**:
  1. Go to https://vercel.com/account/tokens
  2. Click "Create Token"
  3. Copy the token
- **Value**: `your_vercel_token_here`

### VERCEL_ORG_ID
- **Description**: Your Vercel organization/team ID
- **How to get**:
  1. Go to https://vercel.com/dashboard
  2. Click on your team name → Settings
  3. Copy the Team ID
- **Value**: `your_vercel_org_id_here`

### VERCEL_PROJECT_ID
- **Description**: Your Vercel project ID
- **How to get**:
  1. Go to your project in Vercel
  2. Settings → General
  3. Copy the Project ID
- **Value**: `your_vercel_project_id_here`

### REACT_APP_API_URL
- **Description**: Backend API URL for the frontend
- **Value**: `https://your-backend.railway.app/api`

### REACT_APP_GOOGLE_MAPS_API_KEY
- **Description**: Google Maps API key for location features
- **How to get**:
  1. Go to https://console.cloud.google.com/
  2. Create a project
  3. Enable Maps JavaScript API
  4. Create credentials → API Key
- **Value**: `your_google_maps_api_key_here`

---

## Required Secrets for Railway Deployment

### RAILWAY_TOKEN
- **Description**: Railway API token for deployment
- **How to get**:
  1. Go to https://railway.app/dashboard
  2. Click your profile → Account Settings
  3. Go to "Tokens" tab
  4. Click "Create Token"
  5. Copy the token
- **Value**: `your_railway_token_here`

### RAILWAY_PROJECT_ID
- **Description**: Your Railway project ID
- **How to get**:
  ```bash
  # Install Railway CLI
  curl -fsSL https://railway.app/install.sh | sh

  # Login
  railway login

  # Link to your project
  railway link

  # View project ID
  cat .railway/config.json
  ```
- **Value**: `your_railway_project_id_here`

### RAILWAY_BACKEND_URL
- **Description**: Your Railway backend URL (for health checks)
- **How to get**:
  1. Go to Railway dashboard
  2. Select your backend service
  3. Go to "Settings" tab
  4. Copy the public URL
- **Value**: `https://your-backend.railway.app`

---

## Quick Setup Script

Copy and paste this checklist as you set up:

```
[ ] VERCEL_TOKEN
[ ] VERCEL_ORG_ID
[ ] VERCEL_PROJECT_ID
[ ] REACT_APP_API_URL
[ ] REACT_APP_GOOGLE_MAPS_API_KEY
[ ] RAILWAY_TOKEN
[ ] RAILWAY_PROJECT_ID
[ ] RAILWAY_BACKEND_URL
```

---

## Security Notes

⚠️ **IMPORTANT**:
- Never commit secrets to your repository
- Never share secrets in chat or public forums
- Rotate secrets regularly
- Use different tokens for development and production
- Revoke tokens immediately if compromised

---

## Verifying Setup

After adding all secrets, you can verify by:

1. Go to **Actions** tab in your repository
2. Click on a workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. Check the logs to ensure secrets are properly configured

If you see `***` in the logs where secrets should be, that means they're properly masked and working.
