#!/bin/bash

# Script to create Render Deployment Pull Request

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Creating Render Deployment Pull Request               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd /Users/mjsleelu/Documents/GitHub/e-waste-m/erp_project_amm

# Ensure we're on the right branch
echo "→ Switching to feature/render-deployment branch..."
git checkout feature/render-deployment

echo ""
echo "→ Attempting to push branch to GitHub..."
echo ""

# Try to push
if git push -u origin feature/render-deployment; then
    echo ""
    echo "✅ Branch pushed successfully!"
    echo ""

    # Create the PR
    echo "→ Creating pull request..."
    echo ""

    PR_URL=$(gh pr create \
      --title "Add Render Deployment Workflow and Configuration" \
      --body "## Summary

This PR adds complete Render deployment support alongside the existing Railway deployment.

## 📦 Files Added

1. **\`.github/workflows/deploy-backend-render.yml\`** - GitHub Actions workflow
2. **\`render.yaml\`** - Render service configuration blueprint
3. **\`.github/RENDER_DEPLOYMENT.md\`** - Complete deployment guide (273 lines)
4. **\`.github/RENDER_SETUP_SUMMARY.md\`** - Quick setup reference (96 lines)

## 🎯 Key Features

- ✅ Automatic deployment on push to master when backend files change
- ✅ Manual deployment via GitHub Actions UI
- ✅ Health checks with 10 retry attempts (5 minutes total)
- ✅ Migration status tracking via Render API
- ✅ Rich deployment summaries in GitHub Actions
- ✅ Detailed error handling and troubleshooting

## 📊 Workflow Pattern

Based on the existing Railway deployment workflow:
- Same structure and flow
- Similar health check patterns
- Equivalent migration handling
- Consistent deployment summaries

## 🔑 Required GitHub Secrets

1. **RENDER_DEPLOY_HOOK_URL** - Deploy hook from Render (required)
2. **RENDER_BACKEND_URL** - Service URL without https:// (required)
3. **RENDER_API_KEY** - For migration status checks (optional)
4. **RENDER_SERVICE_ID** - For deployment logs (optional)

## 📚 Documentation

Complete setup instructions included in:
- \`.github/RENDER_DEPLOYMENT.md\` - Full deployment guide
- \`.github/RENDER_SETUP_SUMMARY.md\` - Quick reference

## ✨ Benefits

- Alternative deployment platform option
- Can coexist with Railway deployment
- No changes to existing Railway workflow
- No breaking changes
- Production-ready configuration

## 🚀 Next Steps After Merge

1. Create Web Service on Render
2. Configure environment variables
3. Set GitHub secrets
4. Test deployment

---

**Ready for Review** - All files complete and documented." \
      --head feature/render-deployment \
      --base master 2>&1)

    if echo "$PR_URL" | grep -q "github.com"; then
        echo ""
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║                  ✅ SUCCESS!                               ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo ""
        echo "$PR_URL"
        echo ""

        # Extract PR number
        PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Pull Request Number: #$PR_NUMBER"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        # Save PR info
        echo "$PR_NUMBER" > .pr_number
        echo "PR #$PR_NUMBER: $PR_URL" >> .pr_history

    else
        echo "⚠️ Failed to create PR. Output:"
        echo "$PR_URL"
        exit 1
    fi

else
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              ⚠️  AUTHENTICATION REQUIRED                   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "GitHub requires 'workflow' scope to push workflow files."
    echo ""
    echo "Please authenticate with:"
    echo ""
    echo "  gh auth login --scopes repo,workflow,read:org"
    echo ""
    echo "Then run this script again:"
    echo ""
    echo "  ./create-render-pr.sh"
    echo ""
    exit 1
fi
