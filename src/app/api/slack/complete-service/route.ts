import { NextRequest, NextResponse } from 'next/server';
import { slackClient, getSlackUserInfo, postCompletionNotification } from '@/lib/slack';
import { updateReferralStatus } from '@/lib/graph';

// This endpoint handles the service completion flow for #accounting-services-completed
// Jr Accountant clicks "Complete Service" button -> Opens modal -> Submits -> Updates Excel + notifies admin

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const payload = JSON.parse(params.get('payload') || '{}');

    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      
      if (action.action_id === 'open_completion_modal') {
        // Extract referral ID from button value
        const referralId = action.value;
        
        await slackClient.views.open({
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'completion_form_submit',
            private_metadata: JSON.stringify({ referralId }),
            title: {
              type: 'plain_text',
              text: 'Complete Service',
            },
            submit: {
              type: 'plain_text',
              text: 'Mark Complete',
            },
            close: {
              type: 'plain_text',
              text: 'Cancel',
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Referral ID:* ${referralId}`,
                },
              },
              {
                type: 'input',
                block_id: 'completion_notes_block',
                element: {
                  type: 'plain_text_input',
                  action_id: 'completion_notes',
                  multiline: true,
                  placeholder: {
                    type: 'plain_text',
                    text: 'Describe the services completed...',
                  },
                },
                label: {
                  type: 'plain_text',
                  text: 'Completion Notes',
                },
              },
              {
                type: 'input',
                block_id: 'service_date_block',
                element: {
                  type: 'datepicker',
                  action_id: 'service_date',
                  initial_date: new Date().toISOString().slice(0, 10),
                },
                label: {
                  type: 'plain_text',
                  text: 'Service Completion Date',
                },
              },
            ],
          },
        });
        
        return NextResponse.json({});
      }
    }

    if (payload.type === 'view_submission' && payload.view.callback_id === 'completion_form_submit') {
      const values = payload.view.state.values;
      const metadata = JSON.parse(payload.view.private_metadata || '{}');
      const referralId = metadata.referralId;
      const userId = payload.user.id;

      // Get jr accountant info
      const userInfo = await getSlackUserInfo(userId);
      const jrAccountantName = userInfo?.real_name || userInfo?.name || 'Unknown';

      const completionNotes = values.completion_notes_block.completion_notes.value;
      const serviceDate = values.service_date_block.service_date.selected_date;

      // Update Excel - mark as completed
      await updateReferralStatus(referralId, 'completed', {
        completedDate: serviceDate,
        invoiceStatus: 'sent',
      });

      // Post to #accounting-admin
      await postCompletionNotification(
        process.env.CHANNEL_ACCOUNTING_ADMIN!,
        referralId,
        'Client', // In real impl, fetch from Excel
        completionNotes,
        jrAccountantName
      );

      return NextResponse.json({});
    }

    return NextResponse.json({});
  } catch (error) {
    console.error('Error in complete-service:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Utility: Post a "Complete Service" button for a specific referral
export async function postServiceCompletionButton(channel: string, referralId: string, clientName: string) {
  return slackClient.chat.postMessage({
    channel,
    text: `Service ready for completion: ${clientName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Ready to mark service complete?*\n*Client:* ${clientName}\n*Referral ID:* ${referralId}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Complete Service',
              emoji: true,
            },
            style: 'primary',
            action_id: 'open_completion_modal',
            value: referralId,
          },
        ],
      },
    ],
  });
}
