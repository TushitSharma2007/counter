// Supabase client, typed repositories and the offline outbox. The only package that imports @supabase/*.
export { createDb, type Db } from './client.ts';
export { PinLoginRequest, PinLoginResponse, type PinLoginFailure } from './contracts/auth-pin.ts';
export { readDbConfig, type DbConfig } from './env.ts';
export { checkHealth } from './health.ts';
export {
  checkPinOffline,
  DeviceCredentials,
  DeviceNotRegisteredError,
  ensurePersonalDevice,
  fetchRoster,
  getMe,
  listManagedOutlets,
  pinLogin,
  PersonalDevice,
  PIN_ROLES,
  registerDevice,
  Roster,
  signInWithPassword,
  signOut,
  type ManagedOutlet,
  type Me,
  type PinLoginResult,
  type RosterMember,
} from './staff-auth.ts';
