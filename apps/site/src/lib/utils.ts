import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes do Tailwind sem conflito (usado pelos componentes do shadcn e do React Bits). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
