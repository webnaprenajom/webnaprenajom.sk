/** Workflow entity rows fed into buildReconciliation (read-side only). */

export type ProjectReconRow = {
  id: string;
  title: string;
  client_name: string | null;
  customer_email: string | null;
  agreed_fee?: number | null;
  status: string;
};

export type MarketingReconRow = {
  id: string;
  title: string;
  client_name: string | null;
  customer_email: string | null;
  agreed_fee?: number | null;
  status: string;
};

export type TaskReconRow = {
  id: string;
  title: string;
  client_name: string | null;
  customer_email?: string | null;
  amount: number;
  deposit: number;
  status: string;
};

export type HostingReconRow = {
  id: string;
  client_name: string | null;
  customer_email: string | null;
  provider: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  note: string | null;
  active: boolean;
  rental_website_id?: string | null;
  commissionable?: boolean;
};
