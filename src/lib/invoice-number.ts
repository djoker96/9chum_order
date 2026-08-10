function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatInvoiceNumberDate(date: Date): string {
  return `${pad(date.getUTCDate())}${pad(date.getUTCMonth() + 1)}${date.getUTCFullYear()}`
}

export function formatInvoiceNumber(date: Date, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error("Invoice sequence must be between 1 and 9999")
  }

  return `HD-${formatInvoiceNumberDate(date)}-${String(sequence).padStart(4, "0")}`
}
