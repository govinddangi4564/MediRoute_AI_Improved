import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const severityColor: Record<string, string> = {
  low: 'text-success bg-green-50 border-green-200',
  moderate: 'text-warning bg-amber-50 border-amber-200',
  high: 'text-danger bg-red-50 border-red-200',
  critical: 'text-white bg-danger border-danger'
};
