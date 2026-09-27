import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEgyptPhoneNumber(val: string): string {
  if (!val) return "";
  let digits = val.replace(/[^0-9]/g, "");
  if (digits.startsWith("20")) {
    digits = digits.substring(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }
  if (!digits) return "";
  return `+20 ${digits}`;
}
