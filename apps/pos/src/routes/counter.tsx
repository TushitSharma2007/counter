import { signOut } from '@repo/db';
import { Button, formatINR, Sheet, SheetContent, StatusPill, toast } from '@repo/ui';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BillPanel } from '../billing/BillPanel.tsx';
import { HeldSheet } from '../billing/HeldSheet.tsx';
import { ALL, CategoryChips, CategoryRail, ItemGrid } from '../billing/Menu.tsx';
import { OptionsDialog, type OptionsChoice } from '../billing/OptionsDialog.tsx';
import { PayDialog, type Payment } from '../billing/PayDialog.tsx';
import { useBilling } from '../billing/state.ts';
import { TopBar } from '../components/TopBar.tsx';
import { CATEGORIES, ITEMS, needsSize, searchItems, type MenuItem } from '../fixtures/menu.ts';
import { getActor, setActor, useActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { loadCachedRoster, loadDevice } from '../lib/device.ts';
import { useOnline } from '../lib/online.ts';

export const Route = createFileRoute('/counter')({
  beforeLoad: async () => {
    if (!loadDevice()) throw redirect({ to: '/' });
    const actor = getActor();
    if (!actor) throw redirect({ to: '/pin' });
    // An online sign-in whose session has gone (expired, signed out elsewhere) must PIN in again.
    if (actor.mode === 'online') {
      const { data } = await db.auth.getSession();
      if (!data.session) {
        setActor(undefined);
        throw redirect({ to: '/pin' });
      }
    }
  },
  component: Billing,
});

const PAID_AS: Record<Payment['mode'], string> = {
  cash: 'cash',
  upi: 'UPI',
  card: 'card',
  due: 'khata',
};

/** The billing screen (CLAUDE.md §5 item 3): one-handed on a tablet, keyboard-fast on a PC. */
function Billing() {
  const actor = useActor();
  const online = useOnline();
  const navigate = useNavigate();
  const roster = loadCachedRoster();
  const { cart, dispatch, totals, count, held, hold, resume } = useBilling();

  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [optionsFor, setOptionsFor] = useState<MenuItem>();
  const [paying, setPaying] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false); // phone: the bill as a bottom sheet
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchItems(search), [search]);
  const items = search
    ? results
    : category === ALL
      ? ITEMS
      : ITEMS.filter((i) => i.categoryId === category);
  const heading = search
    ? `Results for “${search.trim()}”`
    : category === ALL
      ? 'All items'
      : (CATEGORIES.find((c) => c.id === category)?.name ?? '');

  const addPlain = (item: MenuItem) => {
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

  const lock = async () => {
    setActor(undefined);
    await signOut(db);
    await navigate({ to: '/pin' });
  };

  if (!actor) return null;

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
        outletName={roster?.outlet.name ?? ''}
        deviceCode={roster?.device.code ?? ''}
        online={online}
        search={search}
        onSearch={setSearch}
        onSearchEnter={addTopResult}
        searchRef={searchRef}
        heldCount={held.length}
        onOpenHeld={() => {
          setHeldOpen(true);
        }}
        staff={{ id: actor.membershipId, name: actor.name, role: actor.role }}
        onLock={() => void lock()}
      />
      {actor.mode === 'offline' ? (
        <p className="flex shrink-0 items-center gap-2 bg-warning-soft px-4 py-1.5 text-sm text-warning">
          <StatusPill tone="warning" className="!h-6">
            Offline
          </StatusPill>
          {actor.name} signed in on this tablet. Bills will sync when the internet is back.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <CategoryRail
          value={category}
          onChange={(id) => {
            setCategory(id);
            setSearch('');
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <CategoryChips
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
