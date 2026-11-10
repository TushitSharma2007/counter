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
export { GST_SLABS_BP, ItemInput, ModifierGroupInput } from './contracts/menu.ts';
export {
  fetchItemOverrides,
  fetchItemVariants,
  fetchMenu,
  fetchOutletOverrides,
  saveCategory,
  saveItem,
  saveModifierGroup,
  setOutletOverride,
  type FoodType,
  type Menu,
  type MenuCategory,
  type MenuItem,
  type MenuModifier,
  type MenuModifierGroup,
  type MenuVariant,
  type OutletOverride,
} from './menu.ts';
