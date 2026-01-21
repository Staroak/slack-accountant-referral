// Zapier Webhook Integration

export interface ReferralData {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: string;
  notes: string;
  brokerName: string;
  referralDate: string;
  appointmentDate: string | null;
  status: string;
}

// Send referral data to Zapier webhook → Excel
export async function sendToZapier(data: ReferralData): Promise<void> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!webhookUrl) {
    throw new Error('ZAPIER_WEBHOOK_URL not configured');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: data.id,
      client_name: data.clientName,
      client_email: data.clientEmail,
      client_phone: data.clientPhone,
      service_type: data.serviceType.replace(/_/g, ' '),
      notes: data.notes || '',
      broker_name: data.brokerName,
      referral_date: data.referralDate,
      appointment_date: data.appointmentDate || '',
      status: data.status,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zapier webhook failed: ${response.status}`);
  }
}
