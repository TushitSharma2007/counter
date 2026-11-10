import { Button, formatINR, Sheet, SheetContent, toast } from '@repo/ui';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TopBar, type TopBarProps } from '../components/TopBar.tsx';
import type { Menu, MenuItem } from '@repo/db';
import { useOnline } from '../lib/online.ts';
import { BillPanel } from './BillPanel.tsx';
import { HeldSheet } from './HeldSheet.tsx';
import { needsSize, searchItems, useMenu } from './menu-data.ts';
import { ALL, CategoryChips, CategoryRail, ItemGrid } from './Menu.tsx';
import { OptionsDialog, type OptionsChoice } from './OptionsDialog.tsx';
import { PayDialog, type Payment } from './PayDialog.tsx';
import { useBilling } from './state.ts';

const PAID_AS: Record<Payment['mode'], string> = {
  cash: 'cash',
  upi: 'UPI',
  card: 'card',
  due: 'khata',
};

export interface BillingScreenProps {
  outletId: string;
  outletName: string;
  deviceCode: string;
  /** Who is billing: the PIN-signed-in staff member, or the owner on their own phone. */
  staff: { id: string; name: string; role: string };
  /** Lock (shared tablet) or Outlets (owner's phone). */
  endAction: TopBarProps['endAction'];
  /** A strip under the top bar, e.g. "signed in offline". */
  banner?: ReactNode;
}

/**
 * The billing screen (CLAUDE.md §5 item 3): one-handed on a tablet, keyboard-fast on a PC.
 * Used by shared counter tablets and by owners and managers on their own phones.
 */
export function BillingScreen(props: BillingScreenProps) {
  const menu = useMenu(props.outletId);
  if (!menu.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center text-ink-2">
        {menu.isError
          ? 'Couldn’t load the menu. Connect to the internet once so this device can keep a copy.'
          : 'Loading the menu…'}
      </div>
    );
  }
  return <Billing {...props} menu={menu.data} />;
}

function Billing({
  outletName,
  deviceCode,
  staff,
  endAction,
  banner,
  menu,
}: BillingScreenProps & { menu: Menu }) {
  const online = useOnline();
  const { cart, dispatch, totals, count, held, hold, resume } = useBilling();

  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [optionsFor, setOptionsFor] = useState<MenuItem>();
  const [paying, setPaying] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false); // phone: the bill as a bottom sheet
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchItems(menu.items, search), [menu.items, search]);
  const items = search
    ? results
    : category === ALL
      ? menu.items
      : menu.items.filter((i) => i.categoryId === category);
  const heading = search
    ? `Results for “${search.trim()}”`
    : category === ALL
      ? 'All items'
      : (menu.categories.find((c) => c.id === category)?.name ?? '');

  const addPlain = (item: MenuItem) => {
    if (!item.available) return;
    if (needsSize(item)) {
      setOptionsFor(item);
      return;
    }
    dispatch({
      type: 'add',
      line: {
        itemId: item.id,
        name: item.name,
        modifiers: [],
        unitPaise: item.pricePaise,
        taxRateBp: item.taxRateBp,
      },
    });
  };

  const addWithOptions = (item: MenuItem, choice: OptionsChoice) => {
    const base = choice.variant?.pricePaise ?? item.pricePaise;
    dispatch({
      type: 'add',
      line: {
        itemId: item.id,
        name: item.name,
        ...(choice.variant
          ? { variant: { id: choice.variant.id, name: choice.variant.name } }
          : {}),
        modifiers: choice.modifiers,
        unitPaise: base + choice.modifiers.reduce((s, m) => s + m.pricePaise, 0),
        taxRateBp: item.taxRateBp,
      },
    });
    setOptionsFor(undefined);
  };

  // Keyboard: "/" finds an item, Enter adds the top result (or opens Pay when not searching).
  const overlayOpen = paying || heldOpen || billOpen || optionsFor !== undefined;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (overlayOpen) return;
      const typing = (event.target as HTMLElement | null)?.closest('input, textarea');
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'Enter' && !typing && cart.lines.length > 0) {
        setPaying(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [overlayOpen, cart.lines.length]);

  const addTopResult = () => {
    const top = results[0];
    if (!top) return;
    addPlain(top);
    setSearch('');
  };

  const paid = (payment: Payment) => {
    const change =
      payment.tenderedPaise !== undefined ? payment.tenderedPaise - totals.totalPaise : 0;
    toast({
      title: 'Bill paid',
      description: `${formatINR(totals.totalPaise)} by ${PAID_AS[payment.mode]}${change > 0 ? ` · return ${formatINR(change)}` : ''}`,
      tone: 'success',
    });
    setPaying(false);
    setBillOpen(false);
    dispatch({ type: 'clear' });
  };

  const panel = (className: string, showTitle = true) => (
    <BillPanel
      cart={cart}
      dispatch={dispatch}
      totals={totals}
      count={count}
      onPay={() => {
        setPaying(true);
      }}
      onHold={() => {
        hold();
        setBillOpen(false);
        toast({ title: 'Bill held', description: 'Find it under Held in the top bar.' });
      }}
      showTitle={showTitle}
      className={className}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <TopBar
        outletName={outletName}
        deviceCode={deviceCode}
        online={online}
        search={search}
        onSearch={setSearch}
        onSearchEnter={addTopResult}
        searchRef={searchRef}
        heldCount={held.length}
        onOpenHeld={() => {
          setHeldOpen(true);
        }}
        staff={staff}
        endAction={endAction}
      />
      {banner}

      <div className="flex min-h-0 flex-1">
        <CategoryRail
          categories={menu.categories}
          items={menu.items}
          value={category}
          onChange={(id) => {
            setCategory(id);
            setSearch('');
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <CategoryChips
            categories={menu.categories}
            value={category}
            onChange={(id) => {
              setCategory(id);
              setSearch('');
            }}
          />
          <ItemGrid
            items={items}
            heading={heading}
            cart={cart}
            onAdd={addPlain}
            onOptions={setOptionsFor}
          />
        </div>
        {panel('hidden w-[380px] shrink-0 border-l border-line md:flex lg:w-[400px]')}
      </div>

      {/* Phone: the bill lives in a bottom sheet behind this bar. */}
      <div className="shrink-0 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <Button
          variant={count > 0 ? 'accent' : 'secondary'}
          size="lg"
          className="w-full justify-between"
          onClick={() => {
            setBillOpen(true);
          }}
        >
          <span>{count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Bill is empty'}</span>
          <span className="num">
            {count > 0 ? `${formatINR(totals.totalPaise)} · View bill` : 'View bill'}
          </span>
        </Button>
      </div>
      <Sheet open={billOpen} onOpenChange={setBillOpen}>
        <SheetContent title="New bill" className="h-[92dvh]">
          {panel('-mx-4 -my-3 h-full', false)}
        </SheetContent>
      </Sheet>

      <OptionsDialog
        item={optionsFor}
        groups={menu.modifierGroups}
        onClose={() => {
          setOptionsFor(undefined);
        }}
        onConfirm={addWithOptions}
      />
      <PayDialog
        open={paying}
        totalPaise={totals.totalPaise}
        initialMode={cart.paymentMode}
        customerPhone={cart.customerPhone}
        onClose={() => {
          setPaying(false);
        }}
        onPaid={paid}
      />
      <HeldSheet
        open={heldOpen}
        held={held}
        onClose={() => {
          setHeldOpen(false);
        }}
        onResume={(id) => {
          resume(id);
          setHeldOpen(false);
        }}
      />
    </div>
  );
}
