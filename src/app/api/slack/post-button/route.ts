import { NextRequest, NextResponse } from 'next/server';
import { postNewReferralButton } from '@/lib/slack';

// POST /api/slack/post-button?channel=C0XXXXXXXXX
// Utility endpoint to post the "New Referral" button to a channel
// Call this once to set up the button in #accountant-referral

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  // Simple auth check - must match SLACK_SIGNING_SECRET
  if (authHeader !== `Bearer ${process.env.SLACK_SIGNING_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || process.env.CHANNEL_ACCOUNTANT_REFERRAL;

  if (!channel) {
    return NextResponse.json({ error: 'No channel specified' }, { status: 400 });
  }

  try {
    const result = await postNewReferralButton(channel);
    return NextResponse.json({ 
      ok: true, 
      message: 'Button posted successfully',
      ts: result.ts,
      channel: result.channel
    });
  } catch (error: any) {
    console.error('Error posting button:', error);
    return NextResponse.json({ 
      error: 'Failed to post button', 
      details: error.message 
    }, { status: 500 });
  }
}
