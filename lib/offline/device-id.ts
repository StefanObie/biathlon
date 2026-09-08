import { ulid } from "ulid";

const STORAGE_KEY = "biathlon-device-id";

/**
 * Stable per-browser identifier for capture rows (device_id column). Not a
 * user identity — just distinguishes which phone/tablet made a capture.
 */
export function getDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const generated = ulid();
  localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
