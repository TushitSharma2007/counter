import {
  fetchItemOverrides,
  fetchItemVariants,
  GST_SLABS_BP,
  ItemInput,
  saveItem,
  setOutletOverride,
  type ManagedOutlet,
  type Menu,
  type MenuItem,
} from '@repo/db';
import {
  Button,
  cx,
  FoodMark,
  Icon,
  Input,
  parseRupees,
  rupeesText,
  Segmented,
  Select,
  Sheet,
  SheetContent,
  Switch,
  toast,
  type FoodType,
} from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db.ts';

interface SizeRow {
  name: string;
  price: string;
}

const FOOD_OPTIONS: { value: FoodType; label: React.ReactNode }[] = [
  {
    value: 'veg',
    label: (
      <>
        <FoodMark type="veg" size={12} /> Veg
      </>
    ),
  },
  {
    value: 'nonveg',
    label: (
      <>
        <FoodMark type="nonveg" size={12} /> Non-veg
      </>
    ),
  },
  {
    value: 'egg',
    label: (
      <>
        <FoodMark type="egg" size={12} /> Egg
      </>
    ),
  },
];

const GST_OPTIONS = GST_SLABS_BP.map((bp) => ({ value: String(bp), label: `${bp / 100}%` }));

export interface ItemEditorProps {
  /** The item to edit; a new item when undefined. */
  item: MenuItem | undefined;
  open: boolean;
  menu: Menu;
  outlets: ManagedOutlet[];
  onClose: () => void;
  onSaved: () => void;
}

export function ItemEditor({ item, open, menu, outlets, onClose, onSaved }: ItemEditorProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open ? (
        <EditorBody
          key={item?.id ?? 'new'}
          item={item}
          menu={menu}
          outlets={outlets}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  );
}

function EditorBody({ item, menu, outlets, onClose, onSaved }: Omit<ItemEditorProps, 'open'>) {
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? menu.categories[0]?.id ?? '');
  const [food, setFood] = useState<FoodType>(item?.food ?? 'veg');
  const [mode, setMode] = useState<'single' | 'sizes'>(
    item && item.variants.length > 0 ? 'sizes' : 'single',
  );
  const [price, setPrice] = useState(item ? rupeesText(item.basePricePaise) : '');
  const [sizes, setSizes] = useState<SizeRow[]>(
    item && item.variants.length > 0
      ? item.variants.map((v) => ({ name: v.name, price: rupeesText(v.basePricePaise) }))
      : [
          { name: 'Regular', price: '' },
          { name: 'Large', price: '' },
        ],
  );
  const [taxRateBp, setTaxRateBp] = useState(String(item?.taxRateBp ?? 500));
  const [groupIds, setGroupIds] = useState<string[]>(item?.modifierGroupIds ?? []);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  /** outletId → size name ('' for one price) → typed price; blank = menu price. */
  const [outletPrices, setOutletPrices] = useState<Record<string, Record<string, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Existing outlet prices for this item.
  const overrides = useQuery({
    queryKey: ['item-overrides', item?.id],
    enabled: item !== undefined,
    queryFn: async () => {
      const rows = await fetchItemOverrides(db, item?.id ?? '');
      const byOutlet: Record<string, Record<string, string>> = {};
      for (const row of rows) {
        if (row.pricePaise === null) continue;
        const sizeName = row.variantId
          ? (item?.variants.find((v) => v.id === row.variantId)?.name ?? '')
          : '';
        byOutlet[row.outletId] = {
          ...byOutlet[row.outletId],
          [sizeName]: rupeesText(row.pricePaise),
        };
      }
      setOutletPrices(byOutlet);
      return rows;
    },
  });

  const sizeNames = mode === 'sizes' ? sizes.map((s) => s.name.trim()).filter(Boolean) : [''];

  const save = async () => {
    const errs: Record<string, string> = {};
    const single = parseRupees(price);
    const parsedSizes = sizes.map((s) => ({ name: s.name, pricePaise: parseRupees(s.price) }));
    if (mode === 'single' && single === undefined) errs.price = 'Enter a price, like 149';
    if (mode === 'sizes' && parsedSizes.some((s) => s.pricePaise === undefined)) {
      errs.variants = 'Every size needs a price';
    }

    const input: ItemInput = {
      ...(item ? { id: item.id } : {}),
      orgId: menu.orgId,
      categoryId,
      name,
      code,
      food,
      pricePaise: mode === 'single' ? (single ?? 0) : (parsedSizes[0]?.pricePaise ?? 0),
      taxRateBp: Number(taxRateBp) as ItemInput['taxRateBp'],
      isActive,
      variants:
        mode === 'sizes'
          ? parsedSizes.map((s) => ({ name: s.name, pricePaise: s.pricePaise ?? 0 }))
          : [],
      modifierGroupIds: groupIds,
    };
    const parsed = ItemInput.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        errs[String(issue.path[0] ?? 'form')] ??= issue.message;
    }
    for (const [outletId, byName] of Object.entries(outletPrices)) {
      for (const [sizeName, text] of Object.entries(byName)) {
        if (text.trim() && parseRupees(text) === undefined)
          errs[`outlet-${outletId}-${sizeName}`] = 'Not a price';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      const itemId = await saveItem(db, input);
      // Outlet prices: blank means the menu price.
      const variants = mode === 'sizes' ? await fetchItemVariants(db, itemId) : [];
      const existing = overrides.data ?? [];
      for (const outlet of outlets) {
        for (const sizeName of sizeNames) {
          const variantId = sizeName
            ? (variants.find((v) => v.name === sizeName)?.id ?? null)
            : null;
          if (sizeName && !variantId) continue;
          const typed = outletPrices[outlet.id]?.[sizeName]?.trim() ?? '';
          const current = existing.find(
            (o) => o.outletId === outlet.id && o.variantId === variantId,
          );
          const pricePaise = typed ? (parseRupees(typed) ?? null) : null;
          if ((current?.pricePaise ?? null) === pricePaise) continue;
          await setOutletOverride(db, {
            orgId: menu.orgId,
            outletId: outlet.id,
            itemId,
            variantId,
            pricePaise,
            isAvailable: current?.isAvailable ?? true,
          });
        }
      }
      toast({
        title: item ? 'Item saved' : 'Item added',
        description: input.name,
        tone: 'success',
      });
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('items_org_id_code_key'))
        setErrors({ code: 'Another item already uses this code' });
      else
        toast({
          title: 'Couldn’t save',
          description: 'Check your connection and try again.',
          tone: 'danger',
        });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetContent
      side="right"
      title={item ? `Edit ${item.name}` : 'Add an item'}
      className="!max-w-xl"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="lg"
            busy={busy}
            className="flex-1"
            onClick={() => void save()}
          >
            {item ? 'Save changes' : 'Add to menu'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Input
            label="Name"
            value={name}
            maxLength={80}
            placeholder="Cold Coffee"
            onChange={(e) => {
              setName(e.target.value);
            }}
            {...(errors.name ? { error: errors.name } : {})}
          />
          <Input
            label="Code"
            value={code}
            maxLength={6}
            placeholder="CC"
            hint={errors.code ? undefined : 'For billing by keyboard'}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
            }}
            {...(errors.code ? { error: errors.code } : {})}
          />
        </div>

        <Select
          label="Category"
          value={categoryId}
          options={menu.categories.map((c) => ({
            value: c.id,
            label: c.isActive ? c.name : `${c.name} (off)`,
          }))}
          onChange={(e) => {
            setCategoryId(e.target.value);
          }}
          {...(errors.categoryId ? { error: errors.categoryId } : {})}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Food mark</legend>
          <Segmented label="Food mark" value={food} options={FOOD_OPTIONS} onChange={setFood} />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Price (including GST)</legend>
          <Segmented
            label="Pricing"
            value={mode}
            options={[
              { value: 'single', label: 'One price' },
              { value: 'sizes', label: 'Sizes' },
            ]}
            onChange={setMode}
          />
          {mode === 'single' ? (
            <Input
              label="Price"
              hideLabel
              prefix="₹"
              numeric
              inputMode="decimal"
              placeholder="149"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
              }}
              {...(errors.price ? { error: errors.price } : {})}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {sizes.map((size, i) => (
                <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-start gap-2">
                  <Input
                    label={`Size ${i + 1} name`}
                    hideLabel
                    value={size.name}
                    placeholder="Regular"
                    onChange={(e) => {
                      setSizes(sizes.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)));
                    }}
                  />
                  <Input
                    label={`Size ${i + 1} price`}
                    hideLabel
                    prefix="₹"
                    numeric
                    inputMode="decimal"
                    placeholder="149"
                    value={size.price}
                    onChange={(e) => {
                      setSizes(
                        sizes.map((s, j) => (j === i ? { ...s, price: e.target.value } : s)),
                      );
                    }}
                  />
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${size.name || `size ${i + 1}`}`}
                    className="w-tap px-0"
                    disabled={sizes.length <= 2}
                    onClick={() => {
                      setSizes(sizes.filter((_, j) => j !== i));
                    }}
                  >
                    <Icon icon={Trash2} size={18} />
                  </Button>
                </div>
              ))}
              {errors.variants ? <p className="text-sm text-danger">{errors.variants}</p> : null}
              <Button
                className="self-start"
                onClick={() => {
                  setSizes([...sizes, { name: '', price: '' }]);
                }}
              >
                <Icon icon={Plus} size={18} />
                Add a size
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">GST</legend>
          <Segmented label="GST" value={taxRateBp} options={GST_OPTIONS} onChange={setTaxRateBp} />
          <p className="text-sm text-ink-2">Most café food and drinks are 5%.</p>
        </fieldset>

        {Object.keys(menu.modifierGroups).length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-ink-2">
              Add-ons customers can pick
            </legend>
            {Object.values(menu.modifierGroups).map((group) => {
              const on = groupIds.includes(group.id);
              return (
                <label
                  key={group.id}
                  className={cx(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-3 py-2',
                    on ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      setGroupIds(
                        on ? groupIds.filter((id) => id !== group.id) : [...groupIds, group.id],
                      );
                    }}
                    className="size-5 accent-(--accent)"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{group.name}</span>
                    <span className="block truncate text-sm text-ink-2">
                      {group.options.map((o) => o.name).join(', ')}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : null}

        {outlets.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink-2">Price at each outlet</legend>
            <p className="-mt-1 text-sm text-ink-2">Leave blank to use the menu price.</p>
            {outlets.map((outlet) => (
              <div
                key={outlet.id}
                className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 border-b border-line py-2 last:border-0"
              >
                <span className="truncate font-medium">{outlet.name}</span>
                <div className="flex flex-wrap gap-2">
                  {sizeNames.map((sizeName) => {
                    const key = `outlet-${outlet.id}-${sizeName}`;
                    return (
                      <Input
                        key={sizeName || 'one'}
                        label={`${outlet.name} ${sizeName || 'price'}`}
                        hideLabel
                        prefix={sizeName ? `${sizeName} ₹` : '₹'}
                        numeric
                        inputMode="decimal"
                        placeholder={
                          mode === 'single'
                            ? price || 'Menu price'
                            : (sizes.find((s) => s.name.trim() === sizeName)?.price ?? '') || 'Menu'
                        }
                        className="min-w-36 flex-1"
                        value={outletPrices[outlet.id]?.[sizeName] ?? ''}
                        onChange={(e) => {
                          setOutletPrices({
                            ...outletPrices,
                            [outlet.id]: { ...outletPrices[outlet.id], [sizeName]: e.target.value },
                          });
                        }}
                        {...(errors[key] ? { error: errors[key] } : {})}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>
        ) : null}

        <div className="border-t border-line pt-2">
          <Switch
            checked={isActive}
            onChange={setIsActive}
            label="On the menu"
            text={isActive ? 'On the menu' : 'Off the menu (kept for past bills)'}
          />
        </div>
      </div>
    </SheetContent>
  );
}
