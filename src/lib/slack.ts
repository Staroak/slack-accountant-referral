import { WebClient } from '@slack/web-api';
import crypto from 'crypto';

// Initialize Slack Web API client
export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Verify Slack request signature
export function verifySlackRequest(
  signingSecret: string,
  requestBody: string,
  timestamp: string,
  signature: string
): boolean {
  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 60 * 5) {
    return false;
  }

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${requestBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(sigBasestring);
  const expectedSignature = `v0=${hmac.digest('hex')}`;

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Post a message with the "New Referral" button to #accountant-referral
export async function postNewReferralButton(channel: string) {
  return slackClient.chat.postMessage({
    channel,
    text: 'Click to create a new accountant referral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Ready to submit a new accountant referral?*\nClick the button below to fill out the referral form.',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'New Referral',
              emoji: true,
            },
            style: 'primary',
            action_id: 'open_referral_modal',
          },
        ],
      },
    ],
  });
}

// Open the referral form modal with calendar availability
export async function openReferralModal(triggerId: string, availableSlots?: { date: string; startTime: string; endTime: string; display: string }[]) {
  // Build appointment options from available slots
  const appointmentOptions = availableSlots && availableSlots.length > 0
    ? availableSlots.slice(0, 100).map(slot => ({
        text: { type: 'plain_text' as const, text: slot.display },
        value: `${slot.date}|${slot.startTime}`,
      }))
    : [
        {
          text: { type: 'plain_text' as const, text: 'No available slots' },
          value: 'none',
        },
      ];

  return slackClient.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'referral_form_submit',
      title: {
        type: 'plain_text',
        text: 'New Accountant Referral',
      },
      submit: {
        type: 'plain_text',
        text: 'Submit Referral',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'input',
          block_id: 'client_name_block',
          element: {
            type: 'plain_text_input',
            action_id: 'client_name',
            placeholder: {
              type: 'plain_text',
              text: 'Enter client name',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Client Name',
          },
        },
        {
          type: 'input',
          block_id: 'client_email_block',
          element: {
            type: 'plain_text_input',
            action_id: 'client_email',
            placeholder: {
              type: 'plain_text',
              text: 'client@example.com',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Client Email',
          },
        },
        {
          type: 'input',
          block_id: 'client_phone_block',
          element: {
            type: 'plain_text_input',
            action_id: 'client_phone',
            placeholder: {
              type: 'plain_text',
              text: '(555) 123-4567',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Client Phone',
          },
        },
        {
          type: 'input',
          block_id: 'service_type_block',
          element: {
            type: 'static_select',
            action_id: 'service_type',
            placeholder: {
              type: 'plain_text',
              text: 'Select service type',
            },
            options: [
              {
                text: { type: 'plain_text', text: 'Tax Preparation' },
                value: 'tax_preparation',
              },
              {
                text: { type: 'plain_text', text: 'Bookkeeping' },
                value: 'bookkeeping',
              },
              {
                text: { type: 'plain_text', text: 'Payroll' },
                value: 'payroll',
              },
              {
                text: { type: 'plain_text', text: 'Consulting' },
                value: 'consulting',
              },
              {
                text: { type: 'plain_text', text: 'Other' },
                value: 'other',
              },
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Service Type',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Jared\'s Availability*\nSelect an available appointment slot:',
          },
        },
        {
          type: 'input',
          block_id: 'appointment_slot_block',
          element: {
            type: 'static_select',
            action_id: 'appointment_slot',
            placeholder: {
              type: 'plain_text',
              text: 'Select available time slot',
            },
            options: appointmentOptions,
          },
          label: {
            type: 'plain_text',
            text: 'Appointment Slot',
          },
          optional: true,
        },
        {
          type: 'input',
          block_id: 'notes_block',
          element: {
            type: 'plain_text_input',
            action_id: 'notes',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Any additional notes about this referral...',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Notes',
          },
          optional: true,
        },
      ],
    },
  });
}

// Post service completion notification to #accounting-admin
export async function postCompletionNotification(
  channel: string,
  referralId: string,
  clientName: string,
  serviceSummary: string,
  jrAccountantName: string
) {
  return slackClient.chat.postMessage({
    channel,
    text: `Service completed for ${clientName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Service Completed* :white_check_mark:\n\n*Client:* ${clientName}\n*Completed by:* ${jrAccountantName}\n*Summary:* ${serviceSummary}\n*Referral ID:* ${referralId}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `React with :white_check_mark: when invoice has been marked as paid`,
          },
        ],
      },
    ],
    metadata: {
      event_type: 'service_completion',
      event_payload: {
        referral_id: referralId,
      },
    },
  });
}

// Get user info from Slack
export async function getSlackUserInfo(userId: string) {
  const result = await slackClient.users.info({ user: userId });
  return result.user;
}

// Publish the App Home tab for a user
export async function publishAppHome(userId: string) {
  return slackClient.views.publish({
    user_id: userId,
    view: {
      type: 'home',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Accountant Referral System',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Submit new client referrals to our accounting team. Click the button below to fill out the referral form.',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'New Referral',
                emoji: true,
              },
              style: 'primary',
              action_id: 'open_referral_modal',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Referrals will be posted to the records channel and added to the calendar if a date is selected.',
            },
          ],
        },
      ],
    },
  });
}

// Post "Complete Service" button to #accounting-services-completed
export async function postCompleteServiceButton(channel: string) {
  return slackClient.chat.postMessage({
    channel,
    text: 'Click to mark a service as complete',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Ready to mark a service as complete?*\nClick the button below to fill out the completion form.',
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
          },
        ],
      },
    ],
  });
}

// Open the service completion modal with simple text inputs
export async function openCompletionModal(triggerId: string) {
  return slackClient.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'completion_form_submit',
      title: {
        type: 'plain_text',
        text: 'Complete Service',
      },
      submit: {
        type: 'plain_text',
        text: 'Submit',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'input',
          block_id: 'referral_id_block',
          element: {
            type: 'plain_text_input',
            action_id: 'referral_id',
            placeholder: {
              type: 'plain_text',
              text: 'REF-XXXXXXXX',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Referral # (from #accountant-referral)',
          },
        },
        {
          type: 'input',
          block_id: 'client_name_block',
          element: {
            type: 'plain_text_input',
            action_id: 'client_name',
            placeholder: {
              type: 'plain_text',
              text: 'Client name',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Client Name',
          },
        },
        {
          type: 'input',
          block_id: 'tax_owed_block',
          element: {
            type: 'radio_buttons',
            action_id: 'tax_owed',
            options: [
              {
                text: { type: 'plain_text', text: 'Yes' },
                value: 'yes',
              },
              {
                text: { type: 'plain_text', text: 'No' },
                value: 'no',
              },
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Tax $ Owed?',
          },
        },
        {
          type: 'input',
          block_id: 'tax_amount_block',
          element: {
            type: 'plain_text_input',
            action_id: 'tax_amount',
            placeholder: {
              type: 'plain_text',
              text: '$0.00',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Tax Amount (if applicable)',
          },
          optional: true,
        },
        {
          type: 'input',
          block_id: 'service_summary_block',
          element: {
            type: 'plain_text_input',
            action_id: 'service_summary',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Brief summary of work completed...',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Service Summary',
          },
        },
      ],
    },
  });
}

// Fetch recent referrals from the records channel for dropdown selection
export async function fetchRecentReferrals(limit: number = 50): Promise<{ id: string; clientName: string; serviceType: string }[]> {
  const recordsChannel = process.env.CHANNEL_ACCOUNTANT_REFERRAL;
  if (!recordsChannel) {
    return [];
  }

  try {
    const result = await slackClient.conversations.history({
      channel: recordsChannel,
      limit,
    });

    const referrals: { id: string; clientName: string; serviceType: string }[] = [];

    for (const message of result.messages || []) {
      // Try metadata first (new format)
      const metadata = message.metadata as any;
      if (metadata?.event_type === 'referral_record') {
        const payload = metadata.event_payload;
        if (payload?.referral_id && payload?.client_name) {
          referrals.push({
            id: payload.referral_id,
            clientName: payload.client_name,
            serviceType: payload.service_type || 'Unknown',
          });
        }
        continue;
      }

      // Fallback: parse from message text or blocks
      const text = message.text || '';

      // Try to find REF-XXXXXXXX pattern
      const refMatch = text.match(/\b(REF-[A-Z0-9]{8})\b/);

      // Try multiple patterns for client name
      const clientMatch =
        text.match(/\*Client Name:\*\s*\n?([^\n*]+)/i) ||
        text.match(/\*Client:\*\s*\n?([^\n*]+)/i) ||
        text.match(/Client Name:\s*([^\n]+)/i) ||
        text.match(/Client:\s*([^\n]+)/i) ||
        text.match(/New Referral:\s*([^\n]+)/i);

      if (refMatch && clientMatch) {
        referrals.push({
          id: refMatch[1],
          clientName: clientMatch[1].trim(),
          serviceType: 'Unknown',
        });
      }
    }

    return referrals;
  } catch (error) {
    console.error('Failed to fetch referrals:', error);
    return [];
  }
}

// Post a referral record to a channel (serves as the data store)
export async function postReferralRecord(
  channel: string,
  referralData: {
    id: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    serviceType: string;
    notes: string;
    brokerName: string;
    referralDate: string;
    appointmentDate?: string | null;
    status: string;
  }
) {
  const serviceTypeDisplay = referralData.serviceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  return slackClient.chat.postMessage({
    channel,
    text: `New Referral: ${referralData.clientName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📋 New Referral: ${referralData.id}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Client Name:*\n${referralData.clientName}` },
          { type: 'mrkdwn', text: `*Service Type:*\n${serviceTypeDisplay}` },
          { type: 'mrkdwn', text: `*Email:*\n${referralData.clientEmail}` },
          { type: 'mrkdwn', text: `*Phone:*\n${referralData.clientPhone}` },
          { type: 'mrkdwn', text: `*Referred By:*\n${referralData.brokerName}` },
          { type: 'mrkdwn', text: `*Date:*\n${referralData.referralDate}` },
        ],
      },
      ...(referralData.appointmentDate ? [{
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `*📅 Appointment:* ${referralData.appointmentDate}`,
        },
      }] : []),
      ...(referralData.notes ? [{
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `*Notes:*\n${referralData.notes}`,
        },
      }] : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Status: *${referralData.status}* | ID: ${referralData.id}`,
          },
        ],
      },
      {
        type: 'divider',
      },
    ],
    metadata: {
      event_type: 'referral_record',
      event_payload: {
        referral_id: referralData.id,
        client_name: referralData.clientName,
        service_type: referralData.serviceType,
        status: referralData.status,
      },
    },
  });
}
