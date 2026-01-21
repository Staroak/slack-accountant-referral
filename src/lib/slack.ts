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

// Open the referral form modal
export async function openReferralModal(triggerId: string) {
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
          type: 'input',
          block_id: 'appointment_date_block',
          element: {
            type: 'datepicker',
            action_id: 'appointment_date',
            placeholder: {
              type: 'plain_text',
              text: 'Select a date',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Preferred Appointment Date',
          },
          optional: true,
        },
        {
          type: 'input',
          block_id: 'appointment_time_block',
          element: {
            type: 'timepicker',
            action_id: 'appointment_time',
            placeholder: {
              type: 'plain_text',
              text: 'Select time',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Preferred Appointment Time',
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
        status: referralData.status,
      },
    },
  });
}
