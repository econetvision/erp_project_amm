# Render Deployment Guide

This guide explains how to deploy the ERP backend to Render using the GitHub Actions workflow.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Connected to Render
3. **PostgreSQL Database**: Set up on Render (optional, can use external DB)

## Setup Instructions

### 1. Create a Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Web Service**
3. Connect your GitHub repository: `econetvision/erp_project_amm`
4. Configure the service:
   - **Name**: `erp-backend` (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: `master`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free (or your preferred tier)

### 2. Configure Environment Variables

In your Render service settings, add these environment variables:

#### Required Variables:
- `DATABASE_URL`: Your PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://erp_user:password@dpg-xxxxx.oregon-postgres.render.com/erp_db`

- `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins
  - Example: `https://your-frontend.vercel.app,http://localhost:3000`

- `JWT_SECRET_KEY`: Secret key for JWT token generation
  - Generate with: `openssl rand -hex 32`

#### Optional Variables:
- `JWT_ALGORITHM`: Algorithm for JWT (default: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time (default: `30`)
- `LOG_LEVEL`: Logging level (default: `INFO`)
- `SEED_TEST_DATA`: Whether to seed test data (default: `true`)

### 3. Get Deploy Hook URL

1. In your Render service settings, go to **Settings** → **Deploy**
2. Copy the **Deploy Hook URL**
   - It looks like: `https://api.render.com/deploy/srv-xxxxxxxxxxxxx?key=xxxxxxxxxx`

### 4. Configure GitHub Secrets

Add these secrets to your GitHub repository at `Settings → Secrets and variables → Actions`:

#### Required Secrets:

1. **RENDER_DEPLOY_HOOK_URL**
   - Value: Your Render Deploy Hook URL
   - Used to trigger deployments from GitHub Actions

2. **RENDER_BACKEND_URL**
   - Value: Your Render service URL (without https://)
   - Example: `erp-backend.onrender.com`
   - Used for health checks

#### Optional Secrets (for migration status check):

3. **RENDER_API_KEY**
   - Value: Your Render API key
   - Get it from: [Render Account Settings → API Keys](https://dashboard.render.com/u/settings#api-keys)

4. **RENDER_SERVICE_ID**
   - Value: Your Render service ID
   - Find it in the service URL: `https://dashboard.render.com/web/srv-xxxxxxxxxxxxx`
   - The ID is the `srv-xxxxxxxxxxxxx` part

## How to Set GitHub Secrets

### Using GitHub CLI (`gh`):

```bash
# Navigate to your repository
cd /path/to/erp_project_amm

# Set RENDER_DEPLOY_HOOK_URL
echo "YOUR_DEPLOY_HOOK_URL" | gh secret set RENDER_DEPLOY_HOOK_URL

# Set RENDER_BACKEND_URL
echo "erp-backend.onrender.com" | gh secret set RENDER_BACKEND_URL

# Set RENDER_API_KEY (optional)
echo "YOUR_API_KEY" | gh secret set RENDER_API_KEY

# Set RENDER_SERVICE_ID (optional)
echo "srv-xxxxxxxxxxxxx" | gh secret set RENDER_SERVICE_ID
```

### Using GitHub Web Interface:

1. Go to your repository: `https://github.com/econetvision/erp_project_amm`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value

## Deployment Workflow

### Automatic Deployment

The workflow automatically triggers when:
- You push changes to the `master` branch that affect:
  - Files in `backend/` directory
  - `render.yaml` file
  - `.github/workflows/deploy-backend-render.yml` file

### Manual Deployment

You can manually trigger a deployment:
1. Go to **Actions** tab in GitHub
2. Select **Deploy Backend to Render** workflow
3. Click **Run workflow**
4. Select the `master` branch
5. Click **Run workflow**

## Workflow Steps

The GitHub Actions workflow performs these steps:

1. ✅ **Checkout code**: Pulls the latest code from repository
2. ✅ **Set up Python**: Installs Python 3.11 with dependency caching
3. ✅ **Install dependencies**: Validates requirements.txt
4. ✅ **Trigger deployment**: Sends POST request to Render Deploy Hook
5. ✅ **Wait for deployment**: Allows time for Render to build
6. ✅ **Health check**: Verifies the service is running (10 retries over 5 minutes)
7. ✅ **Check migration status**: Shows deployment info from Render API
8. ✅ **Deployment summary**: Creates summary in GitHub Actions

## Monitoring Deployments

### Render Dashboard
- View logs: [https://dashboard.render.com/](https://dashboard.render.com/)
- Check service status, build logs, and runtime logs

### GitHub Actions
- View workflow runs: `https://github.com/econetvision/erp_project_amm/actions`
- Check deployment summary and logs

### Health Check
- Test endpoint: `https://YOUR_SERVICE.onrender.com/health`
- Expected response: `{"status":"ok"}`

## Database Migrations

Migrations are run automatically when the application starts. This is handled in `backend/main.py`:

```python
def _run_migrations():
    logger.info("Starting database migrations...")
    # Migration code...

_run_migrations()  # Called on line 46
```

No manual migration steps are needed after deployment.

## Troubleshooting

### Deployment Fails

1. **Check Render Build Logs**
   - Go to Render Dashboard → Your Service → Events
   - Look for build errors or dependency issues

2. **Check GitHub Actions Logs**
   - Go to repository Actions tab
   - Click on the failed workflow run
   - Review each step for errors

3. **Verify Secrets**
   - Ensure all required GitHub secrets are set correctly
   - Deploy Hook URL should start with `https://api.render.com/deploy/`
   - Backend URL should not include `https://` prefix

### Health Check Fails

1. **Service Still Starting**
   - Render free tier can take 5-10 minutes to start
   - Wait and check again later

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is set correctly in Render
   - Check database is running and accessible

3. **Environment Variables Missing**
   - Review required environment variables in Render service settings

### Build Errors

1. **Dependency Issues**
   - Check `backend/requirements.txt` is valid
   - Review Render build logs for specific errors

2. **Python Version**
   - Ensure Python 3.11 is specified in Render settings

## Render Free Tier Limitations

- **Sleep after inactivity**: Services sleep after 15 minutes of inactivity
- **Cold start**: First request after sleep takes 30-60 seconds
- **750 hours/month**: Free tier limit
- **512 MB RAM**: Memory limit

## Upgrade to Paid Tier

For production use, consider upgrading to:
- **Starter ($7/month)**: No sleep, 512 MB RAM
- **Standard ($25/month)**: 2 GB RAM, autoscaling
- **Pro ($85/month)**: 4 GB RAM, advanced features

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render API Reference](https://api-docs.render.com/)
- [Deploy Hooks Guide](https://render.com/docs/deploy-hooks)
- [Environment Variables](https://render.com/docs/environment-variables)

## Support

For issues with:
- **Render Platform**: [Render Community](https://community.render.com/)
- **GitHub Actions**: [GitHub Discussions](https://github.com/econetvision/erp_project_amm/discussions)
- **Application Bugs**: [GitHub Issues](https://github.com/econetvision/erp_project_amm/issues)
