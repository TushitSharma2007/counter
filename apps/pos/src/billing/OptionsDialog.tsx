import type { Modifier } from '@repo/pos-core';
import { Button, cx, Dialog, DialogContent, FoodMark, formatINR, Icon } from '@repo/ui';
import { Check } from 'lucide-react';
import { useState } from 'react';
import type { MenuItem, MenuModifierGroup, MenuVariant as Variant } from '@repo/db';

export interface OptionsChoice {
  variant?: Variant;
  modifiers: Modifier[];
}

/** Size (one) and add-ons (any) for an item. Big buttons; the price updates as you pick. */
export function OptionsDialog({
  item,
  groups,
  onClose,
  onConfirm,
}: {
  item: MenuItem | undefined;
  groups: Record<string, MenuModifierGroup>;
  onClose: () => void;
  onConfirm: (item: MenuItem, choice: OptionsChoice) => void;
}) {
  return (
    <Dialog
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {item ? (
        <OptionsBody key={item.id} item={item} groups={groups} onConfirm={onConfirm} />
      ) : null}
    </Dialog>
  );
}

function OptionsBody({
  item,
  groups: allGroups,
  onConfirm,
}: {
  item: MenuItem;
  groups: Record<string, MenuModifierGroup>;
  onConfirm: (item: MenuItem, choice: OptionsChoice) => void;
}) {
  const [variant, setVariant] = useState<Variant | undefined>(
    item.variants.find((v) => v.available),
  );
  const [picked, setPicked] = useState<Modifier[]>([]);
  const groups = item.modifierGroupIds.flatMap((id) => {
    const group = allGroups[id];
    return group ? [group] : [];
  });
  const unit =
    (variant?.pricePaise ?? item.pricePaise) + picked.reduce((s, m) => s + m.pricePaise, 0);

  const toggle = (modifier: Modifier) => {
    setPicked((list) =>
      list.some((m) => m.id === modifier.id)
        ? list.filter((m) => m.id !== modifier.id)
        : [...list, modifier],
    );
  };

  return (
    <DialogContent
      title={item.name}
      size="lg"
      footer={
        <Button
          variant="accent"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            onConfirm(item, { ...(variant ? { variant } : {}), modifiers: picked });
          }}
        >
          Add to bill · {formatINR(unit)}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="-mt-2 flex items-center gap-2 text-sm text-ink-2">
          <FoodMark type={item.food} size={13} /> {item.code}
        </p>
        {item.variants.length > 0 ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Size</legend>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((v) => {
                const on = v.id === variant?.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!v.available}
                    onClick={() => {
                      setVariant(v);
                    }}
                    className={cx(
                      'flex h-14 items-center justify-between rounded-md border px-4 text-base font-medium',
                      'disabled:border-dashed disabled:bg-sunken disabled:opacity-60',
                      on
                        ? 'border-accent bg-accent-soft ring-1 ring-accent'
                        : 'border-line-strong bg-surface',
                    )}
                  >
                    {v.name}
                    <span className="num text-ink-2">
                      {v.available ? formatINR(v.pricePaise) : 'Sold out'}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 text-sm font-semibold">{group.name}</legend>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((m) => {
                const on = picked.some((p) => p.id === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => {
                      toggle(m);
                    }}
                    className={cx(
                      'flex h-14 items-center gap-2 rounded-md border px-3 text-left text-base font-medium',
                      on
                        ? 'border-accent bg-accent-soft ring-1 ring-accent'
                        : 'border-line-strong bg-surface',
                    )}
                  >
                    <span
                      className={cx(
                        'grid size-5 shrink-0 place-items-center rounded-sm border',
                        on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
                      )}
                    >
                      {on ? <Icon icon={Check} size={14} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    <span className="num text-sm text-ink-2">+{formatINR(m.pricePaise)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </DialogContent>
  );
}
