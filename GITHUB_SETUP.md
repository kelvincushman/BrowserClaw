# GitHub Repository Setup Guide

This guide will help you complete the rebranding by updating your GitHub repository name and settings.

## Step 1: Rename the Repository on GitHub

Since the repository has been rebranded from "AIPex" to "AigentisBrowser", you should rename it on GitHub:

1. Go to your repository: https://github.com/kelvincushman/AIPex
2. Click on **Settings** (top right)
3. Scroll down to the **"Repository name"** section
4. Change the name from `AIPex` to `AigentisBrowser`
5. Click **"Rename"**

⚠️ **Important**: After renaming, your repository URL will change from:
- `https://github.com/kelvincushman/AIPex`
- To: `https://github.com/kelvincushman/AigentisBrowser`

## Step 2: Update Local Git Remote URL

After renaming on GitHub, update your local repository's remote URL:

```bash
cd /home/user/AIPex

# Update the remote URL
git remote set-url origin https://github.com/kelvincushman/AigentisBrowser.git

# Verify the change
git remote -v
```

## Step 3: Update Repository Description on GitHub

1. Go to your repository on GitHub
2. Click the **⚙️ gear icon** next to "About" (top right of the repository)
3. Update the description to:
   ```
   Automated social media management with AI-powered browser automation
   ```
4. Update the website URL if you have one
5. Add topics/tags:
   - `browser-automation`
   - `social-media`
   - `ai-automation`
   - `chrome-extension`
   - `typescript`
   - `react`

## Step 4: Update Repository README Badge Links (Optional)

If you want to add badges to your README, you can update them to point to the new repository name:

```markdown
[![GitHub stars](https://img.shields.io/github/stars/kelvincushman/AigentisBrowser?style=social)](https://github.com/kelvincushman/AigentisBrowser)
[![GitHub forks](https://img.shields.io/github/forks/kelvincushman/AigentisBrowser?style=social)](https://github.com/kelvincushman/AigentisBrowser)
[![GitHub issues](https://img.shields.io/github/issues/kelvincushman/AigentisBrowser)](https://github.com/kelvincushman/AigentisBrowser/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

## Step 5: Rename Local Directory (Optional)

If you want to rename your local project directory to match:

```bash
cd /home/user
mv AIPex AigentisBrowser
cd AigentisBrowser
```

## Step 6: Update GitHub Secrets (for CI/CD)

If you're using GitHub Actions for publishing:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Update any secrets that reference the old package name
3. The workflow has been updated to use `@aigentis` scope

## Notes

- All code changes have already been committed to the branch: `claude/rebrand-aigentis-browser-01LXuXzpxDJyHTqujgGmn1bj`
- GitHub will automatically redirect old URLs to the new repository name
- You may want to update any external links or documentation that references the old name
- If you have any webhooks or integrations, update those to use the new repository name

## What's Already Done ✅

- ✅ All source code rebranded to AigentisBrowser
- ✅ Chinese content removed
- ✅ Security audit completed (no backdoors found)
- ✅ GitHub Actions workflow updated
- ✅ Package.json updated with new name and scope
- ✅ Manifest.json updated
- ✅ README.md rewritten
- ✅ All changes committed and pushed

## Next Steps

1. Rename the repository on GitHub (Step 1 above)
2. Update your local git remote (Step 2 above)
3. Install dependencies and test: `npm install && npm run build`
4. Load the extension in Chrome to verify everything works
