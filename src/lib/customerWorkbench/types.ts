import type { CustomerRow } from "@/lib/crmLookup/customers";
import type { CommunicationEventRow } from "@/lib/communication/types";
import type { ProfitDisplayContext } from "@/lib/profit/profitContext";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  source: string | null;
  assigned_to: string | null;
  temperature: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  status: string;
  amount: number | null;
  deposit: number | null;
  due_date: string | null;
  updated_at: string;
  client_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  matchedBy: "customer_id" | "lead_id" | "client_name";
};

export type Rental = {
  id: string;
  name: string;
  url: string | null;
  monthly_price: number;
  implementers: unknown;
  client_name: string | null;
  created_at?: string;
};

export type Signature = {
  id: string;
  client_name: string;
  email: string;
  plan: string;
  package_name: string | null;
  price: number;
  contract_months: number;
  status: string;
  signed_at: string;
  created_at: string;
};

export type ProjectNote = {
  id: string;
  title: string;
  client_name: string | null;
  url: string | null;
  status: string;
  has_credentials: boolean;
  updated_at?: string;
};

export type HostingBrief = {
  id: string;
  client_name: string | null;
  provider: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  domains_count: number | null;
  active: boolean;
  created_at: string;
};

export type CommissionBrief = {
  id: string;
  title: string;
  amount: number;
  payment_status: string;
  date: string;
  source_type?: string | null;
  source_id?: string | null;
};

export type Wheel = {
  id: string;
  email: string;
  prize_label: string;
  prize_value: number;
  redeemed: boolean;
  created_at: string;
};

export type Design = {
  id: string;
  client_name: string;
  email: string | null;
  design_url: string | null;
  sent_date: string;
  status: string;
  matchedBy: "email" | "client_name";
};

export type LeadLog = {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  created_at: string;
};

/** Confirmed/legacy payment fact (Golden Path: rental_websites -> payment_records). */
export type PaymentRecord = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  customer_email: string | null;
  client_name: string | null;
  rental_website_id: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  truth_level: string;
};

/** Confirmed/legacy cost (Golden Path: rental_websites -> cost_records). */
export type CostRecord = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  category: string | null;
  vendor: string | null;
  client_name: string | null;
  rental_website_id: string | null;
  amount: number;
  currency: string;
  paid_at: string | null;
  incurred_at: string | null;
  reference: string | null;
  note: string | null;
  truth_level: string;
};

/** Confirmed/legacy commission payout (linked via source_table='commissions'). */
export type PayoutRecord = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  implementer: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  reference: string | null;
  note: string | null;
  truth_level: string;
};

/** Raw per-month rental invoice/payment row (truth_level=workflow_only). */
export type RentalPaymentBrief = {
  id: string;
  website_id: string;
  month: number;
  year: number;
  amount: number;
  custom_price: number | null;
  paid: boolean;
  status: string;
  paid_at: string | null;
};

export type CustomerWorkbenchData = {
  canonicalCustomer: CustomerRow | null;
  viewMode: "id" | "email";
  leads: Lead[];
  tasks: Task[];
  rentals: Rental[];
  signatures: Signature[];
  notes: ProjectNote[];
  hosting: HostingBrief[];
  wheels: Wheel[];
  designs: Design[];
  logs: LeadLog[];
  commEvents: CommunicationEventRow[];
  commissions: CommissionBrief[];
  commLoadError: string | null;
  paymentRecords: PaymentRecord[];
  costRecords: CostRecord[];
  payoutRecords: PayoutRecord[];
  rentalPayments: RentalPaymentBrief[];
};

export type WorkbenchSummary = {
  displayName: string;
  emailKey: string;
  phone: string | null;
  lifecycle: { label: string; tone: string };
  lastCommunicationAt: string | null;
  activeProjectsCount: number;
  activeRentalsCount: number;
  hostingCount: number;
  openTasksCount: number;
  openTasksCustomerLinked: number;
  openTasksLegacyOnly: number;
  unpaidCommissionsCount: number;
  unpaidCommissionsTotal: number;
  unlinkedInboundCount: number;
  overdueTasksCount: number;
  hasAnyData: boolean;
};

/** Aggregated commission payout grouped by implementer (from payout_records). */
export type CommissionPayout = {
  implementer: string;
  total: number;
  count: number;
};

/**
 * Per-customer financial summary (Fáza 2). Reuses computeProfit/resolveProfitDisplayContext
 * (src/lib/profit) so "no revenue yet" / "cost without revenue" cases stay safe — never
 * implies profit when the revenue basis is unknown.
 *
 * Truth levels (CLAUDE.md): paymentsReceived* / costs* split fact vs legacy_import.
 * paymentsExpectedTotal = unpaid rental_payments rows (truth_level=workflow_only, sivá).
 */
export type CustomerFinanceSummary = {
  paymentsReceivedTotal: number;
  paymentsReceivedFactTotal: number;
  paymentsReceivedLegacyTotal: number;
  paymentsExpectedTotal: number;
  costsTotal: number;
  costsFactTotal: number;
  costsLegacyTotal: number;
  grossProfit: ProfitDisplayContext;
  paidCommissionsTotal: number;
  paidCommissionsByImplementer: CommissionPayout[];
  netProfit: number | null;
  netProfitCanShow: boolean;
};

export type WorkbenchTabId =
  | "prehlad"
  | "komunikacia"
  | "projekty"
  | "prenajmy"
  | "hosting"
  | "financie"
  | "ulohy"
  | "historia";

export type RecommendedAction = {
  id: string;
  label: string;
  detail?: string;
  tab?: WorkbenchTabId;
  href?: string;
  tone?: "default" | "warning";
};

export type CustomerWorkbenchContext = {
  resolvedCustomerId: string | null;
  emailKey: string;
  displayName: string;
  clientName: string;
  primaryLeadId: string | null;
  onReload: () => void;
};
