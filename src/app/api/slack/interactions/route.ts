import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, openReferralModal, getSlackUserInfo, postCompletionNotification } from '@/lib/slack';
import { createCalendarEvent, appendExcelRow } from '@/lib/graph';
import type { ReferralFormData, ExcelReferralRow } from '@/types';
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
      // Open the referral form modal
      await openReferralModal(payload.trigger_id);
      return NextResponse.json({});

    case 'open_completion_modal':
      // TODO: Open service completion modal
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
    const formData: ReferralFormData = {
      clientName: values.client_name_block.client_name.value,
      clientEmail: values.client_email_block.client_email.value,
      clientPhone: values.client_phone_block.client_phone.value,
      serviceType: values.service_type_block.service_type.selected_option.value,
      notes: values.notes_block?.notes?.value || '',
      brokerUserId: userId,
      brokerName,
      appointmentDate: values.appointment_date_block?.appointment_date?.selected_date,
      appointmentTime: values.appointment_time_block?.appointment_time?.selected_time,
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

    // Add to Excel spreadsheet
    const excelRow: ExcelReferralRow = {
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
      completedDate: null,
      invoiceStatus: 'pending',
    };

    try {
      await appendExcelRow(excelRow);
    } catch (excelError: any) {
      console.error('Excel append failed:', excelError);
      // Return error to user in modal
      return NextResponse.json({
        response_action: 'errors',
        errors: {
          client_name_block: `Failed to save referral: ${excelError?.message || 'Excel error'}. Contact admin.`,
        },
      });
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
  // TODO: Handle service completion form submission
  // This will update Excel and post to #accounting-admin
  return NextResponse.json({});
}
