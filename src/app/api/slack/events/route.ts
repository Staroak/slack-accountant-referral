import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, slackClient } from '@/lib/slack';
import { markInvoicePaid } from '@/lib/graph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const timestamp = request.headers.get('x-slack-request-timestamp') || '';
    const signature = request.headers.get('x-slack-signature') || '';

    // Verify the request is from Slack
    const isValid = verifySlackRequest(
      process.env.SLACK_SIGNING_SECRET!,
      body,
      timestamp,
      signature
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);

    // Handle URL verification challenge (required for initial setup)
    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Handle events
    if (payload.type === 'event_callback') {
      const event = payload.event;

      switch (event.type) {
        case 'reaction_added':
          await handleReactionAdded(event);
          break;
        default:
          console.log('Unhandled event type:', event.type);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error handling Slack event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleReactionAdded(event: any) {
  // Only process checkmark reactions in #accounting-admin
  if (event.reaction !== 'white_check_mark') {
    return;
  }

  // Check if this is in the accounting-admin channel
  const adminChannel = process.env.CHANNEL_ACCOUNTING_ADMIN;
  if (event.item.channel !== adminChannel) {
    return;
  }

  // Get the message that was reacted to
  const result = await slackClient.conversations.history({
    channel: event.item.channel,
    latest: event.item.ts,
    inclusive: true,
    limit: 1,
  });

  const message = result.messages?.[0];
  if (!message) {
    console.error('Could not find reacted message');
    return;
  }

  // Extract referral ID from message metadata
  const metadata = message.metadata as any;
  if (metadata?.event_type !== 'service_completion') {
    return;
  }

  const referralId = metadata.event_payload?.referral_id;
  if (!referralId) {
    console.error('No referral ID in message metadata');
    return;
  }

  // Mark invoice as paid in Excel
  await markInvoicePaid(referralId);

  // Post confirmation reply
  await slackClient.chat.postMessage({
    channel: event.item.channel,
    thread_ts: event.item.ts,
    text: `Invoice marked as paid for referral ${referralId}`,
  });
}
