import type { CustomerWorkbenchData } from "./types";
import { loadCustomerHubAggregate } from "./loadCustomerHubAggregate";

export interface LoadCustomerWorkbenchInput {
  routeMode: "id" | "email";
  routeValue: string;
}

/** Backward-compatible wrapper — returns workbench data from unified aggregate loader. */
export async function loadCustomerWorkbench(
  input: LoadCustomerWorkbenchInput,
): Promise<CustomerWorkbenchData> {
  const aggregate = await loadCustomerHubAggregate(input);
  return aggregate.workbench;
}
