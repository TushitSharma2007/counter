import { brand } from '@repo/config/brand';
import { Avatar, cx, Icon, SyncIndicator } from '@repo/ui';
import { PauseCircle, Search, X, type LucideIcon } from 'lucide-react';
import type { RefObject } from 'react';

export interface TopBarProps {
  outletName: string;
  deviceCode: string;
  online: boolean;
  search: string;
  onSearch: (value: string) => void;
  onSearchEnter: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  heldCount: number;
  onOpenHeld: () => void;
  staff: { id: string; name: string; role: string };
  /** Lock on a shared tablet; Outlets on an owner's own phone. */
  endAction: { label: string; icon: LucideIcon; onClick: () => void };
}

/** The dark bar across the top of every POS screen: where am I, find an item, who is signed in. */
export function TopBar({
  outletName,
  deviceCode,
  online,
  search,
  onSearch,
  onSearchEnter,
  searchRef,
  heldCount,
  onOpenHeld,
  staff,
  endAction,
}: TopBarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 bg-ink px-3 py-2 text-canvas md:h-16 md:flex-nowrap md:py-0">
      <div className="flex min-w-0 items-baseline gap-2 pr-1">
        <span className="font-display text-lg font-semibold">{brand.pos.name}</span>
        <span className="truncate text-sm text-canvas/70">
          {outletName} · {deviceCode}
        </span>
      </div>

      <label className="order-last flex h-11 w-full items-center gap-2 rounded-md bg-canvas/10 px-3 focus-within:bg-canvas/15 md:order-none md:ml-4 md:max-w-md md:flex-1">
        <Icon icon={Search} size={18} className="shrink-0 text-canvas/70" />
        <span className="sr-only">Search items by name or code</span>
        <input
          ref={searchRef}
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearchEnter();
            if (event.key === 'Escape') onSearch('');
          }}
          placeholder="Search item or code"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-canvas outline-none placeholder:text-canvas/50"
          autoComplete="off"
          spellCheck={false}
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onSearch('');
            }}
            className="-mr-1 grid size-8 place-items-center rounded-sm text-canvas/70"
          >
            <Icon icon={X} size={16} />
          </button>
        ) : (
          <kbd className="hidden rounded-sm border border-canvas/25 px-1.5 text-xs text-canvas/60 lg:inline">
            /
          </kbd>
        )}
      </label>

      <div className="ml-auto flex items-center gap-1.5">
        <SyncIndicator
          state={online ? 'live' : 'offline'}
          className={cx('hidden sm:inline-flex', online && '!text-canvas/80')}
        />
        <button
          type="button"
          onClick={onOpenHeld}
          className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-canvas/90 active:bg-canvas/10"
        >
          <Icon icon={PauseCircle} size={18} />
          <span className="hidden sm:inline">Held</span>
          {heldCount > 0 ? (
            <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-canvas px-1 text-xs font-semibold text-ink">
              {heldCount}
            </span>
          ) : null}
        </button>
        <div className="flex items-center gap-2 border-l border-canvas/15 pl-3">
          <Avatar name={staff.name} id={staff.id} size={32} />
          <div className="hidden leading-tight lg:block">
            <p className="text-sm font-medium">{staff.name}</p>
            <p className="text-xs text-canvas/60 capitalize">{staff.role}</p>
          </div>
          <button
            type="button"
            onClick={endAction.onClick}
            className="ml-1 flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium active:bg-canvas/10"
          >
            <Icon icon={endAction.icon} size={18} />
            {endAction.label}
          </button>
        </div>
      </div>
    </header>
  );
}
