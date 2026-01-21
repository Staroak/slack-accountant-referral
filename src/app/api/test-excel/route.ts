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

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    config: {
      SHAREPOINT_HOST: process.env.SHAREPOINT_HOST || 'NOT SET',
      SHAREPOINT_SITE_NAME: process.env.SHAREPOINT_SITE_NAME || 'NOT SET',
      SHAREPOINT_LIBRARY_NAME: process.env.SHAREPOINT_LIBRARY_NAME || 'NOT SET',
      EXCEL_FILE_PATH: process.env.EXCEL_FILE_PATH || 'NOT SET',
      EXCEL_WORKSHEET_NAME: process.env.EXCEL_WORKSHEET_NAME || 'NOT SET',
    },
    steps: {},
  };

  const client = getGraphClient();

  // Step 1: Get Site
  try {
    const sharepointHost = process.env.SHAREPOINT_HOST;
    const siteName = process.env.SHAREPOINT_SITE_NAME;
    const site = await client.api(`/sites/${sharepointHost}:/sites/${siteName}`).get();
    results.steps.site = { success: true, id: site.id, name: site.displayName };
  } catch (error: any) {
    results.steps.site = { success: false, error: error.message };
    return NextResponse.json(results, { status: 500 });
  }

  // Step 2: Get Drives
  try {
    const drives = await client.api(`/sites/${results.steps.site.id}/drives`).get();
    results.steps.drives = {
      success: true,
      count: drives.value.length,
      available: drives.value.map((d: any) => ({ name: d.name, id: d.id, webUrl: d.webUrl })),
    };
  } catch (error: any) {
    results.steps.drives = { success: false, error: error.message };
    return NextResponse.json(results, { status: 500 });
  }

  // Step 3: Find matching drive
  const libraryName = process.env.SHAREPOINT_LIBRARY_NAME;
  const drive = results.steps.drives.available.find((d: any) =>
    d.name === libraryName ||
    d.name?.toLowerCase() === libraryName?.toLowerCase() ||
    d.webUrl?.includes(`/${libraryName}/`) ||
    d.webUrl?.endsWith(`/${libraryName}`)
  );

  if (!drive) {
    results.steps.matchedDrive = { success: false, error: `No drive matches "${libraryName}"` };
    return NextResponse.json(results, { status: 500 });
  }
  results.steps.matchedDrive = { success: true, ...drive };

  // Step 4: Get file
  try {
    const filePath = process.env.EXCEL_FILE_PATH;
    const encodedPath = filePath?.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const item = await client.api(`/drives/${drive.id}/root:/${encodedPath}`).get();
    results.steps.file = { success: true, id: item.id, name: item.name, webUrl: item.webUrl };
  } catch (error: any) {
    results.steps.file = { success: false, error: error.message };
    return NextResponse.json(results, { status: 500 });
  }

  // Step 5: Get workbook info
  try {
    const worksheetName = process.env.EXCEL_WORKSHEET_NAME;
    const worksheets = await client.api(`/drives/${drive.id}/items/${results.steps.file.id}/workbook/worksheets`).get();
    results.steps.worksheets = {
      success: true,
      available: worksheets.value.map((w: any) => w.name),
      targetExists: worksheets.value.some((w: any) => w.name === worksheetName),
    };
  } catch (error: any) {
    results.steps.worksheets = { success: false, error: error.message };
    return NextResponse.json(results, { status: 500 });
  }

  // Step 6: Check table
  try {
    const worksheetName = process.env.EXCEL_WORKSHEET_NAME;
    const tables = await client.api(`/drives/${drive.id}/items/${results.steps.file.id}/workbook/worksheets/${worksheetName}/tables`).get();
    results.steps.tables = {
      success: true,
      available: tables.value.map((t: any) => t.name),
      referralsTableExists: tables.value.some((t: any) => t.name === 'ReferralsTable'),
    };
  } catch (error: any) {
    results.steps.tables = { success: false, error: error.message };
    return NextResponse.json(results, { status: 500 });
  }

  results.allPassed = true;
  return NextResponse.json(results);
}
