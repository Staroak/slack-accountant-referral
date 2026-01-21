import { NextResponse } from 'next/server';

// Health check endpoint for monitoring
export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      slack_configured: !!process.env.SLACK_BOT_TOKEN && process.env.SLACK_BOT_TOKEN !== 'xoxb-your-bot-token',
      azure_configured: !!process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_ID !== 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      nextauth_configured: !!process.env.NEXTAUTH_SECRET,
      excel_configured: !!process.env.EXCEL_FILE_ID,
    },
  };

  const allConfigured = Object.values(checks.environment).every(Boolean);
  
  return NextResponse.json({
    ...checks,
    ready: allConfigured,
    message: allConfigured 
      ? 'All systems operational' 
      : 'Missing configuration - check environment variables',
  }, { 
    status: allConfigured ? 200 : 503 
  });
}
