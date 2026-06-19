import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { linkLeadAfterDelivery } from "@/lib/crmLookup/leadCustomerLifecycle";
import {
  assertDeliveryHasCanonicalCustomer,
  parseInsertRowId,
} from "@/lib/crmLookup/entitySaveHelpers";
import { resolveFormCustomerLink } from "@/lib/crmLookup/resolveFormCustomerLink";
import type { MarketingRecord } from "./shared";

export async function saveMarketingRecord(
  editing: Partial<MarketingRecord>,
  setCustomerFieldError: (message: string | null) => void,
): Promise<{ ok: true; id: string; created: boolean } | { ok: false }> {
  if (!editing?.title?.trim()) {
    toast({ title: "Zadaj názov kampane", variant: "destructive" });
    return { ok: false };
  }

  let linked;
  try {
    linked = await resolveFormCustomerLink({
      customer_id: editing.customer_id,
      customer_email: editing.customer_email,
      client_name: editing.client_name,
      lead_id: editing.lead_id,
      createIfMissing: true,
    });
  } catch (e) {
    toast({
      title: "Klient — neplatný e-mail",
      description:
        e instanceof Error
          ? e.message
          : "Vyberte klienta z vyhľadávania alebo zadajte platný e-mail.",
      variant: "destructive",
    });
    return { ok: false };
  }

  const customerGuard = assertDeliveryHasCanonicalCustomer(linked);
  if (!customerGuard.ok) {
    setCustomerFieldError(customerGuard.message);
    toast({ title: customerGuard.message, variant: "destructive" });
    return { ok: false };
  }
  setCustomerFieldError(null);

  const payload = {
    title: editing.title.trim(),
    client_name: linked.client_name || null,
    customer_email: linked.customer_email,
    customer_id: linked.customer_id,
    lead_id: linked.lead_id || editing.lead_id || null,
    channel: editing.channel || "other",
    status: editing.status || "active",
    url: editing.url?.trim() || null,
    notes: editing.notes?.trim() || null,
    agreed_fee:
      editing.agreed_fee != null && Number(editing.agreed_fee) > 0
        ? Math.max(0, Number(editing.agreed_fee))
        : null,
  };

  const created = !editing.id;
  const { data: saved, error } = editing.id
    ? await supabase
        .from("marketing_records")
        .update(payload)
        .eq("id", editing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("marketing_records").insert(payload).select("id").maybeSingle();

  const insertResult = parseInsertRowId(saved, error, "Marketing");
  if (!insertResult.ok) {
    toast({
      title: editing.id ? "Aktualizácia zlyhala" : "Kampaň sa nepodarilo vytvoriť",
      description: insertResult.error,
      variant: "destructive",
    });
    return { ok: false };
  }

  if (linked.lead_id && linked.customer_id) {
    await linkLeadAfterDelivery(linked.lead_id, linked.customer_id);
  }

  toast({ title: created ? "Kampaň vytvorená" : "Aktualizované" });
  return { ok: true, id: insertResult.id, created };
}
