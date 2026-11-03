/** Modules an org can have switched on (`orgs.feature_flags`). Plans are built from these. */
export const MODULES = ['pos', 'kds', 'inventory', 'loyalty', 'multi_outlet'] as const;

export type Module = (typeof MODULES)[number];

/** A standalone loyalty merchant is an org with only `loyalty` on. */
export const LOYALTY_ONLY_MODULES: readonly Module[] = ['loyalty'];
