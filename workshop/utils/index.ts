import { createHash } from 'node:crypto';

export function createEventId(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function toIsoTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
