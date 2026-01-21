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

// Get Excel workbook API path using user drive + file path
function getExcelApiPath(): string {
  const driveOwnerEmail = process.env.EXCEL_DRIVE_OWNER_EMAIL;
  const filePath = process.env.EXCEL_FILE_PATH;
  
  if (!driveOwnerEmail || !filePath) {
    throw new Error('Missing EXCEL_DRIVE_OWNER_EMAIL or EXCEL_FILE_PATH');
  }
  
  // Use path-based access: /users/{email}/drive/root:/{path}:
  return `/users/${driveOwnerEmail}/drive/root:/${encodeURIComponent(filePath)}:`;
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
