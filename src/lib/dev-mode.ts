const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
const DEV_USER_ID = 'dev-user-id';
const STORAGE_PREFIX = 'intake-dev-';

export function isDevMode(): boolean {
  return DEV_MODE;
}

export function getDevUserId(): string {
  return DEV_USER_ID;
}

export function getDevSession() {
  if (!DEV_MODE) return null;
  return { user: { id: DEV_USER_ID } };
}

export function getDevStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}
