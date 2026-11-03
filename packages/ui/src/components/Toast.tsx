import { CircleAlert, CircleCheck } from 'lucide-react';
import { Toast as Primitive } from 'radix-ui';
import { useSyncExternalStore } from 'react';
import { cx } from '../cx.ts';
import { Icon } from './Icon.tsx';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastOptions {
  /** Short and human: "Bill paid", "Day closed". */
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onPress: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  open: boolean;
}

const MAX_VISIBLE = 3;
const EXIT_MS = 150;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return items;
}

function dismiss(id: number) {
  items = items.map((item) => (item.id === id ? { ...item, open: false } : item));
  emit();
  setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, EXIT_MS);
}

/** Shows a toast. Render <Toaster /> once near the app root. */
export function toast(options: ToastOptions): void {
  items = [...items, { ...options, id: nextId++, open: true }].slice(-MAX_VISIBLE);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <Primitive.Provider swipeDirection="down" duration={3500}>
      {list.map((item) => (
        <Primitive.Root
          key={item.id}
          open={item.open}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className={cx(
            'flex items-start gap-3 rounded-lg border border-line bg-surface py-3 pr-2 pl-3 shadow-float',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-pop-in',
            'data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y)',
          )}
        >
          {item.tone === 'success' ? (
            <Icon icon={CircleCheck} className="mt-0.5 shrink-0 text-success" />
          ) : item.tone === 'danger' ? (
            <Icon icon={CircleAlert} className="mt-0.5 shrink-0 text-danger" />
          ) : null}
          <div className="min-w-0 flex-1 py-0.5">
            <Primitive.Title className="font-medium">{item.title}</Primitive.Title>
            {item.description ? (
              <Primitive.Description className="text-sm text-ink-2">
                {item.description}
              </Primitive.Description>
            ) : null}
          </div>
          {item.action ? (
            <Primitive.Action
              altText={item.action.label}
              onClick={item.action.onPress}
              className="h-9 shrink-0 rounded-md px-3 text-sm font-medium text-accent active:bg-sunken"
            >
              {item.action.label}
            </Primitive.Action>
          ) : null}
        </Primitive.Root>
      ))}
      <Primitive.Viewport className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 outline-none sm:right-auto sm:w-96" />
    </Primitive.Provider>
  );
}
