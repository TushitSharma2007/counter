import { saveCategory, type Menu } from '@repo/db';
import { Button, Icon, Input, Sheet, SheetContent, Switch, toast } from '@repo/ui';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db.ts';

/** Add, rename, reorder and switch off categories. Each change saves straight away. */
export function CategoriesSheet({
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
  const [newName, setNewName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const categories = menu.categories;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      onChanged();
    } catch (error) {
      const duplicate =
        error instanceof Error && error.message.includes('categories_org_id_name_key');
      toast({
        title: duplicate ? 'That category already exists' : 'Couldn’t save',
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, by: -1 | 1) => {
    const a = categories[index];
    const b = categories[index + by];
    if (!a || !b) return;
    void run(async () => {
      await saveCategory(db, {
        id: a.id,
        orgId: menu.orgId,
        name: a.name,
        sort: b.sort,
        isActive: a.isActive,
      });
      await saveCategory(db, {
        id: b.id,
        orgId: menu.orgId,
        name: b.name,
        sort: a.sort,
        isActive: b.isActive,
      });
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        title="Categories"
        description="The order here is the order on the billing screen."
      >
        <form
          className="flex items-end gap-2 border-b border-line pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            void run(async () => {
              await saveCategory(db, {
                orgId: menu.orgId,
                name,
                sort: Math.max(0, ...categories.map((c) => c.sort)) + 1,
              });
              setNewName('');
            });
          }}
        >
          <Input
            label="New category"
            placeholder="Breakfast"
            className="flex-1"
            value={newName}
            maxLength={60}
            onChange={(e) => {
              setNewName(e.target.value);
            }}
          />
          <Button type="submit" variant="primary" busy={busy} disabled={!newName.trim()}>
            Add
          </Button>
        </form>

        <ul>
          {categories.map((category, i) => (
            <li
              key={category.id}
              className="flex items-center gap-1 border-b border-line py-2 last:border-0"
            >
              <Input
                label={`Name of ${category.name}`}
                hideLabel
                className="min-w-0 flex-1"
                value={names[category.id] ?? category.name}
                maxLength={60}
                onChange={(e) => {
                  setNames({ ...names, [category.id]: e.target.value });
                }}
                onBlur={() => {
                  const name = names[category.id]?.trim();
                  if (!name || name === category.name) return;
                  void run(() =>
                    saveCategory(db, {
                      id: category.id,
                      orgId: menu.orgId,
                      name,
                      sort: category.sort,
                      isActive: category.isActive,
                    }),
                  );
                }}
              />
              <Button
                variant="ghost"
                aria-label={`Move ${category.name} up`}
                className="w-tap px-0"
                disabled={i === 0 || busy}
                onClick={() => {
                  move(i, -1);
                }}
              >
                <Icon icon={ArrowUp} size={18} />
              </Button>
              <Button
                variant="ghost"
                aria-label={`Move ${category.name} down`}
                className="w-tap px-0"
                disabled={i === categories.length - 1 || busy}
                onClick={() => {
                  move(i, 1);
                }}
              >
                <Icon icon={ArrowDown} size={18} />
              </Button>
              <Switch
                checked={category.isActive}
                label={`${category.name} on the menu`}
                disabled={busy}
                onChange={(on) => {
                  void run(() =>
                    saveCategory(db, {
                      id: category.id,
                      orgId: menu.orgId,
                      name: category.name,
                      sort: category.sort,
                      isActive: on,
                    }),
                  );
                }}
              />
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
