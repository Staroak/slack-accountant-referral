import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, openReferralModal, openCompletionModal, getSlackUserInfo, postCompletionNotification, postReferralRecord, fetchRecentReferrals } from '@/lib/slack';
import { createCalendarEvent, getCalendarAvailability } from '@/lib/graph';
import { sendToZapier, sendCompletionToZapier } from '@/lib/zapier';
import type { ReferralFormData } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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

    // Parse the payload
    const params = new URLSearchParams(body);
    const payload = JSON.parse(params.get('payload') || '{}');

    // Handle different interaction types
    switch (payload.type) {
      case 'block_actions':
        return handleBlockActions(payload);
      case 'view_submission':
        return handleViewSubmission(payload);
      default:
        return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling Slack interaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleBlockActions(payload: any) {
  const action = payload.actions[0];

  switch (action.action_id) {
    case 'open_referral_modal':
      // Fetch Jared's calendar availability from Outlook
      let availableSlots: { date: string; startTime: string; endTime: string; display: string }[] = [];
      try {
        availableSlots = await getCalendarAvailability(7);
      } catch (error) {
        console.error('Failed to fetch calendar availability:', error);
      }
      // Open the referral form modal with availability
      await openReferralModal(payload.trigger_id, availableSlots);
      return NextResponse.json({});

    case 'open_completion_modal':
      // Fetch recent referrals for the dropdown
      let referrals: { id: string; clientName: string; serviceType: string }[] = [];
      try {
        referrals = await fetchRecentReferrals();
      } catch (error) {
        console.error('Failed to fetch referrals:', error);
      }
      await openCompletionModal(payload.trigger_id, referrals);
      return NextResponse.json({});

    default:
      return NextResponse.json({});
  }
}

async function handleViewSubmission(payload: any) {
  const callbackId = payload.view.callback_id;

  switch (callbackId) {
    case 'referral_form_submit':
      return handleReferralSubmission(payload);
    case 'completion_form_submit':
      return handleCompletionSubmission(payload);
    default:
      return NextResponse.json({});
  }
}

async function handleReferralSubmission(payload: any) {
  try {
    const values = payload.view.state.values;
    const userId = payload.user.id;

    // Get user info for broker name
    const userInfo = await getSlackUserInfo(userId);
    const brokerName = userInfo?.real_name || userInfo?.name || 'Unknown';

    // Extract form values
    // Parse appointment slot (format: "YYYY-MM-DD|HH:mm" or "none")
    const appointmentSlot = values.appointment_slot_block?.appointment_slot?.selected_option?.value;
    let appointmentDate: string | undefined;
    let appointmentTime: string | undefined;

    if (appointmentSlot && appointmentSlot !== 'none') {
      const [date, time] = appointmentSlot.split('|');
      appointmentDate = date;
      appointmentTime = time;
    }

    const formData: ReferralFormData = {
      clientName: values.client_name_block.client_name.value,
      clientEmail: values.client_email_block.client_email.value,
      clientPhone: values.client_phone_block.client_phone.value,
      serviceType: values.service_type_block.service_type.selected_option.value,
      notes: values.notes_block?.notes?.value || '',
      brokerUserId: userId,
      brokerName,
      appointmentDate,
      appointmentTime,
    };

    // Generate unique referral ID
    const referralId = `REF-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Create calendar event if date/time provided
    let appointmentDateTime: string | null = null;
    if (formData.appointmentDate && formData.appointmentTime) {
      try {
        const startDateTime = `${formData.appointmentDate}T${formData.appointmentTime}:00`;
        const endDate = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
        endDate.setHours(endDate.getHours() + 1);
        const endDateTime = endDate.toISOString().slice(0, 19);

        await createCalendarEvent({
          subject: `Accountant Appointment: ${formData.clientName}`,
          startDateTime,
          endDateTime,
          attendeeEmail: formData.clientEmail,
          body: `
            <h2>Accountant Referral Appointment</h2>
            <p><strong>Client:</strong> ${formData.clientName}</p>
            <p><strong>Email:</strong> ${formData.clientEmail}</p>
            <p><strong>Phone:</strong> ${formData.clientPhone}</p>
            <p><strong>Service:</strong> ${formData.serviceType.replace('_', ' ')}</p>
            <p><strong>Notes:</strong> ${formData.notes || 'None'}</p>
            <p><strong>Referred by:</strong> ${brokerName}</p>
            <p><strong>Referral ID:</strong> ${referralId}</p>
          `,
        });

        appointmentDateTime = startDateTime;
      } catch (calendarError) {
        console.error('Calendar event creation failed:', calendarError);
        // Continue without calendar event - don't fail the whole submission
      }
    }

    // Post referral record to Slack channel (serves as data store)
    const referralRecord = {
      id: referralId,
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
      clientPhone: formData.clientPhone,
      serviceType: formData.serviceType,
      notes: formData.notes,
      brokerName: formData.brokerName,
      referralDate: new Date().toISOString().slice(0, 10),
      appointmentDate: appointmentDateTime,
      status: appointmentDateTime ? 'scheduled' : 'pending',
    };

    try {
      const recordsChannel = process.env.CHANNEL_ACCOUNTANT_REFERRAL;
      if (!recordsChannel) {
        throw new Error('No channel configured for referral records');
      }
      await postReferralRecord(recordsChannel, referralRecord);
    } catch (slackError: any) {
      console.error('Failed to post referral record:', slackError);
      // Return error to user in modal
      return NextResponse.json({
        response_action: 'errors',
        errors: {
          client_name_block: `Failed to save referral: ${slackError?.message || 'Slack error'}. Contact admin.`,
        },
      });
    }

    // Send to Zapier → Excel (non-blocking, don't fail if Zapier fails)
    try {
      await sendToZapier(referralRecord);
    } catch (zapierError) {
      console.error('Zapier webhook failed (non-critical):', zapierError);
      // Don't fail the submission - Slack record is the source of truth
    }

    // Return empty response to close modal
    return NextResponse.json({});
  } catch (error: any) {
    console.error('Referral submission error:', error);
    return NextResponse.json({
      response_action: 'errors',
      errors: {
        client_name_block: `Submission failed: ${error?.message || 'Unknown error'}. Please try again.`,
      },
    });
  }
}

async function handleCompletionSubmission(payload: any) {
  try {
    const values = payload.view.state.values;
    const userId = payload.user.id;

    // Get user info for Jr Accountant name
    const userInfo = await getSlackUserInfo(userId);
    const completedBy = userInfo?.real_name || userInfo?.name || 'Unknown';

    // Extract form values
    const referralSelection = values.referral_select_block?.referral_select?.selected_option?.value;

    if (!referralSelection || referralSelection === 'none') {
      return NextResponse.json({
        response_action: 'errors',
        errors: {
          referral_select_block: 'Please select a valid referral',
        },
      });
    }

    // Parse referral selection (format: "REF-XXXX|ClientName")
    const [referralId, clientName] = referralSelection.split('|');

    const taxOwed = values.tax_owed_block?.tax_owed?.selected_option?.value || 'no';
    const taxAmount = values.tax_amount_block?.tax_amount?.value || '';
    const serviceSummary = values.service_summary_block?.service_summary?.value || '';
    const completedDate = new Date().toISOString().slice(0, 10);

    // Post completion notification to #accountant-admin
    const adminChannel = process.env.CHANNEL_ACCOUNTING_ADMIN;
    if (!adminChannel) {
      throw new Error('CHANNEL_ACCOUNTING_ADMIN not configured');
    }

    await postCompletionNotification(
      adminChannel,
      referralId,
      clientName,
      serviceSummary,
      completedBy
    );

    // Send to Zapier → Excel (non-blocking)
    try {
      await sendCompletionToZapier({
        referralId,
        clientName,
        taxOwed,
        taxAmount,
        serviceSummary,
        completedBy,
        completedDate,
      });
    } catch (zapierError) {
      console.error('Zapier completion webhook failed (non-critical):', zapierError);
    }

    return NextResponse.json({});
  } catch (error: any) {
    console.error('Completion submission error:', error);
    return NextResponse.json({
      response_action: 'errors',
      errors: {
        referral_select_block: `Submission failed: ${error?.message || 'Unknown error'}. Please try again.`,
      },
    });
  }
}
