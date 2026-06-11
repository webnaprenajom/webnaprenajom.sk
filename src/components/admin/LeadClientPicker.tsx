import { ClientPicker, type ClientPickerValue } from "@/components/admin/lookup/ClientPicker";

export interface LeadOption {
  id: string;
  name: string;
  email: string | null;
}

export interface LeadClientPickerProps {
  leads: LeadOption[];
  clientName: string;
  leadId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  onChange: (value: {
    client_name: string;
    lead_id: string | null;
    customer_id: string | null;
    customer_email: string | null;
  }) => void;
}

/** Tasks client picker — persists customer_id when available (Batch I). */
export function LeadClientPicker({
  leads,
  clientName,
  leadId,
  customerId,
  customerEmail,
  onChange,
}: LeadClientPickerProps) {
  const handleChange = (value: ClientPickerValue) => {
    onChange({
      client_name: value.client_name,
      lead_id: value.lead_id,
      customer_id: value.customer_id,
      customer_email: value.customer_email,
    });
  };

  return (
    <ClientPicker
      leads={leads}
      clientName={clientName}
      customerId={customerId}
      customerEmail={customerEmail}
      leadId={leadId || null}
      onChange={handleChange}
    />
  );
}
