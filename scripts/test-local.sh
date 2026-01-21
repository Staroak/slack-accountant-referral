#!/bin/bash

# Test script for local development
# Run: chmod +x scripts/test-local.sh && ./scripts/test-local.sh

echo "=== Slack Accountant Referral System - Local Test ==="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found!"
  echo "Copy .env.local.example to .env.local and fill in your values."
  exit 1
fi

# Check required env vars
source .env.local 2>/dev/null

if [ -z "$SLACK_BOT_TOKEN" ] || [ "$SLACK_BOT_TOKEN" == "xoxb-your-bot-token" ]; then
  echo "ERROR: SLACK_BOT_TOKEN not configured"
  exit 1
fi

if [ -z "$AZURE_AD_CLIENT_ID" ] || [ "$AZURE_AD_CLIENT_ID" == "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" ]; then
  echo "ERROR: AZURE_AD_CLIENT_ID not configured"
  exit 1
fi

echo "✓ Environment variables look good"
echo ""

# Start dev server
echo "Starting Next.js dev server..."
echo "Once running, use ngrok to expose: ngrok http 3000"
echo ""
echo "Then update your Slack app URLs:"
echo "  Interactivity: https://YOUR-NGROK.ngrok.io/api/slack/interactions"
echo "  Events: https://YOUR-NGROK.ngrok.io/api/slack/events"
echo ""

npm run dev
