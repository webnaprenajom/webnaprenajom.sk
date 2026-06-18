/**
 * Central CRM row scoping for administrators (Batch 4b).
 * Extends filterCommissionsForUser pattern — lib only, no page queries yet.
 */

import type { Database } from "@/integrations/supabase/types";
import type { AccessContext } from "@/lib/rbac/permissions";

function isOwner(role: AccessContext["role"]): boolean {
  return role === "owner";
}

function isAdministrator(role: AccessContext["role"]): boolean {
  return role === "administrator";
}

export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type RentalWebsite = Database["public"]["Tables"]["rental_websites"]["Row"];
export type HostingRecord = Database["public"]["Tables"]["hosting_records"]["Row"];
export type ProjectNote = Database["public"]["Tables"]["project_notes"]["Row"];
export type MarketingRecord = Database["public"]["Tables"]["marketing_records"]["Row"];
export type DesignProposal = Database["public"]["Tables"]["design_proposals"]["Row"];

/** Ownership signals extracted from a CRM row. */
export interface OwnerFields {
  implementerName?: string | null;
  /** Multiple implementers (e.g. rental_websites.implementers JSON). */
  implementerNames?: string[] | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  customerEmail?: string | null;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseRentalImplementerNames(implementers: unknown): string[] {
  if (!Array.isArray(implementers)) return [];
  return implementers
    .map((entry) => {
      if (entry && typeof entry === "object" && "name" in entry) {
        return String((entry as { name?: unknown }).name ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

/** Whether a single row is visible to the current access context. */
export function rowVisibleToUser(fields: OwnerFields, ctx: AccessContext): boolean {
  if (isOwner(ctx.role)) return true;
  if (!isAdministrator(ctx.role)) return false;

  const implLower = norm(ctx.implementerName);
  if (implLower) {
    if (norm(fields.implementerName) === implLower) return true;
    if (fields.implementerNames?.some((name) => norm(name) === implLower)) return true;
  }

  if (ctx.userId) {
    if (fields.assignedTo && fields.assignedTo === ctx.userId) return true;
    if (fields.createdBy && fields.createdBy === ctx.userId) return true;
  }

  if (implLower && norm(fields.assignedTo) === implLower) return true;

  return false;
}

/**
 * Generic administrator scoping — owner sees all rows; administrator sees owned rows only.
 */
export function filterForUser<T>(
  rows: T[],
  ctx: AccessContext,
  getOwnerFields: (row: T) => OwnerFields,
): T[] {
  if (isOwner(ctx.role)) return rows;
  if (!isAdministrator(ctx.role)) return [];
  return rows.filter((row) => rowVisibleToUser(getOwnerFields(row), ctx));
}

export function filterLeadsForUser(leads: Lead[], ctx: AccessContext): Lead[] {
  return filterForUser(leads, ctx, (lead) => ({
    assignedTo: lead.assigned_to,
  }));
}

export function filterTasksForUser(tasks: Task[], ctx: AccessContext): Task[] {
  return filterForUser(tasks, ctx, (task) => ({
    assignedTo: task.assignee,
  }));
}

export function filterRentalsForUser(rentals: RentalWebsite[], ctx: AccessContext): RentalWebsite[] {
  return filterForUser(rentals, ctx, (rental) => ({
    implementerNames: parseRentalImplementerNames(rental.implementers),
  }));
}

export function filterHostingForUser(records: HostingRecord[], ctx: AccessContext): HostingRecord[] {
  return filterForUser(records, ctx, (record) => ({
    implementerName: record.acquired_by,
  }));
}

export function filterProjectsForUser(notes: ProjectNote[], ctx: AccessContext): ProjectNote[] {
  return filterForUser(notes, ctx, () => ({}));
}

export function filterMarketingForUser(records: MarketingRecord[], ctx: AccessContext): MarketingRecord[] {
  return filterForUser(records, ctx, () => ({}));
}

export function filterDesignsForUser(designs: DesignProposal[], ctx: AccessContext): DesignProposal[] {
  return filterForUser(designs, ctx, () => ({}));
}
