import { hasAnyCredentials } from "@/lib/projectCredentials";
import { supabase } from "@/integrations/supabase/client";
import { findCustomerById } from "@/lib/crmLookup/customers";
import type { CommunicationEventRow } from "@/lib/communication/types";
import type {
  CommissionBrief,
  CustomerWorkbenchData,
  Design,
  HostingBrief,
  Lead,
  LeadLog,
  ProjectNote,
  Rental,
  Signature,
  Task,
  Wheel,
} from "./types";

export interface LoadCustomerWorkbenchInput {
  routeMode: "id" | "email";
  routeValue: string;
}

export async function loadCustomerWorkbench(
  input: LoadCustomerWorkbenchInput,
): Promise<CustomerWorkbenchData> {
  let customerId: string | null = null;
  let resolvedEmail = input.routeMode === "email" ? input.routeValue : "";
  let canonicalCustomer = null as unknown as CustomerWorkbenchData["canonicalCustomer"];
  const viewMode = input.routeMode;

  if (input.routeMode === "id") {
    const cust = await findCustomerById(input.routeValue);
    canonicalCustomer = cust;
    customerId = cust?.id ?? input.routeValue;
    resolvedEmail = cust?.email ?? "";
  } else {
    const { data: custRow } = await supabase
      .from("customers")
      .select("id,email,display_name,metadata,created_at,updated_at")
      .eq("email", input.routeValue)
      .maybeSingle();
    if (custRow) {
      canonicalCustomer = custRow as unknown as CustomerWorkbenchData["canonicalCustomer"];
      customerId = custRow.id;
    }
  }

  const leadFilter =
    customerId && resolvedEmail
      ? `customer_id.eq.${customerId},email.ilike.${resolvedEmail}`
      : customerId
        ? `customer_id.eq.${customerId}`
        : null;

  const { data: leadsData } = leadFilter
    ? await supabase
        .from("leads")
        .select("id,name,email,phone,status,source,assigned_to,temperature,created_at")
        .or(leadFilter)
        .order("created_at", { ascending: false })
    : resolvedEmail
      ? await supabase
          .from("leads")
          .select("id,name,email,phone,status,source,assigned_to,temperature,created_at")
          .ilike("email", resolvedEmail)
          .order("created_at", { ascending: false })
      : { data: [] };

  const leadRows = (leadsData || []) as Lead[];
  const leadIds = leadRows.map((l) => l.id);
  const leadNames = Array.from(new Set(leadRows.map((l) => (l.name || "").trim()).filter(Boolean)));

  const taskSelect =
    "id,title,status,amount,deposit,due_date,updated_at,client_name,lead_id,customer_id" as const;
  const taskQueries: Promise<{ data: Task[] | null }>[] = [];
  if (customerId) {
    taskQueries.push(
      supabase
        .from("tasks")
        .select(taskSelect)
        .eq("customer_id", customerId) as unknown as Promise<{ data: Task[] | null }>,
    );
  }
  if (leadIds.length) {
    taskQueries.push(
      supabase
        .from("tasks")
        .select(taskSelect)
        .in("lead_id", leadIds) as unknown as Promise<{ data: Task[] | null }>,
    );
  }
  if (leadNames.length) {
    taskQueries.push(
      supabase
        .from("tasks")
        .select(taskSelect)
        .in("client_name", leadNames) as unknown as Promise<{ data: Task[] | null }>,
    );
  }
  const taskResults = await Promise.all(taskQueries);
  const seenTasks = new Map<string, Task>();
  const linkRank = (matchedBy: Task["matchedBy"]) =>
    matchedBy === "customer_id" ? 0 : matchedBy === "lead_id" ? 1 : 2;

  taskResults.forEach((res) => {
    (res.data || []).forEach((t) => {
      let matchedBy: Task["matchedBy"] = "client_name";
      if (t.customer_id) matchedBy = "customer_id";
      else if (t.lead_id && leadIds.includes(t.lead_id)) matchedBy = "lead_id";

      const row: Task = { ...t, customer_id: t.customer_id ?? null, matchedBy };
      const existing = seenTasks.get(t.id);
      if (!existing || linkRank(matchedBy) < linkRank(existing.matchedBy)) {
        seenTasks.set(t.id, row);
      }
    });
  });
  const tasks = Array.from(seenTasks.values()).sort((a, b) => {
    const rank = linkRank(a.matchedBy) - linkRank(b.matchedBy);
    if (rank !== 0) return rank;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  let rentals: Rental[] = [];
  const rentalQueries: Promise<{ data: Rental[] | null }>[] = [];
  if (customerId) {
    rentalQueries.push(
      supabase
        .from("rental_websites")
        .select("id,name,url,monthly_price,implementers,client_name,created_at")
        .eq("customer_id", customerId) as unknown as Promise<{ data: Rental[] | null }>,
    );
  }
  if (leadNames.length) {
    rentalQueries.push(
      supabase
        .from("rental_websites")
        .select("id,name,url,monthly_price,implementers,client_name,created_at")
        .in("client_name", leadNames) as unknown as Promise<{ data: Rental[] | null }>,
    );
  }
  if (resolvedEmail) {
    rentalQueries.push(
      supabase
        .from("rental_websites")
        .select("id,name,url,monthly_price,implementers,client_name,created_at")
        .ilike("customer_email", resolvedEmail) as unknown as Promise<{ data: Rental[] | null }>,
    );
  }
  if (rentalQueries.length) {
    const rentalResults = await Promise.all(rentalQueries);
    const seenRentals = new Map<string, Rental>();
    rentalResults.forEach((res) => {
      (res.data || []).forEach((r) => {
        if (!seenRentals.has(r.id)) seenRentals.set(r.id, r);
      });
    });
    rentals = Array.from(seenRentals.values());
  }

  const { data: sigData } = resolvedEmail
    ? await supabase
        .from("order_signatures")
        .select(
          "id,client_name,email,plan,package_name,price,contract_months,status,signed_at,created_at",
        )
        .ilike("email", resolvedEmail)
        .order("signed_at", { ascending: false })
    : { data: [] };
  const signatures = (sigData || []) as Signature[];

  const noteQueries: Promise<{ data: Array<Record<string, unknown>> | null }>[] = [];
  if (customerId) {
    noteQueries.push(
      supabase
        .from("project_notes")
        .select("id,title,client_name,url,status,username,password,access_credentials,updated_at")
        .eq("customer_id", customerId) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
    );
  }
  if (resolvedEmail) {
    noteQueries.push(
      supabase
        .from("project_notes")
        .select("id,title,client_name,url,status,username,password,access_credentials,updated_at")
        .ilike("customer_email", resolvedEmail) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
    );
  }
  if (leadNames.length) {
    noteQueries.push(
      supabase
        .from("project_notes")
        .select("id,title,client_name,url,status,username,password,access_credentials,updated_at")
        .in("client_name", leadNames) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
    );
  }
  const noteResults = await Promise.all(noteQueries);
  const seenNotes = new Map<string, ProjectNote>();
  noteResults.forEach((res) => {
    (res.data || []).forEach((n) => {
      if (!seenNotes.has(n.id as string)) {
        seenNotes.set(n.id as string, {
          id: n.id as string,
          title: n.title as string,
          client_name: (n.client_name as string) ?? null,
          url: (n.url as string) ?? null,
          status: n.status as string,
          has_credentials: hasAnyCredentials({
            url: (n.url as string) ?? null,
            username: (n.username as string) ?? null,
            password: (n.password as string) ?? null,
            access_credentials: n.access_credentials,
          }),
          updated_at: n.updated_at as string | undefined,
        });
      }
    });
  });
  const notes = Array.from(seenNotes.values());

  const hostingQueries: Promise<{ data: HostingBrief[] | null }>[] = [];
  if (customerId) {
    hostingQueries.push(
      supabase
        .from("hosting_records")
        .select("id,client_name,provider,monthly_price,yearly_price,domains_count,active,created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: HostingBrief[] | null }>,
    );
  }
  if (resolvedEmail) {
    hostingQueries.push(
      supabase
        .from("hosting_records")
        .select("id,client_name,provider,monthly_price,yearly_price,domains_count,active,created_at")
        .ilike("customer_email", resolvedEmail)
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: HostingBrief[] | null }>,
    );
  }
  if (leadNames.length) {
    hostingQueries.push(
      supabase
        .from("hosting_records")
        .select("id,client_name,provider,monthly_price,yearly_price,domains_count,active,created_at")
        .in("client_name", leadNames)
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: HostingBrief[] | null }>,
    );
  }
  const hostingResults = await Promise.all(hostingQueries);
  const seenHosting = new Map<string, HostingBrief>();
  hostingResults.forEach((res) => {
    (res.data || []).forEach((h) => {
      if (!seenHosting.has(h.id)) seenHosting.set(h.id, h);
    });
  });
  const hosting = Array.from(seenHosting.values());

  const commQueries: Promise<{ data: CommissionBrief[] | null }>[] = [];
  if (customerId) {
    commQueries.push(
      supabase
        .from("commissions")
        .select("id,title,amount,payment_status,date,source_type,source_id,customer_id")
        .eq("customer_id", customerId)
        .order("date", { ascending: false })
        .limit(20) as unknown as Promise<{ data: CommissionBrief[] | null }>,
    );
  }
  if (resolvedEmail) {
    commQueries.push(
      supabase
        .from("commissions")
        .select("id,title,amount,payment_status,date,source_type,source_id,customer_id")
        .ilike("customer_email", resolvedEmail)
        .order("date", { ascending: false })
        .limit(20) as unknown as Promise<{ data: CommissionBrief[] | null }>,
    );
  }
  const commResults = await Promise.all(commQueries);
  const seenComm = new Map<string, CommissionBrief>();
  commResults.forEach((res) => {
    (res.data || []).forEach((c) => {
      if (!seenComm.has(c.id)) seenComm.set(c.id, c);
    });
  });
  const commissions = Array.from(seenComm.values());

  const { data: wheelData } = resolvedEmail
    ? await supabase
        .from("wheel_spins")
        .select("id,email,prize_label,prize_value,redeemed,created_at")
        .ilike("email", resolvedEmail)
        .order("created_at", { ascending: false })
    : { data: [] };
  const wheels = (wheelData || []) as Wheel[];

  const seenDesigns = new Map<string, Design>();
  const { data: designsByEmail } = resolvedEmail
    ? await supabase
        .from("design_proposals")
        .select("id,client_name,email,design_url,sent_date,status")
        .ilike("email", resolvedEmail)
        .order("sent_date", { ascending: false })
    : { data: [] };
  (designsByEmail || []).forEach((d) => {
    seenDesigns.set(d.id, { ...d, matchedBy: "email" });
  });
  if (leadNames.length) {
    const { data: designsByName } = await supabase
      .from("design_proposals")
      .select("id,client_name,email,design_url,sent_date,status")
      .in("client_name", leadNames)
      .order("sent_date", { ascending: false });
    (designsByName || []).forEach((d) => {
      if (!seenDesigns.has(d.id)) seenDesigns.set(d.id, { ...d, matchedBy: "client_name" });
    });
  }
  const designs = Array.from(seenDesigns.values());

  const seenLogs = new Map<string, LeadLog>();
  const logQueries: Promise<{ data: LeadLog[] | null }>[] = [];
  if (leadIds.length) {
    logQueries.push(
      supabase
        .from("lead_logs")
        .select(
          "id,lead_id,lead_name,lead_email,action,field,old_value,new_value,changed_by_email,created_at",
        )
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(25) as unknown as Promise<{ data: LeadLog[] | null }>,
    );
  }
  logQueries.push(
    resolvedEmail
      ? (supabase
          .from("lead_logs")
          .select(
            "id,lead_id,lead_name,lead_email,action,field,old_value,new_value,changed_by_email,created_at",
          )
          .ilike("lead_email", resolvedEmail)
          .order("created_at", { ascending: false })
          .limit(25) as unknown as Promise<{ data: LeadLog[] | null }>)
      : Promise.resolve({ data: [] }),
  );
  const logResults = await Promise.all(logQueries);
  logResults.forEach((res) => {
    (res.data || []).forEach((row) => {
      if (!seenLogs.has(row.id)) seenLogs.set(row.id, row);
    });
  });
  const logs = Array.from(seenLogs.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);

  const seenCommEvents = new Map<string, CommunicationEventRow>();
  let commLoadError: string | null = null;
  const commSelect =
    "id,customer_id,customer_email,sender_email,recipient_email,kind,title,body_preview,metadata,source_table,source_id,message_id,in_reply_to,thread_id,occurred_at,created_at" as const;
  const commEventQueries = [];
  if (customerId) {
    commEventQueries.push(
      supabase
        .from("communication_events")
        .select(commSelect)
        .eq("customer_id", customerId)
        .order("occurred_at", { ascending: false })
        .limit(50),
    );
  }
  if (resolvedEmail) {
    commEventQueries.push(
      supabase
        .from("communication_events")
        .select(commSelect)
        .or(`customer_email.ilike.${resolvedEmail},sender_email.ilike.${resolvedEmail}`)
        .order("occurred_at", { ascending: false })
        .limit(50),
    );
  }
  if (commEventQueries.length === 0) {
    // no comm events
  } else {
    const commEventResults = await Promise.all(commEventQueries);
    commEventResults.forEach((res) => {
      if (res.error && !commLoadError) commLoadError = res.error.message;
      (res.data || []).forEach((row) => {
        if (!seenCommEvents.has(row.id)) seenCommEvents.set(row.id, row as CommunicationEventRow);
      });
    });
  }
  const commEvents = Array.from(seenCommEvents.values());

  return {
    canonicalCustomer,
    viewMode,
    leads: leadRows,
    tasks,
    rentals,
    signatures,
    notes,
    hosting,
    wheels,
    designs,
    logs,
    commEvents,
    commissions,
    commLoadError,
  };
}
