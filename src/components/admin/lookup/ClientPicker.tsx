import { useMemo } from "react";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { ClientLinkBadge, CanonicalCustomerBadge } from "./LinkStatusBadge";
import type { LookupResult } from "@/lib/crmLookup/types";
import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";

export interface ClientPickerValue {
  client_name: string;
  customer_email: string | null;
  lead_id: string | null;
  customer_id: string | null;
}

export interface ClientPickerProps {
  leads?: Array<{ id: string; name: string; email: string | null }>;
  clientName: string;
  customerEmail?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  onChange: (value: ClientPickerValue) => void;
  allowFreeText?: boolean;
}

export function ClientPicker({
  leads,
  clientName,
  customerEmail,
  customerId,
  leadId,
  onChange,
  allowFreeText = true,
}: ClientPickerProps) {
  const isCanonical = !!customerId;
  const isLeadLinked = !isCanonical && !!leadId;

  const selected = useMemo((): LookupResult | null => {
    if (customerId) {
      return {
        kind: "customer",
        id: customerId,
        label: clientName || customerEmail || "Zákazník",
        sublabel: customerEmail || undefined,
        email: normalizeEmail(customerEmail),
        clientName: normalizeClientName(clientName),
        meta: { customer_id: customerId },
      };
    }
    if (leadId && leads?.length) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        return {
          kind: "lead",
          id: lead.id,
          label: lead.name,
          sublabel: lead.email || undefined,
          email: normalizeEmail(lead.email),
          clientName: normalizeClientName(lead.name),
        };
      }
    }
    if (leadId && clientName) {
      return {
        kind: "lead",
        id: leadId,
        label: clientName,
        sublabel: customerEmail || undefined,
        email: normalizeEmail(customerEmail),
        clientName: normalizeClientName(clientName),
      };
    }
    return null;
  }, [customerId, leadId, leads, clientName, customerEmail]);

  const handleSelect = (result: LookupResult | null) => {
    if (!result) {
      onChange({
        client_name: normalizeClientName(clientName) || clientName,
        customer_email: normalizeEmail(customerEmail),
        lead_id: null,
        customer_id: null,
      });
      return;
    }

    if (result.kind === "customer") {
      onChange({
        client_name: normalizeClientName(result.clientName || result.label) || result.label,
        customer_email: normalizeEmail(result.email),
        lead_id: null,
        customer_id: result.id,
      });
      return;
    }

    onChange({
      client_name: normalizeClientName(result.clientName || result.label) || result.label,
      customer_email: normalizeEmail(result.email),
      lead_id: result.kind === "lead" || result.kind === "client" ? result.id : null,
      customer_id: null,
    });
  };

  const handleFreeText = (text: string) => {
    onChange({
      client_name: text,
      customer_email: normalizeEmail(customerEmail),
      lead_id: null,
      customer_id: null,
    });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">Klient</span>
        {isCanonical ? (
          <CanonicalCustomerBadge />
        ) : (
          <ClientLinkBadge linked={isLeadLinked} />
        )}
      </div>
      <EntitySearchPicker
        kind="client"
        value={selected}
        allowFreeText={allowFreeText}
        freeTextValue={clientName}
        onFreeTextChange={handleFreeText}
        onSelect={handleSelect}
        placeholder="Meno klienta / firma"
        linked={isCanonical || isLeadLinked}
      />
      <p className="text-[10px] text-muted-foreground">
        {isCanonical
          ? "Kanónický klient — uloží sa customer_id."
          : isLeadLinked
            ? "Lead — uloží sa lead_id. Po zrealizovaní sa prepojí na klienta."
            : "Voľný text = len meno. Vyhľadajte klienta alebo lead."}
      </p>
    </div>
  );
}
