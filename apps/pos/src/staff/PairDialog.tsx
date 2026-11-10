import {
  createPairingCode,
  formatPairingCode,
  FriendlyError,
  type ManagedOutlet,
  type PairingCode,
} from '@repo/db';
import { Button, Dialog, DialogContent, Input, Select } from '@repo/ui';
import { useEffect, useState } from 'react';
import { db } from '../lib/db.ts';

function useSecondsLeft(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [until]);
  return until ? Math.max(0, Math.round((Date.parse(until) - now) / 1000)) : 0;
}

/** Add a counter tablet: get a one-time code here, type it in on the tablet. */
export function PairDialog({
  open,
  outlets,
  onClose,
}: {
  open: boolean;
  outlets: ManagedOutlet[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open ? <PairBody outlets={outlets} onClose={onClose} /> : null}
    </Dialog>
  );
}

function PairBody({ outlets, onClose }: { outlets: ManagedOutlet[]; onClose: () => void }) {
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? '');
  const [label, setLabel] = useState('Counter tablet');
  const [pairing, setPairing] = useState<PairingCode>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const left = useSecondsLeft(pairing?.expiresAt);

  const getCode = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setPairing(await createPairingCode(db, outletId, label.trim()));
    } catch (e) {
      setError(
        e instanceof FriendlyError ? e.message : 'Couldn’t get a code. Check your connection.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (pairing) {
    const expired = left === 0;
    return (
      <DialogContent
        title="Type this code on the tablet"
        footer={
          expired ? (
            <Button variant="accent" size="lg" busy={busy} onClick={() => void getCode()}>
              Get a new code
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={onClose}>
              Done
            </Button>
          )
        }
      >
        <p
          className="num text-center font-display text-[44px] leading-none font-semibold tracking-[0.12em]"
          aria-label={`Pairing code ${pairing.code.split('').join(' ')}`}
        >
          {formatPairingCode(pairing.code)}
        </p>
        <p className="num text-center text-sm text-ink-2" aria-live="polite">
          {expired
            ? 'This code has expired.'
            : `Works once, for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} more`}
        </p>
        <ol className="flex flex-col gap-2 border-t border-line pt-3 text-base">
          <li>1. On the tablet, open Counter.</li>
          <li>2. Tap &ldquo;Setting up a counter tablet? Use a pairing code&rdquo;.</li>
          <li>3. Type the code. Staff can then sign in with their PIN.</li>
        </ol>
      </DialogContent>
    );
  }

  return (
    <DialogContent
      title="Add a counter tablet"
      description="You get a one-time code to type on the tablet. Your password never goes on it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="lg"
            busy={busy}
            disabled={!outletId || !label.trim()}
            onClick={() => void getCode()}
          >
            Get a code
          </Button>
        </>
      }
    >
      <Select
        label="Outlet"
        value={outletId}
        options={outlets.map((o) => ({ value: o.id, label: o.name }))}
        onChange={(e) => {
          setOutletId(e.target.value);
        }}
      />
      <Input
        label="Tablet name"
        hint="So you can tell tablets apart, e.g. Counter tablet or Kitchen screen."
        value={label}
        maxLength={60}
        onChange={(e) => {
          setLabel(e.target.value);
        }}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </DialogContent>
  );
}
