import { ModifierGroupInput, saveModifierGroup, type Menu, type MenuModifierGroup } from '@repo/db';
import {
  Button,
  formatINR,
  Icon,
  Input,
  parseRupees,
  rupeesText,
  Sheet,
  SheetContent,
  toast,
} from '@repo/ui';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db.ts';

interface OptionRow {
  name: string;
  price: string;
}

/** Add-on groups (Milk, Extras) and their options with prices. */
export function AddOnsSheet({
  open,
  menu,
  onClose,
  onChanged,
}: {
  open: boolean;
  menu: Menu;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<MenuModifierGroup | 'new'>();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(undefined);
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        title="Add-ons"
        description="Groups like Milk or Extras. Link them to items in the item editor."
      >
        {editing ? (
          <GroupEditor
            key={editing === 'new' ? 'new' : editing.id}
            orgId={menu.orgId}
            group={editing === 'new' ? undefined : editing}
            onDone={(saved) => {
              setEditing(undefined);
              if (saved) onChanged();
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="overflow-hidden rounded-md border border-line">
              {Object.values(menu.modifierGroups).map((group) => (
                <li key={group.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(group);
                    }}
                    className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left active:bg-sunken"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{group.name}</span>
                      <span className="block truncate text-sm text-ink-2">
                        {group.options
                          .map((o) => `${o.name} +${formatINR(o.pricePaise)}`)
                          .join(' · ')}
                      </span>
                    </span>
                    <Icon icon={ChevronRight} className="text-ink-2" />
                  </button>
                </li>
              ))}
              {Object.keys(menu.modifierGroups).length === 0 ? (
                <li className="px-3 py-6 text-ink-2">
                  No add-ons yet. Add one like Milk: Oat, Almond.
                </li>
              ) : null}
            </ul>
            <Button
              className="self-start"
              onClick={() => {
                setEditing('new');
              }}
            >
              <Icon icon={Plus} size={18} />
              New add-on group
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function GroupEditor({
  orgId,
  group,
  onDone,
}: {
  orgId: string;
  group: MenuModifierGroup | undefined;
  onDone: (saved: boolean) => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [options, setOptions] = useState<OptionRow[]>(
    group?.options.map((o) => ({ name: o.name, price: rupeesText(o.pricePaise) })) ?? [
      { name: '', price: '' },
    ],
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = options.map((o) => ({ name: o.name, pricePaise: parseRupees(o.price || '0') }));
    if (parsed.some((o) => o.pricePaise === undefined)) {
      setError('Every add-on needs a price (0 is fine).');
      return;
    }
    const input: ModifierGroupInput = {
      ...(group ? { id: group.id } : {}),
      orgId,
      name,
      options: parsed.map((o) => ({ name: o.name, pricePaise: o.pricePaise ?? 0 })),
    };
    const check = ModifierGroupInput.safeParse(input);
    if (!check.success) {
      setError(check.error.issues[0]?.message);
      return;
    }
    setBusy(true);
    try {
      await saveModifierGroup(db, input);
      toast({ title: 'Add-ons saved', description: name, tone: 'success' });
      onDone(true);
    } catch {
      setError('Couldn’t save. Check the names are all different and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Group name"
        placeholder="Milk"
        value={name}
        maxLength={40}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Options</legend>
        {options.map((option, i) => (
          <div key={i} className="grid grid-cols-[1fr_7.5rem_auto] gap-2">
            <Input
              label={`Option ${i + 1}`}
              hideLabel
              placeholder="Oat milk"
              value={option.name}
              onChange={(e) => {
                setOptions(options.map((o, j) => (j === i ? { ...o, name: e.target.value } : o)));
              }}
            />
            <Input
              label={`Option ${i + 1} price`}
              hideLabel
              prefix="+₹"
              numeric
              inputMode="decimal"
              placeholder="0"
              value={option.price}
              onChange={(e) => {
                setOptions(options.map((o, j) => (j === i ? { ...o, price: e.target.value } : o)));
              }}
            />
            <Button
              variant="ghost"
              aria-label={`Remove option ${i + 1}`}
              className="w-tap px-0"
              disabled={options.length <= 1}
              onClick={() => {
                setOptions(options.filter((_, j) => j !== i));
              }}
            >
              <Icon icon={Trash2} size={18} />
            </Button>
          </div>
        ))}
        <Button
          className="self-start"
          onClick={() => {
            setOptions([...options, { name: '', price: '' }]);
          }}
        >
          <Icon icon={Plus} size={18} />
          Add an option
        </Button>
      </fieldset>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2 border-t border-line pt-3">
        <Button
          variant="ghost"
          onClick={() => {
            onDone(false);
          }}
        >
          Back
        </Button>
        <Button
          variant="accent"
          size="lg"
          busy={busy}
          className="flex-1"
          onClick={() => void save()}
        >
          Save add-ons
        </Button>
      </div>
    </div>
  );
}
