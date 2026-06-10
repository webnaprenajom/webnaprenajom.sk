export const PAYMENT_FORM_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "iban", label: "IBAN" },
  { value: "crypto", label: "Crypto" },
  { value: "faktura", label: "Faktúra" },
  { value: "ine", label: "Iné" },
] as const;

export type PaymentFormValue = (typeof PAYMENT_FORM_OPTIONS)[number]["value"];

export function paymentFormLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PAYMENT_FORM_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
