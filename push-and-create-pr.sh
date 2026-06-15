#!/bin/bash

# Script to push the Render deployment branch and create a PR

set -e

echo "=========================================="
echo "Render Deployment PR Creator"
echo "=========================================="
echo ""

# Check if we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "feature/render-deployment" ]; then
    echo "Switching to feature/render-deployment branch..."
    git checkout feature/render-deployment
fi

echo "Current branch: $(git branch --show-current)"
echo ""

# Show commits to be pushed
echo "Commits in this branch:"
git log --oneline -3
echo ""

# Authenticate with GitHub (with workflow scope)
echo "Authenticating with GitHub..."
echo "Note: Make sure to enable 'workflow' scope when prompted"
gh auth login --scopes repo,workflow --web

echo ""
echo "Pushing branch to GitHub..."
git push -u origin feature/render-deployment

echo ""
echo "Creating pull request..."
gh pr create \
  --title "Add Render Deployment Workflow and Configuration" \
  --body "$(cat <<'EOF'
## Summary

This PR adds complete Render deployment support alongside the existing Railway deployment, providing an alternative deployment platform with comprehensive CI/CD automation.

## 📦 Changes Made

### New Files Created

1. **`.github/workflows/deploy-backend-render.yml`**
   - GitHub Actions workflow for automated Render deployments
   - Based on Railway workflow pattern for consistency
   - Uses Render deploy hooks for reliable CI/CD
   - Includes health checks with 10 retry attempts (5 minutes)
   - Migration status verification via Render API

2. **`render.yaml`**
   - Render Blueprint configuration file
   - Defines Python 3.11 runtime
   - Configures build and start commands
   - Sets up environment variables
   - Enables health checks and auto-deployment

3. **`.github/RENDER_DEPLOYMENT.md`**
   - Comprehensive deployment guide with setup instructions
   - GitHub secrets configuration details
   - Environment variables reference
   - Troubleshooting section and limitations

4. **`.github/RENDER_SETUP_SUMMARY.md`**
   - Quick setup reference guide
   - Secret configuration commands
   - Comparison with Railway workflow

## 🎯 Key Features

- ✅ **Automatic Deployment**: Triggers on push to master when backend files change
- ✅ **Manual Deployment**: Can be triggered from GitHub Actions UI
- ✅ **Health Checks**: 10 retry attempts over 5 minutes
- ✅ **Migration Tracking**: Automatic migrations on startup + API status check
- ✅ **Deployment Summary**: Rich markdown summary in GitHub Actions
- ✅ **Error Handling**: Detailed failure notifications with troubleshooting

## 📊 Workflow Comparison

| Feature | Railway | Render |
|---------|---------|--------|
| Deployment Method | Railway CLI | Deploy Hooks (HTTP) |
| Command | `railway up` | `curl POST` to hook URL |
| Health Check Retries | 5 attempts (2.5 min) | 10 attempts (5 min) |
| Migration Check | `railway run` | Render API + auto-migrations |

## 🔑 Required GitHub Secrets

To use this workflow, add these secrets at `Settings → Secrets and variables → Actions`:

1. **RENDER_DEPLOY_HOOK_URL** (Required)
   - Deploy hook URL from Render service settings

2. **RENDER_BACKEND_URL** (Required)
   - Your Render service URL without `https://`
   - Example: `your-service.onrender.com`

3. **RENDER_API_KEY** (Optional - for migration status)
   - From Render Account Settings → API Keys

4. **RENDER_SERVICE_ID** (Optional - for migration status)
   - Service ID from Render dashboard URL

## 📚 Documentation

Complete guides included:
- **`.github/RENDER_DEPLOYMENT.md`** - Full deployment guide
- **`.github/RENDER_SETUP_SUMMARY.md`** - Quick reference

## 📝 Notes

- ✅ Does NOT modify existing Railway deployment files
- ✅ Both Railway and Render workflows can coexist
- ✅ Migrations run automatically on app startup
- ✅ No breaking changes
- ✅ Follows same patterns as Railway workflow for consistency

## 🚀 Next Steps After Merge

1. Create Web Service on Render
2. Configure environment variables
3. Set GitHub secrets (listed above)
4. Test deployment

---

**Ready for Review** - All files complete and documented.
EOF
)" \
  --head feature/render-deployment \
  --base master

echo ""
echo "=========================================="
echo "✅ Done!"
echo "=========================================="
echo ""
echo "PR has been created successfully!"
echo "View it at: https://github.com/econetvision/erp_project_amm/pulls"
