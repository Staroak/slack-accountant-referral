import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import type { CalendarEventData, ExcelReferralRow } from '@/types';

// Initialize Microsoft Graph client with app-only authentication
function getGraphClient(): Client {
  const credential = new ClientSecretCredential(
    process.env.AZURE_AD_TENANT_ID!,
    process.env.AZURE_AD_CLIENT_ID!,
    process.env.AZURE_AD_CLIENT_SECRET!
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({ authProvider });
}

// Get the Graph client instance
export const graphClient = getGraphClient();

// Get Excel workbook API base path - uses pre-configured IDs for speed
function getExcelApiPath(): string {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.EXCEL_FILE_ID;
  
  if (!driveId || !itemId) {
    throw new Error('Missing SHAREPOINT_DRIVE_ID or EXCEL_FILE_ID');
  }
  
  return `/drives/${driveId}/items/${itemId}`;
}

// Create a calendar event on Jarrod's calendar
export async function createCalendarEvent(eventData: CalendarEventData): Promise<string> {
  const client = getGraphClient();
  const calendarEmail = process.env.JARROD_CALENDAR_EMAIL;

  const event = {
    subject: eventData.subject,
    body: {
      contentType: 'HTML',
      content: eventData.body,
    },
    start: {
      dateTime: eventData.startDateTime,
      timeZone: 'America/Los_Angeles',
    },
    end: {
      dateTime: eventData.endDateTime,
      timeZone: 'America/Los_Angeles',
    },
    location: eventData.location ? { displayName: eventData.location } : undefined,
    attendees: [
      {
        emailAddress: {
          address: eventData.attendeeEmail,
        },
        type: 'required',
      },
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };

  const result = await client
    .api(`/users/${calendarEmail}/events`)
    .post(event);

  return result.id;
}

// Append a new row to the Excel referrals spreadsheet
export async function appendExcelRow(rowData: ExcelReferralRow): Promise<void> {
  const client = getGraphClient();
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'Referrals';
  const basePath = getExcelApiPath();

  // Convert row data to array format
  const values = [[
    rowData.id,
    rowData.clientName,
    rowData.clientEmail,
    rowData.clientPhone,
    rowData.serviceType,
    rowData.notes,
    rowData.brokerName,
    rowData.referralDate,
    rowData.appointmentDate || '',
    rowData.status,
    rowData.completedDate || '',
    rowData.invoiceStatus,
  ]];

  try {
    await client
      .api(`${basePath}/workbook/worksheets/${worksheetName}/tables/ReferralsTable/rows`)
      .post({ values });
  } catch (error: any) {
    console.error('Excel append error:', error?.message || error);
    throw error;
  }
}

// Update a specific cell in the Excel spreadsheet
export async function updateExcelCell(
  rowIndex: number,
  columnLetter: string,
  value: string
): Promise<void> {
  const client = getGraphClient();
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'Referrals';
  const basePath = getExcelApiPath();

  // Row index is 1-based, add 2 to account for header row
  const cellAddress = `${columnLetter}${rowIndex + 2}`;

  await client
    .api(`${basePath}/workbook/worksheets/${worksheetName}/range(address='${cellAddress}')`)
    .patch({ values: [[value]] });
}

// Find a row by referral ID
export async function findRowByReferralId(referralId: string): Promise<number | null> {
  const client = getGraphClient();
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'Referrals';
  const basePath = getExcelApiPath();

  // Get the ID column (column A)
  const result = await client
    .api(`${basePath}/workbook/worksheets/${worksheetName}/range(address='A:A')`)
    .get();

  const values = result.values as string[][];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === referralId) {
      return i; // Return 0-based index
    }
  }

  return null;
}

// Update referral status in Excel
export async function updateReferralStatus(
  referralId: string,
  status: ExcelReferralRow['status'],
  additionalUpdates?: { completedDate?: string; invoiceStatus?: ExcelReferralRow['invoiceStatus'] }
): Promise<void> {
  const rowIndex = await findRowByReferralId(referralId);
  if (rowIndex === null) {
    throw new Error(`Referral ID ${referralId} not found in Excel`);
  }

  // Status is column J (10th column)
  await updateExcelCell(rowIndex, 'J', status);

  if (additionalUpdates?.completedDate) {
    // Completed date is column K (11th column)
    await updateExcelCell(rowIndex, 'K', additionalUpdates.completedDate);
  }

  if (additionalUpdates?.invoiceStatus) {
    // Invoice status is column L (12th column)
    await updateExcelCell(rowIndex, 'L', additionalUpdates.invoiceStatus);
  }
}

// Mark invoice as paid
export async function markInvoicePaid(referralId: string): Promise<void> {
  await updateReferralStatus(referralId, 'paid', { invoiceStatus: 'paid' });
}

// Get calendar availability for the next 7 days
export interface TimeSlot {
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  display: string;   // Human readable
}

export async function getCalendarAvailability(days: number = 7): Promise<TimeSlot[]> {
  const client = getGraphClient();
  const calendarEmail = process.env.JARROD_CALENDAR_EMAIL;

  // Get date range
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  // Fetch calendar events for the date range
  const events = await client
    .api(`/users/${calendarEmail}/calendarView`)
    .query({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      $select: 'start,end,subject',
      $orderby: 'start/dateTime',
    })
    .get();

  // Define working hours (9 AM - 5 PM, 1 hour slots)
  const workingHours = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' }, // Skip lunch 12-1
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
  ];

  const busyTimes: Set<string> = new Set();

  // Mark busy slots
  for (const event of events.value || []) {
    const start = new Date(event.start.dateTime + 'Z');
    const end = new Date(event.end.dateTime + 'Z');

    // Convert to Pacific time for comparison
    const startLocal = new Date(start.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const endLocal = new Date(end.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

    const dateKey = startLocal.toISOString().slice(0, 10);

    // Mark each overlapping hour slot as busy
    for (const slot of workingHours) {
      const slotStart = new Date(`${dateKey}T${slot.start}:00`);
      const slotEnd = new Date(`${dateKey}T${slot.end}:00`);

      if (startLocal < slotEnd && endLocal > slotStart) {
        busyTimes.add(`${dateKey}|${slot.start}`);
      }
    }
  }

  // Generate available slots
  const availableSlots: TimeSlot[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dateKey = date.toISOString().slice(0, 10);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    for (const slot of workingHours) {
      const slotKey = `${dateKey}|${slot.start}`;

      // Skip past times for today
      if (d === 0) {
        const now = new Date();
        const slotTime = new Date(`${dateKey}T${slot.start}:00`);
        if (slotTime <= now) continue;
      }

      if (!busyTimes.has(slotKey)) {
        availableSlots.push({
          date: dateKey,
          startTime: slot.start,
          endTime: slot.end,
          display: `${dayName} ${slot.start} - ${slot.end}`,
        });
      }
    }
  }

  return availableSlots;
}

// Send referral data to Power Automate webhook (fast, fire-and-forget)
export async function sendToExcelWebhook(rowData: ExcelReferralRow): Promise<void> {
  const webhookUrl = process.env.POWERAUTOMATE_WEBHOOK_URL;
  
  if (!webhookUrl) {
    throw new Error('Missing POWERAUTOMATE_WEBHOOK_URL environment variable');
  }

  // Fire-and-forget POST to Power Automate
  // We don't await the full response - just confirm it was accepted
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: rowData.id,
        clientName: rowData.clientName,
        clientEmail: rowData.clientEmail,
        clientPhone: rowData.clientPhone,
        serviceType: rowData.serviceType,
        notes: rowData.notes || '',
        brokerName: rowData.brokerName,
        referralDate: rowData.referralDate,
        appointmentDate: rowData.appointmentDate || '',
        status: rowData.status,
        completedDate: rowData.completedDate || '',
        invoiceStatus: rowData.invoiceStatus,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && response.status !== 202) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      // Request was sent but we timed out waiting for response - that's OK
      console.log('Webhook request sent (response timeout - continuing)');
      return;
    }
    throw error;
  }
}
