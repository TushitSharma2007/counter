// This browser's identity as a counter device, plus the cached roster for offline PIN switching.
import { DeviceCredentials, Roster } from '@repo/db';
import type { z } from 'zod';

const DEVICE_KEY = 'counter.device';
const ROSTER_KEY = 'counter.roster';

function read<T>(key: string, schema: z.ZodType<T>): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadDevice(): DeviceCredentials | undefined {
  return read(DEVICE_KEY, DeviceCredentials);
}

export function saveDevice(device: DeviceCredentials): void {
  write(DEVICE_KEY, device);
  localStorage.removeItem(ROSTER_KEY);
}

export function forgetDevice(): void {
  localStorage.removeItem(DEVICE_KEY);
  localStorage.removeItem(ROSTER_KEY);
}

export function loadCachedRoster(): Roster | undefined {
  return read(ROSTER_KEY, Roster);
}

export function cacheRoster(roster: Roster): void {
  write(ROSTER_KEY, roster);
}
