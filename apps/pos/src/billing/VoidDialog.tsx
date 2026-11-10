import { checkPinOffline, type StoredBill } from '@repo/db';
import { Avatar, Button, cx, Dialog, DialogContent, formatINR, Input, NumberPad } from '@repo/ui';
import { useState } from 'react';

export interface Approver {
  membershipId: string;
  name: string;
  /** Managers at a counter tablet confirm with their PIN (checked here, works offline). */
  pinHash?: string;
}

const REASONS = ['Customer cancelled', 'Wrong item billed', 'Billing mistake', 'Payment failed'];

/** Void a bill: a reason, and a manager's PIN (or the owner, on their own phone). */
export function VoidDialog({
  bill,
  approvers,
  self,
  onClose,
  onVoid,
}: {
  bill: StoredBill | undefined;
  /** Managers who can approve at this outlet (counter tablets). */
  approvers: Approver[];
  /** The signed-in owner or manager on their own phone approves as themselves. */
  self?: Approver;
  onClose: () => void;
  onVoid: (v: { reason: string; approvedBy: string; approvedByName: string }) => void;
}) {
  return (
    <Dialog
      open={bill !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {bill ? (
        <VoidBody
          key={bill.id}
          bill={bill}
          approvers={approvers}
          {...(self ? { self } : {})}
          onVoid={onVoid}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function VoidBody({
  bill,
  approvers,
  self,
  onVoid,
  onClose,
}: {
  bill: StoredBill;
  approvers: Approver[];
  self?: Approver;
  onVoid: (v: { reason: string; approvedBy: string; approvedByName: string }) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [approver, setApprover] = useState<Approver | undefined>(
    self ?? (approvers.length === 1 ? approvers[0] : undefined),
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const reasonOk = reason.trim().length >= 3;

  const approve = async (typed: string) => {
    if (!approver?.pinHash || !reasonOk) return;
    setChecking(true);
    const ok = await checkPinOffline(typed, approver.pinHash);
    setChecking(false);
    if (ok)
      onVoid({
        reason: reason.trim(),
        approvedBy: approver.membershipId,
        approvedByName: approver.name,
      });
    else {
      setError('Wrong PIN.');
      setPin('');
    }
  };

  return (
    <DialogContent
      title={`Void ${bill.payload.billNumber}?`}
      description={`${formatINR(bill.payload.totals.totalPaise)}. The bill stays in reports, marked void.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep bill
          </Button>
          {self ? (
            <Button
              variant="danger"
              size="lg"
              disabled={!reasonOk}
              onClick={() => {
                onVoid({
                  reason: reason.trim(),
                  approvedBy: self.membershipId,
                  approvedByName: self.name,
                });
              }}
            >
              Void bill
            </Button>
          ) : null}
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Why?</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => {
                setReason(r);
              }}
              className={cx(
                'h-11 rounded-full border px-4 text-sm font-medium',
                reason === r ? 'border-ink bg-ink text-canvas' : 'border-line-strong bg-surface',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Input
          label="Reason"
          hideLabel
          placeholder="Or type the reason"
          value={REASONS.includes(reason) ? '' : reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
        />
      </fieldset>

      {self ? null : approvers.length === 0 ? (
        <p className="rounded-md bg-warning-soft p-3 text-warning">
          No manager at this outlet has a PIN on this tablet. The owner can void it from their own
          phone.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Manager approving</legend>
            {approvers.map((a) => (
              <button
                key={a.membershipId}
                type="button"
                aria-pressed={approver?.membershipId === a.membershipId}
                onClick={() => {
                  setApprover(a);
                  setPin('');
                  setError(undefined);
                }}
                className={cx(
                  'flex h-14 items-center gap-3 rounded-md border px-3 text-left font-medium',
                  approver?.membershipId === a.membershipId
                    ? 'border-accent bg-accent-soft'
                    : 'border-line-strong bg-surface',
                )}
              >
                <Avatar name={a.name} id={a.membershipId} size={36} />
                {a.name}
              </button>
            ))}
            <p role="alert" className="min-h-5 text-sm text-danger">
              {!reasonOk && pin ? 'Pick or type a reason first.' : error}
            </p>
          </fieldset>
          {approver ? (
            <NumberPad
              label={`Manager PIN for ${approver.name}`}
              value={pin}
              maxLength={4}
              keepLeadingZeros
              captureKeyboard={!checking}
              onChange={(next) => {
                setPin(next);
                setError(undefined);
                if (next.length === 4) void approve(next);
              }}
            />
          ) : null}
        </div>
      )}
    </DialogContent>
  );
}
