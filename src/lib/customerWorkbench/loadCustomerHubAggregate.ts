import { hasAnyCredentials } from "@/lib/projectCredentials";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CommunicationEventRow } from "@/lib/communication/types";
import type { LoadCustomerWorkbenchInput } from "./loadCustomerWorkbench";
import { resolveCustomerIdentity } from "./resolveCustomerIdentity";
import { fetchSection, mergeSectionErrors } from "./sectionFetch";
import type {
  CommissionBrief,
  CostRecord,
  CustomerHubAggregate,
  CustomerHubSections,
  CustomerWorkbenchData,
  Design,
  HostingBrief,
  Lead,
  LeadLog,
  PaymentRecord,
  PayoutRecord,
  ProjectNote,
  Rental,
  RentalPaymentBrief,
  Signature,
  Task,
  Wheel,
} from "./types";

const taskSelect =
  "id,title,status,amount,deposit,due_date,updated_at,client_name,lead_id,customer_id" as const;

const linkRank = (matchedBy: Task["matchedBy"]) =>
  matchedBy === "customer_id" ? 0 : matchedBy === "lead_id" ? 1 : 2;

function mergeTasks(
  taskResults: { data: Task[] | null; error: { message: string } | null }[],
  leadIds: string[],
): { tasks: Task[]; error: string | null } {
  const seenTasks = new Map<string, Task>();
  const errors: string[] = [];

  taskResults.forEach((res, i) => {
    if (res.error) errors.push(`tasks query ${i + 1}: ${res.error.message}`);
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

  return { tasks, error: errors.length ? errors.join("; ") : null };
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  rows.forEach((r) => {
    if (!seen.has(r.id)) seen.set(r.id, r);
  });
  return Array.from(seen.values());
}

function workbenchFromSections(
  identity: Awaited<ReturnType<typeof resolveCustomerIdentity>>,
  sections: CustomerHubSections,
): CustomerWorkbenchData {
  return {
    canonicalCustomer: identity.canonicalCustomer,
    viewMode: identity.viewMode,
    leads: sections.leads.data,
    tasks: sections.tasks.data,
    rentals: sections.rentals.data,
    signatures: sections.signatures.data,
    notes: sections.notes.data,
    hosting: sections.hosting.data,
    wheels: sections.wheels.data,
    designs: sections.designs.data,
    logs: sections.leadLogs.data,
    commEvents: sections.communication.data,
    commissions: sections.commissions.data,
    commLoadError: sections.communication.error,
    paymentRecords: sections.payments.data,
    costRecords: sections.costs.data,
    payoutRecords: sections.payouts.data,
    rentalPayments: sections.rentalPayments.data,
  };
}

export async function loadCustomerHubAggregate(
  input: LoadCustomerWorkbenchInput,
): Promise<CustomerHubAggregate> {
  const identity = await resolveCustomerIdentity(input);
  const { customerId, resolvedEmail, leadFilter } = identity;

  const leadsSection = await fetchSection(
    "leads",
    () =>
      leadFilter
        ? supabase
            .from("leads")
            .select("id,name,email,phone,status,source,assigned_to,temperature,created_at")
            .or(leadFilter)
            .order("created_at", { ascending: false })
        : resolvedEmail
          ? supabase
              .from("leads")
              .select("id,name,email,phone,status,source,assigned_to,temperature,created_at")
              .ilike("email", resolvedEmail)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as Lead[], error: null }),
    [] as Lead[],
  );

  const leadRows = leadsSection.data;
  const leadIds = leadRows.map((l) => l.id);
  const leadNames = Array.from(new Set(leadRows.map((l) => (l.name || "").trim()).filter(Boolean)));

  const taskQueries: Promise<{ data: Task[] | null; error: { message: string } | null }>[] = [];
  if (customerId) {
    taskQueries.push(
      supabase.from("tasks").select(taskSelect).eq("customer_id", customerId) as unknown as Promise<{
        data: Task[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (leadIds.length) {
    taskQueries.push(
      supabase.from("tasks").select(taskSelect).in("lead_id", leadIds) as unknown as Promise<{
        data: Task[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (leadNames.length) {
    taskQueries.push(
      supabase.from("tasks").select(taskSelect).in("client_name", leadNames) as unknown as Promise<{
        data: Task[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  const taskResults = taskQueries.length ? await Promise.all(taskQueries) : [];
  const { tasks, error: tasksError } = mergeTasks(taskResults, leadIds);
  const tasksSection = { data: tasks, error: tasksError, loaded: true };

  const rentalQueries: Promise<{ data: Rental[] | null; error: { message: string } | null }>[] = [];
  if (customerId) {
    rentalQueries.push(
      supabase
        .from("rental_websites")
        .select("id,name,url,monthly_price,implementers,client_name,created_at")
        .eq("customer_id", customerId) as unknown as Promise<{
        data: Rental[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (leadNames.length) {
    rentalQueries.push(
      supabase
        .from("rental_websites")
        .select("id,name,url,monthly_price,implementers,client_name,created_at")
        .in("client_name", leadNames) as unknown as Promise<{
        data: Rental[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (resolvedEmail) {
    rentalQueries.push(
      supabase
        .from("rental_websites")
        .select("id,name,url,monthly_price,implementers,client_name,created_at")
        .ilike("customer_email", resolvedEmail) as unknown as Promise<{
        data: Rental[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  let rentals: Rental[] = [];
  let rentalsError: string | null = null;
  if (rentalQueries.length) {
    const rentalResults = await Promise.all(rentalQueries);
    const rentalErrors: string[] = [];
    rentalResults.forEach((res, i) => {
      if (res.error) rentalErrors.push(`rentals query ${i + 1}: ${res.error.message}`);
    });
    rentals = dedupeById(rentalResults.flatMap((r) => r.data || []));
    rentalsError = rentalErrors.length ? rentalErrors.join("; ") : null;
  }
  const rentalsSection = { data: rentals, error: rentalsError, loaded: true };

  const signaturesSection = await fetchSection(
    "signatures",
    () =>
      resolvedEmail
        ? supabase
            .from("order_signatures")
            .select(
              "id,client_name,email,plan,package_name,price,contract_months,status,signed_at,created_at",
            )
            .ilike("email", resolvedEmail)
            .order("signed_at", { ascending: false })
        : Promise.resolve({ data: [] as Signature[], error: null }),
    [] as Signature[],
  );

  const noteQueries: Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>[] =
    [];
  if (customerId) {
    noteQueries.push(
      supabase
        .from("project_notes")
        .select("id,title,client_name,url,status,username,password,access_credentials,updated_at")
        .eq("customer_id", customerId) as unknown as Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (resolvedEmail) {
    noteQueries.push(
      supabase
        .from("project_notes")
        .select("id,title,client_name,url,status,username,password,access_credentials,updated_at")
        .ilike("customer_email", resolvedEmail) as unknown as Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (leadNames.length) {
    noteQueries.push(
      supabase
        .from("project_notes")
        .select("id,title,client_name,url,status,username,password,access_credentials,updated_at")
        .in("client_name", leadNames) as unknown as Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>,
    );
  }
  let notes: ProjectNote[] = [];
  let notesError: string | null = null;
  if (noteQueries.length) {
    const noteResults = await Promise.all(noteQueries);
    const noteErrors: string[] = [];
    const seenNotes = new Map<string, ProjectNote>();
    noteResults.forEach((res, i) => {
      if (res.error) noteErrors.push(`notes query ${i + 1}: ${res.error.message}`);
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
              access_credentials: n.access_credentials as Json,
            }),
            updated_at: n.updated_at as string | undefined,
          });
        }
      });
    });
    notes = Array.from(seenNotes.values());
    notesError = noteErrors.length ? noteErrors.join("; ") : null;
  }
  const notesSection = { data: notes, error: notesError, loaded: true };

  const hostingQueries: Promise<{ data: HostingBrief[] | null; error: { message: string } | null }>[] = [];
  if (customerId) {
    hostingQueries.push(
      supabase
        .from("hosting_records")
        .select("id,client_name,provider,monthly_price,yearly_price,domains_count,active,created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }) as unknown as Promise<{
        data: HostingBrief[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (resolvedEmail) {
    hostingQueries.push(
      supabase
        .from("hosting_records")
        .select("id,client_name,provider,monthly_price,yearly_price,domains_count,active,created_at")
        .ilike("customer_email", resolvedEmail)
        .order("created_at", { ascending: false }) as unknown as Promise<{
        data: HostingBrief[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (leadNames.length) {
    hostingQueries.push(
      supabase
        .from("hosting_records")
        .select("id,client_name,provider,monthly_price,yearly_price,domains_count,active,created_at")
        .in("client_name", leadNames)
        .order("created_at", { ascending: false }) as unknown as Promise<{
        data: HostingBrief[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  let hosting: HostingBrief[] = [];
  let hostingError: string | null = null;
  if (hostingQueries.length) {
    const hostingResults = await Promise.all(hostingQueries);
    const hostingErrors: string[] = [];
    hostingResults.forEach((res, i) => {
      if (res.error) hostingErrors.push(`hosting query ${i + 1}: ${res.error.message}`);
    });
    hosting = dedupeById(hostingResults.flatMap((r) => r.data || []));
    hostingError = hostingErrors.length ? hostingErrors.join("; ") : null;
  }
  const hostingSection = { data: hosting, error: hostingError, loaded: true };

  const commQueries: Promise<{ data: CommissionBrief[] | null; error: { message: string } | null }>[] = [];
  if (customerId) {
    commQueries.push(
      supabase
        .from("commissions")
        .select("id,title,amount,payment_status,date,source_type,source_id,customer_id")
        .eq("customer_id", customerId)
        .order("date", { ascending: false })
        .limit(20) as unknown as Promise<{ data: CommissionBrief[] | null; error: { message: string } | null }>,
    );
  }
  if (resolvedEmail) {
    commQueries.push(
      supabase
        .from("commissions")
        .select("id,title,amount,payment_status,date,source_type,source_id,customer_id")
        .ilike("customer_email", resolvedEmail)
        .order("date", { ascending: false })
        .limit(20) as unknown as Promise<{ data: CommissionBrief[] | null; error: { message: string } | null }>,
    );
  }
  let commissions: CommissionBrief[] = [];
  let commissionsError: string | null = null;
  if (commQueries.length) {
    const commResults = await Promise.all(commQueries);
    const commErrors: string[] = [];
    commResults.forEach((res, i) => {
      if (res.error) commErrors.push(`commissions query ${i + 1}: ${res.error.message}`);
    });
    commissions = dedupeById(commResults.flatMap((r) => r.data || []));
    commissionsError = commErrors.length ? commErrors.join("; ") : null;
  }
  const commissionsSection = { data: commissions, error: commissionsError, loaded: true };

  const rentalIds = rentals.map((r) => r.id);
  const commissionIds = commissions.map((c) => c.id);

  const paymentSelect =
    "id,source_table,source_id,customer_email,client_name,rental_website_id,amount,currency,paid_at,method,reference,note,truth_level" as const;
  const paymentQueries: Promise<{ data: PaymentRecord[] | null; error: { message: string } | null }>[] = [];
  if (rentalIds.length) {
    paymentQueries.push(
      supabase.from("payment_records").select(paymentSelect).in("rental_website_id", rentalIds),
    );
  }
  if (resolvedEmail) {
    paymentQueries.push(
      supabase.from("payment_records").select(paymentSelect).ilike("customer_email", resolvedEmail),
    );
  }
  if (leadNames.length) {
    paymentQueries.push(
      supabase.from("payment_records").select(paymentSelect).in("client_name", leadNames),
    );
  }
  let paymentRecords: PaymentRecord[] = [];
  let paymentsError: string | null = null;
  if (paymentQueries.length) {
    const paymentResults = await Promise.all(paymentQueries);
    const paymentErrors: string[] = [];
    paymentResults.forEach((res, i) => {
      if (res.error) paymentErrors.push(`payments query ${i + 1}: ${res.error.message}`);
    });
    paymentRecords = dedupeById(paymentResults.flatMap((r) => r.data || [])).sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
    );
    paymentsError = paymentErrors.length ? paymentErrors.join("; ") : null;
  }
  const paymentsSection = { data: paymentRecords, error: paymentsError, loaded: true };

  const costSelect =
    "id,source_table,source_id,category,vendor,client_name,rental_website_id,amount,currency,paid_at,incurred_at,reference,note,truth_level" as const;
  const costQueries: Promise<{ data: CostRecord[] | null; error: { message: string } | null }>[] = [];
  if (rentalIds.length) {
    costQueries.push(
      supabase.from("cost_records").select(costSelect).in("rental_website_id", rentalIds),
    );
  }
  if (leadNames.length) {
    costQueries.push(supabase.from("cost_records").select(costSelect).in("client_name", leadNames));
  }
  let costRecords: CostRecord[] = [];
  let costsError: string | null = null;
  if (costQueries.length) {
    const costResults = await Promise.all(costQueries);
    const costErrors: string[] = [];
    costResults.forEach((res, i) => {
      if (res.error) costErrors.push(`costs query ${i + 1}: ${res.error.message}`);
    });
    costRecords = dedupeById(costResults.flatMap((r) => r.data || [])).sort((a, b) => {
      const ad = new Date(a.paid_at || a.incurred_at || a.id).getTime();
      const bd = new Date(b.paid_at || b.incurred_at || b.id).getTime();
      return bd - ad;
    });
    costsError = costErrors.length ? costErrors.join("; ") : null;
  }
  const costsSection = { data: costRecords, error: costsError, loaded: true };

  const rentalPaymentsSection = await fetchSection(
    "rentalPayments",
    () =>
      rentalIds.length
        ? supabase
            .from("rental_payments")
            .select("id,website_id,month,year,amount,custom_price,paid,status,paid_at")
            .in("website_id", rentalIds)
        : Promise.resolve({ data: [] as RentalPaymentBrief[], error: null }),
    [] as RentalPaymentBrief[],
  );

  const payoutsSection = await fetchSection(
    "payouts",
    () =>
      commissionIds.length
        ? supabase
            .from("payout_records")
            .select(
              "id,source_table,source_id,implementer,amount,currency,paid_at,reference,note,truth_level",
            )
            .eq("source_table", "commissions")
            .in("source_id", commissionIds.map(String))
        : Promise.resolve({ data: [] as PayoutRecord[], error: null }),
    [] as PayoutRecord[],
  );

  const wheelsSection = await fetchSection(
    "wheels",
    () =>
      resolvedEmail
        ? supabase
            .from("wheel_spins")
            .select("id,email,prize_label,prize_value,redeemed,created_at")
            .ilike("email", resolvedEmail)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Wheel[], error: null }),
    [] as Wheel[],
  );

  const designsByEmailSection = await fetchSection(
    "designs",
    () =>
      resolvedEmail
        ? supabase
            .from("design_proposals")
            .select("id,client_name,email,design_url,sent_date,status")
            .ilike("email", resolvedEmail)
            .order("sent_date", { ascending: false })
        : Promise.resolve({ data: [] as Design[], error: null }),
    [] as Design[],
  );
  const seenDesigns = new Map<string, Design>();
  designsByEmailSection.data.forEach((d) => {
    seenDesigns.set(d.id, { ...d, matchedBy: "email" });
  });
  let designsError = designsByEmailSection.error;
  if (leadNames.length) {
    const designsByNameSection = await fetchSection(
      "designs",
      () =>
        supabase
          .from("design_proposals")
          .select("id,client_name,email,design_url,sent_date,status")
          .in("client_name", leadNames)
          .order("sent_date", { ascending: false }),
      [] as Design[],
    );
    designsError = mergeSectionErrors(designsError, designsByNameSection.error);
    designsByNameSection.data.forEach((d) => {
      if (!seenDesigns.has(d.id)) seenDesigns.set(d.id, { ...d, matchedBy: "client_name" });
    });
  }
  const designsSection = {
    data: Array.from(seenDesigns.values()),
    error: designsError,
    loaded: true,
  };

  const logQueries: Promise<{ data: LeadLog[] | null; error: { message: string } | null }>[] = [];
  if (leadIds.length) {
    logQueries.push(
      supabase
        .from("lead_logs")
        .select(
          "id,lead_id,lead_name,lead_email,action,field,old_value,new_value,changed_by_email,created_at",
        )
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(25) as unknown as Promise<{ data: LeadLog[] | null; error: { message: string } | null }>,
    );
  }
  if (resolvedEmail) {
    logQueries.push(
      supabase
        .from("lead_logs")
        .select(
          "id,lead_id,lead_name,lead_email,action,field,old_value,new_value,changed_by_email,created_at",
        )
        .ilike("lead_email", resolvedEmail)
        .order("created_at", { ascending: false })
        .limit(25) as unknown as Promise<{ data: LeadLog[] | null; error: { message: string } | null }>,
    );
  }
  let logs: LeadLog[] = [];
  let logsError: string | null = null;
  if (logQueries.length) {
    const logResults = await Promise.all(logQueries);
    const logErrors: string[] = [];
    const seenLogs = new Map<string, LeadLog>();
    logResults.forEach((res, i) => {
      if (res.error) logErrors.push(`leadLogs query ${i + 1}: ${res.error.message}`);
      (res.data || []).forEach((row) => {
        if (!seenLogs.has(row.id)) seenLogs.set(row.id, row);
      });
    });
    logs = Array.from(seenLogs.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);
    logsError = logErrors.length ? logErrors.join("; ") : null;
  }
  const leadLogsSection = { data: logs, error: logsError, loaded: true };

  const commSelect =
    "id,customer_id,customer_email,sender_email,recipient_email,kind,title,body_preview,metadata,source_table,source_id,message_id,in_reply_to,thread_id,occurred_at,created_at" as const;
  const commEventQueries: Promise<{
    data: CommunicationEventRow[] | null;
    error: { message: string } | null;
  }>[] = [];
  if (customerId) {
    commEventQueries.push(
      supabase
        .from("communication_events")
        .select(commSelect)
        .eq("customer_id", customerId)
        .order("occurred_at", { ascending: false })
        .limit(50) as unknown as Promise<{
        data: CommunicationEventRow[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  if (resolvedEmail) {
    commEventQueries.push(
      supabase
        .from("communication_events")
        .select(commSelect)
        .or(`customer_email.ilike.${resolvedEmail},sender_email.ilike.${resolvedEmail}`)
        .order("occurred_at", { ascending: false })
        .limit(50) as unknown as Promise<{
        data: CommunicationEventRow[] | null;
        error: { message: string } | null;
      }>,
    );
  }
  let commEvents: CommunicationEventRow[] = [];
  let commError: string | null = null;
  if (commEventQueries.length) {
    const commEventResults = await Promise.all(commEventQueries);
    const commErrors: string[] = [];
    const seenCommEvents = new Map<string, CommunicationEventRow>();
    commEventResults.forEach((res, i) => {
      if (res.error) commErrors.push(`communication query ${i + 1}: ${res.error.message}`);
      (res.data || []).forEach((row) => {
        if (!seenCommEvents.has(row.id)) seenCommEvents.set(row.id, row);
      });
    });
    commEvents = Array.from(seenCommEvents.values());
    commError = commErrors.length ? commErrors.join("; ") : null;
  }
  const communicationSection = { data: commEvents, error: commError, loaded: true };

  const sections: CustomerHubSections = {
    leads: leadsSection,
    tasks: tasksSection,
    rentals: rentalsSection,
    hosting: hostingSection,
    notes: notesSection,
    commissions: commissionsSection,
    payments: paymentsSection,
    costs: costsSection,
    payouts: payoutsSection,
    rentalPayments: rentalPaymentsSection,
    communication: communicationSection,
    signatures: signaturesSection,
    designs: designsSection,
    wheels: wheelsSection,
    leadLogs: leadLogsSection,
  };

  const workbench = workbenchFromSections(identity, sections);

  return { identity, sections, workbench };
}
