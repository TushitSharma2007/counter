import {
  fetchBusinessDetails,
  fetchOutletDetails,
  updateBusinessDetails,
  updateOutletDetails,
  type BusinessDetails,
  type OutletDetails,
} from '@repo/db';
import { isValidVpa } from '@repo/payments';
import { Button, Input, Segmented, Sheet, SheetContent, Switch, toast } from '@repo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { db } from '../lib/db.ts';

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function useSaved(keys: string[][]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
  };
}

/** An outlet's name, address (on receipts) and UPI ID (for the payment QR). */
export function OutletSheet({
  outletId,
  onClose,
}: {
  outletId: string | undefined;
  onClose: () => void;
}) {
  const details = useQuery({
    queryKey: ['outlet-details', outletId],
    enabled: outletId !== undefined,
    queryFn: () => fetchOutletDetails(db, outletId ?? ''),
  });
  return (
    <Sheet
      open={outletId !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {details.data ? (
        <OutletForm key={details.data.id} initial={details.data} onClose={onClose} />
      ) : (
        <SheetContent side="right" title="Outlet details">
          <p className="text-ink-2">Loading…</p>
        </SheetContent>
      )}
    </Sheet>
  );
}

function OutletForm({ initial, onClose }: { initial: OutletDetails; onClose: () => void }) {
  const [o, setO] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const saved = useSaved([['managed-outlets'], ['menu'], ['outlet-details']]);

  const save = async () => {
    if (!o.name.trim()) {
      setError('Give the outlet a name.');
      return;
    }
    if (o.upiVpa?.trim() && !isValidVpa(o.upiVpa)) {
      setError('That doesn’t look like a UPI ID, e.g. yourcafe@okaxis.');
      return;
    }
    setBusy(true);
    try {
      await updateOutletDetails(db, o);
      toast({ title: 'Outlet saved', description: o.name, tone: 'success' });
      saved();
      onClose();
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <SheetContent
      side="right"
      title={initial.name}
      description="Shown on receipts, and used for the UPI QR at the counter."
      footer={
        <Button
          variant="accent"
          size="lg"
          busy={busy}
          className="w-full"
          onClick={() => void save()}
        >
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={o.name}
          maxLength={120}
          onChange={(e) => {
            setO({ ...o, name: e.target.value });
          }}
        />
        <Input
          label="Address"
          value={o.address ?? ''}
          placeholder="E-5, Arera Colony"
          onChange={(e) => {
            setO({ ...o, address: e.target.value });
          }}
        />
        <Input
          label="City"
          value={o.city ?? ''}
          placeholder="Bhopal"
          onChange={(e) => {
            setO({ ...o, city: e.target.value });
          }}
        />
        <Input
          label="UPI ID"
          hint="Customers pay this ID by scanning the QR. Check it carefully."
          value={o.upiVpa ?? ''}
          placeholder="yourcafe@okaxis"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => {
            setO({ ...o, upiVpa: e.target.value });
          }}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </SheetContent>
  );
}

/** The business name, GSTIN and GST scheme, used on every bill. */
export function BusinessSheet({
  orgId,
  open,
  onClose,
}: {
  orgId: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const details = useQuery({
    queryKey: ['business-details', orgId],
    enabled: open && orgId !== undefined,
    queryFn: () => fetchBusinessDetails(db, orgId ?? ''),
  });
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {details.data ? (
        <BusinessForm key={details.data.id} initial={details.data} onClose={onClose} />
      ) : (
        <SheetContent side="right" title="Business details">
          <p className="text-ink-2">Loading…</p>
        </SheetContent>
      )}
    </Sheet>
  );
}

function BusinessForm({ initial, onClose }: { initial: BusinessDetails; onClose: () => void }) {
  const [b, setB] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const saved = useSaved([['menu'], ['business-details']]);

  const save = async () => {
    const gstin = b.gstin?.trim().toUpperCase() ?? '';
    if (!b.name.trim()) {
      setError('Give the business a name.');
      return;
    }
    if (gstin && !GSTIN.test(gstin)) {
      setError('A GSTIN is 15 characters, like 23ABCDE1234F1Z5.');
      return;
    }
    setBusy(true);
    try {
      await updateBusinessDetails(db, b);
      toast({ title: 'Business details saved', tone: 'success' });
      saved();
      onClose();
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <SheetContent
      side="right"
      title="Business details"
      description="Printed on every bill."
      footer={
        <Button
          variant="accent"
          size="lg"
          busy={busy}
          className="w-full"
          onClick={() => void save()}
        >
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Input
          label="Business name"
          value={b.name}
          maxLength={120}
          onChange={(e) => {
            setB({ ...b, name: e.target.value });
          }}
        />
        <Input
          label="GSTIN (optional)"
          value={b.gstin ?? ''}
          maxLength={15}
          placeholder="23ABCDE1234F1Z5"
          autoCapitalize="characters"
          onChange={(e) => {
            setB({ ...b, gstin: e.target.value.toUpperCase() });
          }}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">GST scheme</legend>
          <Segmented
            label="GST scheme"
            value={b.gstScheme}
            options={[
              { value: 'regular', label: 'Regular' },
              { value: 'composition', label: 'Composition' },
            ]}
            onChange={(gstScheme) => {
              setB({ ...b, gstScheme });
            }}
          />
          <p className="text-sm text-ink-2">
            {b.gstScheme === 'regular'
              ? 'Bills are tax invoices, with CGST and SGST shown.'
              : 'Bills are bills of supply, with no tax shown. Ask your CA if unsure.'}
          </p>
        </fieldset>
        <Switch
          checked={b.pricesIncludeTax}
          onChange={(pricesIncludeTax) => {
            setB({ ...b, pricesIncludeTax });
          }}
          label="Menu prices include GST"
          text={
            b.pricesIncludeTax ? 'Menu prices include GST' : 'GST is added on top of menu prices'
          }
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </SheetContent>
  );
}
