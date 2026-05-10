import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 0, style: "percent" }).format(value);
}

export function generateReferenceNumber(companyPrefix: string, sequence: number, date = new Date()) {
  return `INC-${date.getFullYear()}-${companyPrefix.toUpperCase()}-${String(sequence).padStart(5, "0")}`;
}
