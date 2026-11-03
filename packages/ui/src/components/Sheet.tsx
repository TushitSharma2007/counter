import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';

export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;

export interface SheetContentProps {
  /** 'bottom' for phones (e.g. the cart), 'right' for tablet and desktop panels. */
  side?: 'bottom' | 'right';
  title: string;
  description?: string;
  children: ReactNode;
  /** Pinned below the scrolling body, e.g. the Pay button. */
  footer?: ReactNode;
  className?: string;
}

export function SheetContent({
  side = 'bottom',
  title,
  description,
  children,
  footer,
  className,
}: SheetContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <Primitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cx(
          'fixed z-50 flex flex-col bg-surface shadow-float outline-none',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-lg pb-[env(safe-area-inset-bottom)] data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up'
            : 'inset-y-0 right-0 w-full max-w-md data-[state=closed]:animate-sheet-right data-[state=open]:animate-sheet-left',
          className,
        )}
      >
        {side === 'bottom' ? (
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
        ) : null}
        <header className="flex items-start gap-3 border-b border-line py-2 pr-2 pl-4">
          <div className="min-w-0 flex-1 py-2">
            <Primitive.Title className="text-md font-semibold">{title}</Primitive.Title>
            {description ? (
              <Primitive.Description className="text-sm text-ink-2">
                {description}
              </Primitive.Description>
            ) : null}
          </div>
          <Primitive.Close asChild>
            <Button variant="ghost" aria-label="Close" className="w-tap px-0">
              <Icon icon={X} />
            </Button>
          </Primitive.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? <footer className="border-t border-line px-4 py-3">{footer}</footer> : null}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
