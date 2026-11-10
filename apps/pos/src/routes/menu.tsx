import {
  fetchMenu,
  getMe,
  listManagedOutlets,
  setOutletOverride,
  type Menu,
  type MenuItem,
} from '@repo/db';
import {
  Button,
  cx,
  FoodMark,
  formatINR,
  Icon,
  Input,
  PriceTag,
  Select,
  StatusPill,
  Switch,
  toast,
} from '@repo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowLeft, Layers, ListTree, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { AddOnsSheet } from '../menu/AddOnsSheet.tsx';
import { CategoriesSheet } from '../menu/CategoriesSheet.tsx';
import { ItemEditor } from '../menu/ItemEditor.tsx';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';

// Menu management (CLAUDE.md §5 item 2). Owners change items and prices; managers mark items sold
// out at their own outlets. PC-first and dense, still usable on a phone.
export const Route = createFileRoute('/menu')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: '/' });
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: MenuPage,
});

function priceLine(item: MenuItem) {
  if (item.variants.length === 0) return formatINR(item.pricePaise);
  return item.variants.map((v) => `${v.name.charAt(0)} ${formatINR(v.pricePaise)}`).join(' · ');
}

function differsFromMenu(item: MenuItem): boolean {
  return (
    item.pricePaise !== item.basePricePaise ||
    item.variants.some((v) => v.pricePaise !== v.basePricePaise)
  );
}

function MenuPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => getMe(db) });
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const isOwner = me.data?.role === 'owner';

  const [outletId, setOutletId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MenuItem | 'new'>();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [addOnsOpen, setAddOnsOpen] = useState(false);

  // Managers always look at one of their outlets; owners can also see plain menu prices.
  const viewOutlet = outletId || (isOwner ? '' : (outlets.data?.[0]?.id ?? ''));
  const orgId = outlets.data?.[0]?.orgId;

  const menu = useQuery({
    queryKey: ['menu-admin', orgId, viewOutlet],
    enabled: orgId !== undefined,
    queryFn: () =>
      fetchMenu(db, {
        orgId: orgId ?? '',
        includeInactive: true,
        ...(viewOutlet ? { outletId: viewOutlet } : {}),
      }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['menu-admin'] });
    void queryClient.invalidateQueries({ queryKey: ['menu'] });
    void queryClient.invalidateQueries({ queryKey: ['item-overrides'] });
  };

  const setAvailable = async (m: Menu, item: MenuItem, available: boolean) => {
    try {
      await setOutletOverride(db, {
        orgId: m.orgId,
        outletId: viewOutlet,
        itemId: item.id,
        pricePaise: item.pricePaise !== item.basePricePaise ? item.pricePaise : null,
        isAvailable: available,
      });
      refresh();
    } catch {
      toast({
        title: 'Couldn’t update',
        description: 'Check your connection and try again.',
        tone: 'danger',
      });
    }
  };

  const data = menu.data;
  const outletName = outlets.data?.find((o) => o.id === viewOutlet)?.name;
  const q = search.trim().toLowerCase();
  const matches = (item: MenuItem) =>
    !q || item.name.toLowerCase().includes(q) || item.code.toLowerCase().startsWith(q);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-2 bg-ink px-2 text-canvas md:px-4">
        <Link
          to="/home"
          className="flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium active:bg-canvas/10"
        >
          <Icon icon={ArrowLeft} size={18} />
          My outlets
        </Link>
        <span className="ml-2 font-display text-lg font-semibold">Menu</span>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Menu</h1>
            <p className="num text-ink-2">
              {menu.data
                ? `${menu.data.items.length} items · ${menu.data.categories.length} categories`
                : ' '}
            </p>
          </div>
          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setCategoriesOpen(true);
                }}
              >
                <Icon icon={ListTree} size={18} />
                Categories
              </Button>
              <Button
                onClick={() => {
                  setAddOnsOpen(true);
                }}
              >
                <Icon icon={Layers} size={18} />
                Add-ons
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  setEditing('new');
                }}
              >
                <Icon icon={Plus} size={18} />
                Add item
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_18rem]">
          <Input
            label="Find an item"
            hideLabel
            placeholder="Find by name or code"
            prefix={<Icon icon={Search} size={18} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
          <Select
            label="Prices and availability at"
            hideLabel
            value={viewOutlet}
            options={[
              ...(isOwner ? [{ value: '', label: 'Menu prices (all outlets)' }] : []),
              ...(outlets.data ?? []).map((o) => ({ value: o.id, label: `At ${o.name}` })),
            ]}
            onChange={(e) => {
              setOutletId(e.target.value);
            }}
          />
        </div>

        {menu.isPending ? <p className="text-ink-2">Loading the menu…</p> : null}
        {menu.data?.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
            <p className="text-md font-semibold">No items yet</p>
            <p className="text-ink-2">Add your first drink, like Cold Coffee at ₹149.</p>
          </div>
        ) : null}

        {data
          ? data.categories.map((category) => {
              const items = data.items.filter((i) => i.categoryId === category.id && matches(i));
              if (items.length === 0 && q) return null;
              return (
                <section key={category.id} aria-label={category.name}>
                  <div className="flex items-center gap-2 border-b border-line-strong pb-2">
                    <h2 className="text-md font-semibold">{category.name}</h2>
                    <span className="num text-sm text-ink-2">{items.length}</span>
                    {!category.isActive ? (
                      <StatusPill tone="neutral" className="!h-6">
                        Off the menu
                      </StatusPill>
                    ) : null}
                  </div>

                  <div className="hidden grid-cols-[minmax(0,1fr)_12rem_4rem_10rem_10rem_5.5rem] gap-3 border-b border-line py-2 text-xs font-medium tracking-wide text-ink-2 uppercase md:grid">
                    <span>Item</span>
                    <span className="text-right">
                      {outletName ? `Price at ${outletName}` : 'Price'}
                    </span>
                    <span className="text-right">GST</span>
                    <span>Add-ons</span>
                    <span>{outletName ? 'Available' : ''}</span>
                    <span />
                  </div>

                  <ul>
                    {items.length === 0 ? (
                      <li className="py-4 text-ink-2">No items in this category.</li>
                    ) : null}
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className={cx(
                          'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line py-2',
                          'md:grid-cols-[minmax(0,1fr)_12rem_4rem_10rem_10rem_5.5rem]',
                          !item.isActive && 'opacity-60',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FoodMark type={item.food} size={13} />
                          <span className="truncate font-semibold">{item.name}</span>
                          <span className="text-xs font-medium tracking-wide text-ink-2">
                            {item.code}
                          </span>
                          {!item.isActive ? (
                            <StatusPill tone="neutral" className="!h-6">
                              Off
                            </StatusPill>
                          ) : null}
                        </div>
                        <div className="num text-right text-sm md:text-base">
                          {item.variants.length === 0 ? (
                            <PriceTag paise={item.pricePaise} />
                          ) : (
                            priceLine(item)
                          )}
                          {viewOutlet && differsFromMenu(item) ? (
                            <span className="block text-xs text-ink-2">outlet price</span>
                          ) : null}
                        </div>
                        <span className="num hidden text-right text-ink-2 md:block">
                          {item.taxRateBp / 100}%
                        </span>
                        <span className="hidden truncate text-sm text-ink-2 md:block">
                          {item.modifierGroupIds
                            .map((id) => data.modifierGroups[id]?.name)
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </span>
                        <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-2 md:contents">
                          {viewOutlet ? (
                            <Switch
                              checked={item.available}
                              label={`${item.name} available at ${outletName ?? 'this outlet'}`}
                              text={item.available ? 'Available' : 'Sold out'}
                              onChange={(on) => void setAvailable(data, item, on)}
                            />
                          ) : (
                            <span className="hidden md:block" />
                          )}
                          {isOwner ? (
                            <Button
                              size="sm"
                              className="h-11 md:justify-self-end"
                              onClick={() => {
                                setEditing(item);
                              }}
                            >
                              Edit
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          : null}
      </main>

      {menu.data ? (
        <>
          <ItemEditor
            open={editing !== undefined}
            item={editing === 'new' ? undefined : editing}
            menu={menu.data}
            outlets={outlets.data ?? []}
            onClose={() => {
              setEditing(undefined);
            }}
            onSaved={() => {
              setEditing(undefined);
              refresh();
            }}
          />
          <CategoriesSheet
            open={categoriesOpen}
            menu={menu.data}
            onClose={() => {
              setCategoriesOpen(false);
            }}
            onChanged={refresh}
          />
          <AddOnsSheet
            open={addOnsOpen}
            menu={menu.data}
            onClose={() => {
              setAddOnsOpen(false);
            }}
            onChanged={refresh}
          />
        </>
      ) : null}
    </div>
  );
}
