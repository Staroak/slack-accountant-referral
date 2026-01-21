import { NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const testWrite = url.searchParams.get('write') === 'true';
  
  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    config: {
      SHAREPOINT_DRIVE_ID: process.env.SHAREPOINT_DRIVE_ID ? 'SET' : 'NOT SET',
      EXCEL_FILE_ID: process.env.EXCEL_FILE_ID ? 'SET' : 'NOT SET',
      EXCEL_WORKSHEET_NAME: process.env.EXCEL_WORKSHEET_NAME || 'NOT SET',
    },
    timings: {},
  };

  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.EXCEL_FILE_ID;
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'Sheet1';

  if (!driveId || !itemId) {
    results.error = 'Missing SHAREPOINT_DRIVE_ID or EXCEL_FILE_ID';
    return NextResponse.json(results, { status: 500 });
  }

  const client = getGraphClient();
  const basePath = `/drives/${driveId}/items/${itemId}`;

  // Test 1: Get worksheets
  let t1 = Date.now();
  try {
    const worksheets = await client.api(`${basePath}/workbook/worksheets`).get();
    results.timings.getWorksheets = Date.now() - t1;
    results.worksheets = worksheets.value.map((w: any) => w.name);
  } catch (error: any) {
    results.timings.getWorksheets = Date.now() - t1;
    results.worksheetsError = error.message;
    return NextResponse.json(results, { status: 500 });
  }

  // Test 2: Get tables
  let t2 = Date.now();
  try {
    const tables = await client.api(`${basePath}/workbook/worksheets/${worksheetName}/tables`).get();
    results.timings.getTables = Date.now() - t2;
    results.tables = tables.value.map((t: any) => t.name);
  } catch (error: any) {
    results.timings.getTables = Date.now() - t2;
    results.tablesError = error.message;
    return NextResponse.json(results, { status: 500 });
  }

  // Test 3: Write test row (only if ?write=true)
  if (testWrite) {
    let t3 = Date.now();
    try {
      const testRow = [[
        `TEST-${Date.now()}`,
        'Test Client',
        'test@example.com',
        '555-0000',
        'tax_preparation',
        'Test note - DELETE THIS ROW',
        'Test Broker',
        new Date().toISOString().slice(0, 10),
        '',
        'pending',
        '',
        'pending',
      ]];
      await client
        .api(`${basePath}/workbook/worksheets/${worksheetName}/tables/ReferralsTable/rows`)
        .post({ values: testRow });
      results.timings.writeRow = Date.now() - t3;
      results.writeSuccess = true;
    } catch (error: any) {
      results.timings.writeRow = Date.now() - t3;
      results.writeError = error.message;
    }
  }

  results.timings.total = Date.now() - startTime;
  results.success = true;
  return NextResponse.json(results);
}
