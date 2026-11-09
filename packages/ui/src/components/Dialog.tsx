import { Dialog as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cx } from '../cx.ts';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export interface DialogContentProps {
  title: string;
  description?: string;
  children?: ReactNode;
  /** Actions. Stacked on phones (primary on top), in a row on wider screens. */
  footer?: ReactNode;
  /** md for confirmations, lg for working dialogs (payment, item options). */
  size?: 'md' | 'lg';
  className?: string;
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <Primitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cx(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md',
          'flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-float outline-none',
          'data-[state=closed]:animate-fade-out data-[state=open]:animate-pop-in',
          className,
        )}
      >
        <div className="flex flex-col gap-1">
          <Primitive.Title className="text-lg font-semibold">{title}</Primitive.Title>
          {description ? (
            <Primitive.Description className="text-ink-2">{description}</Primitive.Description>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
