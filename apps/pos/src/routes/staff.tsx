import {
  getMe,
  listDevices,
  listManagedOutlets,
  listStaff,
  revokeDevice,
  type DeviceRow,
  type StaffMember,
} from '@repo/db';
import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  Icon,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@repo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowLeft, ChevronRight, Copy, Plus, Smartphone, Tablet } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';
import { ago } from '../lib/time.ts';
import { PairDialog } from '../staff/PairDialog.tsx';
import { StaffEditor } from '../staff/StaffEditor.tsx';

// Staff and devices. Owners manage everything; managers reset PINs of cashiers
// at their outlets and add or revoke tablets there.
export const Route = createFileRoute('/staff')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: '/' });
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: StaffPage,
});

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
  loyalty_staff: 'Loyalty',
};

function StaffPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => getMe(db) });
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const orgId = outlets.data?.[0]?.orgId;
  const isOwner = me.data?.role === 'owner';

  const staff = useQuery({
    queryKey: ['staff', orgId],
    enabled: orgId !== undefined,
    queryFn: () => listStaff(db, orgId ?? ''),
  });
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => listDevices(db) });

  const [editing, setEditing] = useState<StaffMember | 'new'>();
  const [pairing, setPairing] = useState(false);
  const [revoking, setRevoking] = useState<DeviceRow>();
  const [created, setCreated] = useState<{ name: string; email: string; tempPassword: string }>();

  const outletName = (id: string) => outlets.data?.find((o) => o.id === id)?.name ?? '';

  const revoke = async (device: DeviceRow) => {
    try {
      await revokeDevice(db, device.id);
      toast({
        title: 'Device revoked',
        description: `${device.code} · ${device.label}`,
        tone: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    } catch {
      toast({
        title: 'Couldn’t revoke',
        description: 'Check your connection and try again.',
        tone: 'danger',
      });
    }
    setRevoking(undefined);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-2 bg-ink px-2 text-canvas md:px-4">
        <Link
          to="/home"
          className="flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium active:bg-canvas/10"
        >
          <Icon icon={ArrowLeft} size={18} />
          My outlets
        </Link>
        <span className="ml-2 font-display text-lg font-semibold">Staff &amp; devices</span>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5">
        <Tabs defaultValue="staff">
          <TabsList aria-label="Staff and devices">
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="devices">Counter tablets</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-2">
                {isOwner
                  ? 'Add staff, give them a PIN, and choose where they work.'
                  : 'You can reset PINs for cashiers at your outlets.'}
              </p>
              {isOwner ? (
                <Button
                  variant="accent"
                  onClick={() => {
                    setEditing('new');
                  }}
                >
                  <Icon icon={Plus} size={18} />
                  Add staff
                </Button>
              ) : null}
            </div>

            {staff.isPending ? <p className="text-ink-2">Loading staff…</p> : null}
            <ul className="overflow-hidden rounded-lg border border-line bg-surface">
              {staff.data?.map((member) => (
                <li key={member.membershipId} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    disabled={member.role === 'owner' && !isOwner}
                    onClick={() => {
                      setEditing(member);
                    }}
                    className="flex min-h-[72px] w-full items-center gap-3 px-4 py-2 text-left active:bg-sunken"
                  >
                    <Avatar
                      name={member.name}
                      id={member.membershipId}
                      size={44}
                      className={member.isActive ? '' : 'opacity-50'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{member.name}</span>
                        <span className="text-sm text-ink-2">{ROLE_LABEL[member.role]}</span>
                        {!member.isActive ? (
                          <StatusPill tone="neutral" className="!h-6">
                            Switched off
                          </StatusPill>
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-ink-2">
                        {member.role === 'owner'
                          ? 'All outlets'
                          : member.outletIds.map(outletName).filter(Boolean).join(', ')}
                      </span>
                    </span>
                    {member.role !== 'owner' && member.isActive ? (
                      member.hasPin ? (
                        <StatusPill tone="success" className="hidden !h-6 sm:inline-flex">
                          PIN set
                        </StatusPill>
                      ) : (
                        <StatusPill tone="warning" className="!h-6">
                          No PIN
                        </StatusPill>
                      )
                    ) : null}
                    <Icon icon={ChevronRight} className="text-ink-2" />
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="devices" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-2">Tablets at your counters, and phones people bill from.</p>
              <Button
                variant="accent"
                onClick={() => {
                  setPairing(true);
                }}
              >
                <Icon icon={Plus} size={18} />
                Add a counter tablet
              </Button>
            </div>
            {outlets.data?.map((outlet) => {
              const here = (devices.data ?? []).filter((d) => d.outletId === outlet.id);
              return (
                <section key={outlet.id} aria-label={outlet.name}>
                  <h2 className="border-b border-line-strong pb-2 font-semibold">{outlet.name}</h2>
                  {here.length === 0 ? <p className="py-3 text-ink-2">No tablets yet.</p> : null}
                  <ul>
                    {here.map((device) => (
                      <li
                        key={device.id}
                        className="flex min-h-16 items-center gap-3 border-b border-line py-2"
                      >
                        <span className="num grid size-10 shrink-0 place-items-center rounded-md bg-ink text-sm font-semibold text-canvas">
                          {device.code}
                        </span>
                        <Icon
                          icon={device.kind === 'counter' ? Tablet : Smartphone}
                          className="shrink-0 text-ink-2"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{device.label}</span>
                          <span className="block text-sm text-ink-2">
                            {device.kind === 'counter'
                              ? 'Shared counter tablet'
                              : `${device.ownerName ?? 'Someone'}’s own phone`}
                            {' · '}
                            {device.lastSeenAt ? `seen ${ago(device.lastSeenAt)}` : 'not used yet'}
                          </span>
                        </span>
                        {device.revokedAt ? (
                          <StatusPill tone="neutral" className="!h-6">
                            Revoked
                          </StatusPill>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-11"
                            onClick={() => {
                              setRevoking(device);
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </TabsContent>
        </Tabs>
      </main>

      {orgId ? (
        <StaffEditor
          open={editing !== undefined}
          member={editing === 'new' ? undefined : editing}
          orgId={orgId}
          outlets={outlets.data ?? []}
          canEdit={isOwner}
          onClose={() => {
            setEditing(undefined);
          }}
          onSaved={(info) => {
            setEditing(undefined);
            if (info) setCreated(info);
            void queryClient.invalidateQueries({ queryKey: ['staff'] });
          }}
        />
      ) : null}

      <PairDialog
        open={pairing}
        outlets={outlets.data ?? []}
        onClose={() => {
          setPairing(false);
          void queryClient.invalidateQueries({ queryKey: ['devices'] });
        }}
      />

      <Dialog
        open={revoking !== undefined}
        onOpenChange={(next) => {
          if (!next) setRevoking(undefined);
        }}
      >
        {revoking ? (
          <DialogContent
            title={`Revoke ${revoking.code} · ${revoking.label}?`}
            description="It stops working straight away. Its bills stay. To use it again, add it as a new tablet."
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRevoking(undefined);
                  }}
                >
                  Keep it
                </Button>
                <Button variant="danger" onClick={() => void revoke(revoking)}>
                  Revoke
                </Button>
              </>
            }
          />
        ) : null}
      </Dialog>

      <Dialog
        open={created !== undefined}
        onOpenChange={(next) => {
          if (!next) setCreated(undefined);
        }}
      >
        {created ? (
          <DialogContent
            title={`${created.name} can sign in with email`}
            description="This password is shown only once. Share it with them in person or on WhatsApp."
            footer={
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setCreated(undefined);
                }}
              >
                Done
              </Button>
            }
          >
            <dl className="flex flex-col gap-2 rounded-md bg-sunken p-4">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Email</dt>
                <dd className="truncate font-medium">{created.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-2">Password</dt>
                <dd className="num font-semibold tracking-wide">{created.tempPassword}</dd>
              </div>
            </dl>
            <Button
              className="self-start"
              onClick={() => {
                void navigator.clipboard.writeText(`${created.email}\n${created.tempPassword}`);
                toast({ title: 'Copied' });
              }}
            >
              <Icon icon={Copy} size={18} />
              Copy both
            </Button>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
