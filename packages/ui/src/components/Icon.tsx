import type { LucideIcon } from 'lucide-react';

/** One stroke weight across the product. */
export const ICON_STROKE = 1.75;

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  /** Set only when the icon carries meaning on its own; otherwise it is hidden from screen readers. */
  label?: string;
}

export function Icon({ icon: Glyph, size = 20, className, label }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={ICON_STROKE}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}
