import type { Cart } from '@repo/pos-core';
import { cx, FoodMark, formatINR, Icon, PriceTag } from '@repo/ui';
import { Plus, SlidersHorizontal } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@repo/db';
import { useLongPress } from '../lib/long-press.ts';
import { fromPrice, hasOptions } from './menu-data.ts';

export const ALL = 'all';

function qtyInCart(cart: Cart, itemId: string): number {
  return cart.lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.qty, 0);
}

/** Vertical category list (tablet landscape and PC). */
export function CategoryRail({
  value,
  onChange,
  categories,
  items,
}: {
  value: string;
  onChange: (id: string) => void;
  categories: MenuCategory[];
  items: MenuItem[];
}) {
  const count = (id: string) =>
    id === ALL ? items.length : items.filter((i) => i.categoryId === id).length;
  return (
    <nav
      aria-label="Categories"
      className="hidden w-48 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface py-2 lg:flex"
    >
      {[{ id: ALL, name: 'All items' }, ...categories].map((category) => {
        const active = category.id === value;
        return (
          <button
            key={category.id}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => {
              onChange(category.id);
            }}
            className={cx(
              'mx-2 flex h-12 shrink-0 items-center justify-between rounded-md px-3 text-left text-base font-medium',
              active ? 'bg-ink text-canvas' : 'text-ink active:bg-sunken',
            )}
          >
            <span className="truncate">{category.name}</span>
            <span className={cx('num text-sm', active ? 'text-canvas/70' : 'text-ink-2')}>
              {count(category.id)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Horizontal category chips (phone and tablet portrait). */
export function CategoryChips({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (id: string) => void;
  categories: MenuCategory[];
}) {
  return (
    <nav
      aria-label="Categories"
      className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-surface px-3 py-2 [scrollbar-width:none] lg:hidden"
    >
      {[{ id: ALL, name: 'All' }, ...categories].map((category) => {
        const active = category.id === value;
        return (
          <button
            key={category.id}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => {
              onChange(category.id);
            }}
            className={cx(
              'h-10 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap',
              active ? 'border-ink bg-ink text-canvas' : 'border-line-strong bg-surface text-ink',
            )}
          >
            {category.name}
          </button>
        );
      })}
    </nav>
  );
}

interface ItemProps {
  item: MenuItem;
  qty: number;
  onAdd: (item: MenuItem) => void;
  onOptions: (item: MenuItem) => void;
}

function ItemTile({ item, qty, onAdd, onOptions }: ItemProps) {
  const press = useLongPress(
    () => {
      onAdd(item);
    },
    hasOptions(item)
      ? () => {
          onOptions(item);
        }
      : undefined,
  );
  return (
    <button
      type="button"
      {...press}
      disabled={!item.available}
      aria-label={`${item.name}, ${item.available ? formatINR(fromPrice(item)) : 'sold out'}${qty ? `, ${qty} in bill` : ''}`}
      className={cx(
        'relative flex h-[96px] flex-col justify-between rounded-md border bg-surface p-3 text-left select-none',
        'transition-[transform,border-color] duration-100 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:bg-sunken disabled:opacity-60 disabled:active:scale-100',
        qty > 0 ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="flex items-start gap-2">
        <FoodMark type={item.food} size={13} className="mt-1" />
        <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{item.name}</span>
      </span>
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-2">
          {item.code}
          {item.variants.length > 0 ? (
            <span className="rounded-sm bg-sunken px-1 py-px text-[11px]">
              {item.variants.map((v) => v.name.charAt(0)).join(' · ')}
            </span>
          ) : null}
        </span>
        {item.available ? (
          <PriceTag paise={fromPrice(item)} className="text-[15px] font-medium" />
        ) : (
          <span className="text-sm font-semibold text-ink-2">Sold out</span>
        )}
      </span>
      {qty > 0 ? (
        <span className="num absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
          {qty}
        </span>
      ) : null}
    </button>
  );
}

function ItemRow({ item, qty, onAdd, onOptions }: ItemProps) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 pr-1 pl-3">
      <FoodMark type={item.food} size={13} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{item.name}</p>
        <p className="text-sm text-ink-2">
          {item.available ? (
            <PriceTag paise={fromPrice(item)} size="sm" className="text-ink" />
          ) : (
            <span className="font-semibold">Sold out</span>
          )}
          <span className="ml-2 text-xs tracking-wide">{item.code}</span>
        </p>
      </div>
      {hasOptions(item) && item.available ? (
        <button
          type="button"
          aria-label={`Options for ${item.name}`}
          onClick={() => {
            onOptions(item);
          }}
          className="grid size-11 place-items-center rounded-md text-ink-2 active:bg-sunken"
        >
          <Icon icon={SlidersHorizontal} size={18} />
        </button>
      ) : null}
      <button
        type="button"
        disabled={!item.available}
        aria-label={`Add ${item.name}`}
        onClick={() => {
          onAdd(item);
        }}
        className={cx(
          'flex h-11 min-w-16 items-center justify-center gap-1 rounded-md border px-3 text-sm font-semibold disabled:opacity-40',
          qty > 0
            ? 'border-accent bg-accent text-on-accent'
            : 'border-line-strong bg-surface text-ink active:bg-sunken',
        )}
      >
        {qty > 0 ? <span className="num">{qty}</span> : null}
        <Icon icon={Plus} size={16} />
      </button>
    </li>
  );
}

export interface ItemGridProps {
  items: MenuItem[];
  heading: string;
  cart: Cart;
  onAdd: (item: MenuItem) => void;
  onOptions: (item: MenuItem) => void;
}

export function ItemGrid({ items, heading, cart, onAdd, onOptions }: ItemGridProps) {
  return (
    <section aria-label={heading} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-baseline justify-between px-3 pt-3 pb-2 md:px-4">
        <h2 className="text-base font-semibold">{heading}</h2>
        <p className="hidden text-sm text-ink-2 md:block">
          Tap to add · hold for sizes and add-ons
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-ink-2">No items match. Try the item code, like CC or HZL.</p>
      ) : null}
      <div className="hidden grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 px-4 pt-1 pb-4 md:grid">
        {items.map((item) => (
          <ItemTile
            key={item.id}
            item={item}
            qty={qtyInCart(cart, item.id)}
            onAdd={onAdd}
            onOptions={onOptions}
          />
        ))}
      </div>
      <ul className="bg-surface md:hidden">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            qty={qtyInCart(cart, item.id)}
            onAdd={onAdd}
            onOptions={onOptions}
          />
        ))}
      </ul>
    </section>
  );
}
