import { format } from "date-fns";
import type { Lead, LeadStatus, LeadTemperature } from "@/components/admin/leads/constants";

/** JSON-safe lead edit form snapshot for draft persistence. */
export interface LeadFormDraft {
  editNotes: string;
  editStatus: LeadStatus;
  editType: string;
  editSource: string;
  editName: string;
  editEmail: string;
  editPhone: string;
  editTemperature: LeadTemperature;
  editAssigned: string;
  editAmount: string;
  editConsultDate: string | null;
  editConsultTime: string;
  editFollowUpDate: string | null;
  editCreatedAt: string | null;
  editCustomerId: string | null;
}

export function leadToFormDraft(lead: Lead): LeadFormDraft {
  return {
    editNotes: lead.notes || "",
    editStatus: lead.status,
    editType: lead.type,
    editSource: lead.source || "",
    editName: lead.name || "",
    editEmail: lead.email || "",
    editPhone: lead.phone || "",
    editTemperature: lead.temperature ?? null,
    editAssigned: lead.assigned_to || "",
    editAmount: lead.amount != null ? String(lead.amount) : "",
    editConsultDate: lead.consultation_date ?? null,
    editConsultTime: lead.consultation_time || "",
    editFollowUpDate: lead.follow_up_date ?? null,
    editCreatedAt: lead.created_at ?? null,
    editCustomerId: lead.customer_id ?? null,
  };
}

export type LeadFormSetters = {
  setEditNotes: (v: string) => void;
  setEditStatus: (v: LeadStatus) => void;
  setEditType: (v: string) => void;
  setEditSource: (v: string) => void;
  setEditName: (v: string) => void;
  setEditEmail: (v: string) => void;
  setEditPhone: (v: string) => void;
  setEditTemperature: (v: LeadTemperature) => void;
  setEditAssigned: (v: string) => void;
  setEditAmount: (v: string) => void;
  setEditConsultDate: (v: Date | undefined) => void;
  setEditConsultTime: (v: string) => void;
  setEditFollowUpDate: (v: Date | undefined) => void;
  setEditCreatedAt: (v: Date | undefined) => void;
  setEditCustomerId: (v: string | null) => void;
};

export function applyLeadFormDraft(draft: LeadFormDraft, setters: LeadFormSetters): void {
  setters.setEditNotes(draft.editNotes);
  setters.setEditStatus(draft.editStatus);
  setters.setEditType(draft.editType);
  setters.setEditSource(draft.editSource);
  setters.setEditName(draft.editName);
  setters.setEditEmail(draft.editEmail);
  setters.setEditPhone(draft.editPhone);
  setters.setEditTemperature(draft.editTemperature);
  setters.setEditAssigned(draft.editAssigned);
  setters.setEditAmount(draft.editAmount);
  setters.setEditConsultDate(draft.editConsultDate ? new Date(draft.editConsultDate) : undefined);
  setters.setEditConsultTime(draft.editConsultTime);
  setters.setEditFollowUpDate(draft.editFollowUpDate ? new Date(draft.editFollowUpDate) : undefined);
  setters.setEditCreatedAt(draft.editCreatedAt ? new Date(draft.editCreatedAt) : undefined);
  setters.setEditCustomerId(draft.editCustomerId);
}

export function snapshotLeadFormState(args: LeadFormDraft & {
  editConsultDate?: Date | undefined;
  editFollowUpDate?: Date | undefined;
  editCreatedAt?: Date | undefined;
}): LeadFormDraft {
  return {
    editNotes: args.editNotes,
    editStatus: args.editStatus,
    editType: args.editType,
    editSource: args.editSource,
    editName: args.editName,
    editEmail: args.editEmail,
    editPhone: args.editPhone,
    editTemperature: args.editTemperature,
    editAssigned: args.editAssigned,
    editAmount: args.editAmount,
    editConsultDate: args.editConsultDate ? args.editConsultDate.toISOString() : null,
    editConsultTime: args.editConsultTime,
    editFollowUpDate: args.editFollowUpDate ? format(args.editFollowUpDate, "yyyy-MM-dd") : null,
    editCreatedAt: args.editCreatedAt ? args.editCreatedAt.toISOString() : null,
    editCustomerId: args.editCustomerId,
  };
}
