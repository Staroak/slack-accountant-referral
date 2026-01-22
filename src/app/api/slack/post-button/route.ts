import { NextRequest, NextResponse } from 'next/server';
import { postNewReferralButton, postCompleteServiceButton } from '@/lib/slack';

// POST /api/slack/post-button?channel=C0XXXXXXXXX&type=referral|completion
// Utility endpoint to post buttons to channels
//
// Examples:
//   POST /api/slack/post-button?type=referral          -> posts to CHANNEL_ACCOUNTANT_REFERRAL
//   POST /api/slack/post-button?type=completion        -> posts to CHANNEL_ACCOUNTANT_SERVICES_COMPLETED
//   POST /api/slack/post-button?channel=C123&type=referral

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  // Simple auth check - must match SLACK_SIGNING_SECRET
  if (authHeader !== `Bearer ${process.env.SLACK_SIGNING_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const buttonType = searchParams.get('type') || 'referral';

  let channel: string | null = searchParams.get('channel');

  // Default channels based on button type
  if (!channel) {
    if (buttonType === 'completion') {
      channel = process.env.CHANNEL_ACCOUNTANT_SERVICES_COMPLETED || null;
    } else {
      channel = process.env.CHANNEL_ACCOUNTANT_REFERRAL || null;
    }
  }

  if (!channel) {
    return NextResponse.json({ error: 'No channel specified or configured' }, { status: 400 });
  }

  try {
    let result;
    if (buttonType === 'completion') {
      result = await postCompleteServiceButton(channel);
    } else {
      result = await postNewReferralButton(channel);
    }

    return NextResponse.json({
      ok: true,
      message: `${buttonType} button posted successfully`,
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
