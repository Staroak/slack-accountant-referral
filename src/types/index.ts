// Referral form data from Slack modal
export interface ReferralFormData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: 'tax_preparation' | 'bookkeeping' | 'payroll' | 'consulting' | 'other';
  notes: string;
  brokerUserId: string;
  brokerName: string;
  appointmentDate?: string;
  appointmentTime?: string;
}

// Excel row structure for referrals
export interface ExcelReferralRow {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: string;
  notes: string;
  brokerName: string;
  referralDate: string;
  appointmentDate: string | null;
  status: 'pending' | 'scheduled' | 'completed' | 'invoiced' | 'paid';
  completedDate: string | null;
  invoiceStatus: 'pending' | 'sent' | 'paid';
}

// Service completion form data
export interface ServiceCompletionData {
  referralId: string;
  completionNotes: string;
  serviceDate: string;
  jrAccountantUserId: string;
  jrAccountantName: string;
}

// Calendar event structure
export interface CalendarEventData {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmail: string;
  body: string;
  location?: string;
}
