# Slack Accountant Referral System - Setup Guide

## Quick Start

### 1. Prerequisites
- Node.js 18+
- Slack workspace admin access
- Microsoft 365 admin access (for Azure AD)

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# From Slack App (api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_ID=A0...

# From Azure Portal (portal.azure.com > App registrations)
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=...

# Your Microsoft 365 setup
EXCEL_FILE_ID=...           # See "Finding Excel File ID" below
JARROD_CALENDAR_EMAIL=...   # Email of calendar owner

# Slack channel IDs (right-click channel > Copy link > extract ID)
CHANNEL_ACCOUNTANT_REFERRAL=C0...
CHANNEL_ACCOUNTING_SERVICES_COMPLETED=C0...
CHANNEL_ACCOUNTING_ADMIN=C0...
```

### 3. Finding Excel File ID

1. Open your Excel file in OneDrive/SharePoint
2. Click "Share" > "Copy link"
3. The URL contains the file ID after `/d/` or use Graph Explorer:
   ```
   GET https://graph.microsoft.com/v1.0/me/drive/root/search(q='YourFileName.xlsx')
   ```

### 4. Excel Spreadsheet Setup

Create a table named `ReferralsTable` with these columns:
| ID | Client Name | Client Email | Client Phone | Service Type | Notes | Broker Name | Referral Date | Appointment Date | Status | Completed Date | Invoice Status |

### 5. Local Development

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

```bash
npx vercel --prod
```

Then update Slack app URLs:
- Interactivity URL: `https://your-app.vercel.app/api/slack/interactions`
- Event Subscriptions URL: `https://your-app.vercel.app/api/slack/events`

### 7. Test the Flow

1. Go to #accountant-referral channel
2. Post the referral button (or use slash command)
3. Click "New Referral" → Fill form → Submit
4. Check Jarrod's calendar for the appointment
5. Check Excel for the new row

## Architecture

```
Slack                          Next.js API              Microsoft 365
─────                          ───────────              ─────────────
[New Referral] btn ──────────► /api/slack/interactions
                                    │
                                    ├──────────────────► Calendar event
                                    └──────────────────► Excel row

✅ reaction ─────────────────► /api/slack/events
                                    │
                                    └──────────────────► Excel update
```

## Troubleshooting

### "Invalid signature" error
- Check `SLACK_SIGNING_SECRET` matches your Slack app
- Ensure request body isn't being modified by middleware

### Calendar event not created
- Verify `JARROD_CALENDAR_EMAIL` is correct
- Check Azure AD app has `Calendars.ReadWrite` permission
- Ensure admin consent was granted

### Excel update fails
- Verify `EXCEL_FILE_ID` is correct
- Check Azure AD app has `Files.ReadWrite.All` permission
- Ensure the table `ReferralsTable` exists in the worksheet
