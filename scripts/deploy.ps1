# Deploy to Vercel - PowerShell script for Windows
# Run: .\scripts\deploy.ps1

Write-Host "=== Deploying Slack Accountant Referral System to Vercel ===" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

# Check if logged in to Vercel
Write-Host "Checking Vercel login status..." -ForegroundColor Yellow
$whoami = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please log in to Vercel:" -ForegroundColor Yellow
    vercel login
}

Write-Host ""
Write-Host "Deploying to production..." -ForegroundColor Green
vercel --prod

Write-Host ""
Write-Host "=== NEXT STEPS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy your Vercel deployment URL (e.g., https://slack-app-xxx.vercel.app)"
Write-Host ""
Write-Host "2. Go to https://api.slack.com/apps and update these URLs:"
Write-Host "   - Interactivity & Shortcuts > Request URL:"
Write-Host "     https://YOUR-APP.vercel.app/api/slack/interactions"
Write-Host ""
Write-Host "   - Event Subscriptions > Request URL:"
Write-Host "     https://YOUR-APP.vercel.app/api/slack/events"
Write-Host ""
Write-Host "3. Add environment variables in Vercel Dashboard > Settings > Environment Variables"
Write-Host ""
Write-Host "4. Test by posting the referral button:"
Write-Host '   curl -X POST "https://YOUR-APP.vercel.app/api/slack/post-button?channel=YOUR_CHANNEL_ID" \'
Write-Host '        -H "Authorization: Bearer YOUR_SIGNING_SECRET"'
Write-Host ""
