import {
  createStaff,
  FriendlyError,
  setStaffPin,
  StaffCreateRequest,
  updateStaff,
  type ManagedOutlet,
  type StaffMember,
} from '@repo/db';
import { Button, cx, Input, Segmented, Sheet, SheetContent, Switch, toast } from '@repo/ui';
import { useState } from 'react';
import { db } from '../lib/db.ts';

type Role = 'manager' | 'cashier' | 'kitchen';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'manager', label: 'Manager' },
];

export interface StaffEditorProps {
  open: boolean;
  /** Someone to edit; a new staff member when undefined. */
  member: StaffMember | undefined;
  orgId: string;
  outlets: ManagedOutlet[];
  /** Managers can only reset PINs. */
  canEdit: boolean;
  onClose: () => void;
  onSaved: (created?: { name: string; email: string; tempPassword: string }) => void;
}

export function StaffEditor(props: StaffEditorProps) {
  return (
    <Sheet
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      {props.open ? <EditorBody key={props.member?.membershipId ?? 'new'} {...props} /> : null}
    </Sheet>
  );
}

function EditorBody({ member, orgId, outlets, canEdit, onClose, onSaved }: StaffEditorProps) {
  const isOwnerRow = member?.role === 'owner';
  const [name, setName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [role, setRole] = useState<Role>(
    member && member.role !== 'owner' && member.role !== 'loyalty_staff' ? member.role : 'cashier',
  );
  const [outletIds, setOutletIds] = useState<string[]>(
    member?.outletIds ?? (outlets.length === 1 && outlets[0] ? [outlets[0].id] : []),
  );
  const [pin, setPin] = useState('');
  const [emailLogin, setEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const toggleOutlet = (id: string) => {
    setOutletIds(outletIds.includes(id) ? outletIds.filter((o) => o !== id) : [...outletIds, id]);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (pin && !/^\d{4}$/.test(pin)) errs.pin = 'PINs are 4 digits';

    if (!member) {
      const request: StaffCreateRequest = {
        orgId,
        name,
        role,
        outletIds,
        ...(phone.trim() ? { phone } : {}),
        ...(pin ? { pin } : {}),
        ...(role === 'manager' && emailLogin ? { email: email.trim() } : {}),
      };
      const parsed = StaffCreateRequest.safeParse(request);
      if (!parsed.success)
        for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      if (!pin && !(role === 'manager' && emailLogin) && !('pin' in errs)) {
        errs.pin = 'Give them a PIN so they can sign in at the counter';
      }
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;

      setBusy(true);
      try {
        const created = await createStaff(db, request);
        toast({ title: 'Staff added', description: name.trim(), tone: 'success' });
        onSaved(
          created.tempPassword
            ? { name: name.trim(), email: email.trim(), tempPassword: created.tempPassword }
            : undefined,
        );
      } catch (error) {
        setErrors({
          form: error instanceof FriendlyError ? error.message : 'Couldn’t add them. Try again.',
        });
        setBusy(false);
      }
      return;
    }

    if (canEdit && !name.trim()) errs.name = 'Give their name';
    if (canEdit && !isOwnerRow && outletIds.length === 0)
      errs.outletIds = 'Pick at least one outlet';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      if (canEdit) {
        await updateStaff(db, {
          membershipId: member.membershipId,
          name,
          phone: phone.trim() || null,
          ...(isOwnerRow ? {} : { role, outletIds, isActive }),
        });
      }
      if (pin) await setStaffPin(db, member.membershipId, pin);
      toast({ title: 'Saved', description: name.trim(), tone: 'success' });
      onSaved();
    } catch (error) {
      setErrors({
        form: error instanceof FriendlyError ? error.message : 'Couldn’t save. Try again.',
      });
      setBusy(false);
    }
  };

  return (
    <SheetContent
      side="right"
      title={member ? member.name : 'Add staff'}
      {...(member && !canEdit ? { description: 'You can reset their PIN.' } : {})}
      footer={
        <div className="flex flex-col gap-2">
          {errors.form ? <p className="text-sm text-danger">{errors.form}</p> : null}
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
              {member ? 'Save' : 'Add staff'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-4">
        {canEdit ? (
          <>
            <Input
              label="Name"
              value={name}
              maxLength={120}
              placeholder="Neha Rao"
              onChange={(e) => {
                setName(e.target.value);
              }}
              {...(errors.name ? { error: errors.name } : {})}
            />
            <Input
              label="Mobile (optional)"
              prefix="+91"
              numeric
              inputMode="tel"
              value={phone}
              placeholder="98260 12345"
              onChange={(e) => {
                setPhone(e.target.value);
              }}
              {...(errors.phone ? { error: errors.phone } : {})}
            />
          </>
        ) : null}

        {canEdit && !isOwnerRow ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium text-ink-2">Role</legend>
              <Segmented label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
              <p className="text-sm text-ink-2">
                {role === 'manager'
                  ? 'Bills, marks items sold out, resets cashier PINs and adds tablets at their outlets.'
                  : role === 'kitchen'
                    ? 'Works the kitchen screen.'
                    : 'Bills at the counter.'}
              </p>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium text-ink-2">Works at</legend>
              {outlets.map((outlet) => {
                const on = outletIds.includes(outlet.id);
                return (
                  <label
                    key={outlet.id}
                    className={cx(
                      'flex h-14 cursor-pointer items-center gap-3 rounded-md border px-3',
                      on ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        toggleOutlet(outlet.id);
                      }}
                      className="size-5 accent-(--accent)"
                    />
                    <span className="flex-1 font-medium">{outlet.name}</span>
                    <span className="num text-sm text-ink-2">{outlet.code}</span>
                  </label>
                );
              })}
              {errors.outletIds ? <p className="text-sm text-danger">{errors.outletIds}</p> : null}
            </fieldset>
          </>
        ) : null}

        {!isOwnerRow ? (
          <Input
            label={member ? (member.hasPin ? 'New PIN' : 'PIN') : 'PIN'}
            hint={
              errors.pin
                ? undefined
                : member?.hasPin
                  ? 'Leave blank to keep their PIN'
                  : '4 digits, not 1111 or 1234. Tell them in person.'
            }
            numeric
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
            }}
            {...(errors.pin ? { error: errors.pin } : {})}
          />
        ) : null}

        {!member && role === 'manager' ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Switch
              checked={emailLogin}
              onChange={setEmailLogin}
              label="Can also sign in with email"
              text="Can also sign in with email (menu, staff, their own phone)"
            />
            {emailLogin ? (
              <Input
                label="Email"
                type="email"
                inputMode="email"
                value={email}
                placeholder="vikram@yourcafe.in"
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                {...(errors.email ? { error: errors.email } : {})}
              />
            ) : null}
          </div>
        ) : null}

        {member?.email ? <p className="text-sm text-ink-2">Signs in with {member.email}</p> : null}

        {member && canEdit && !isOwnerRow ? (
          <div className="border-t border-line pt-2">
            <Switch
              checked={isActive}
              onChange={setIsActive}
              label="Can sign in"
              text={isActive ? 'Can sign in' : 'Switched off (past bills keep their name)'}
            />
          </div>
        ) : null}
      </div>
    </SheetContent>
  );
}
