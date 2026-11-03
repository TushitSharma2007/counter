import { Tabs as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cx } from '../cx.ts';

export const Tabs = Primitive.Root;

/** Scrolls sideways when tabs overflow (e.g. the category rail on a phone). */
export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cx('flex overflow-x-auto border-b border-line [scrollbar-width:none]', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cx(
        'relative h-tap shrink-0 px-4 text-base font-medium whitespace-nowrap text-ink-2',
        'transition-colors duration-100 data-[state=active]:text-ink',
        'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent after:opacity-0',
        'data-[state=active]:after:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content className={cx('pt-4 outline-none', className)} {...props} />;
}
