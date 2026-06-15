# Render Deployment - Quick Setup Summary

## Files Created

✅ **Workflow File**: `.github/workflows/deploy-backend-render.yml`
- GitHub Actions workflow for automated Render deployments
- Based on the Railway workflow pattern
- Includes health checks, migration status, and deployment summary

✅ **Configuration File**: `render.yaml`
- Render blueprint configuration
- Defines Python runtime, build/start commands
- Configures environment variables and health checks

✅ **Documentation**: `.github/RENDER_DEPLOYMENT.md`
- Complete deployment guide
- Step-by-step setup instructions
- Troubleshooting tips

## Required GitHub Secrets

Set these secrets in your repository at:
`Settings → Secrets and variables → Actions`

### 1. RENDER_DEPLOY_HOOK_URL (Required)
Get from: Render Dashboard → Your Service → Settings → Deploy Hook
```bash
echo "YOUR_DEPLOY_HOOK_URL" | gh secret set RENDER_DEPLOY_HOOK_URL
```

### 2. RENDER_BACKEND_URL (Required)
Your Render service URL without https://
```bash
echo "your-service.onrender.com" | gh secret set RENDER_BACKEND_URL
```

### 3. RENDER_API_KEY (Optional)
Get from: Render Account Settings → API Keys
```bash
echo "YOUR_API_KEY" | gh secret set RENDER_API_KEY
```

### 4. RENDER_SERVICE_ID (Optional)
Find in service URL: srv-xxxxxxxxxxxxx
```bash
echo "srv-xxxxxxxxxxxxx" | gh secret set RENDER_SERVICE_ID
```

## Quick Start

1. **Push the code**:
   ```bash
   git push origin master
   ```

2. **Create Render Web Service**:
   - Go to https://dashboard.render.com/
   - New → Web Service
   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Set Environment Variables in Render**:
   - `DATABASE_URL`: PostgreSQL connection string
   - `ALLOWED_ORIGINS`: Frontend URLs
   - `JWT_SECRET_KEY`: Generate with `openssl rand -hex 32`

4. **Configure GitHub Secrets** (see above)

5. **Trigger Deployment**:
   - Push to master branch, OR
   - Go to Actions → Deploy Backend to Render → Run workflow

## Key Differences from Railway

| Feature | Railway | Render |
|---------|---------|--------|
| CLI Tool | Railway CLI | Deploy Hooks (HTTP) |
| Deployment | `railway up` | POST to deploy hook URL |
| Config File | `Procfile` + `nixpacks.toml` | `render.yaml` |
| Migration Check | `railway run` command | Render API (optional) |
| Health Check Retries | 5 attempts | 10 attempts |

## Next Steps

1. Read full documentation: `.github/RENDER_DEPLOYMENT.md`
2. Set up Render service
3. Configure GitHub secrets
4. Test deployment by pushing to master

## Support

- Full Guide: `.github/RENDER_DEPLOYMENT.md`
- Render Docs: https://render.com/docs
- Issues: https://github.com/econetvision/erp_project_amm/issues
