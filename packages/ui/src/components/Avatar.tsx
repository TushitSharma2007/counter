import { cx } from '../cx.ts';

const TINTS = ['--avatar-1', '--avatar-2', '--avatar-3', '--avatar-4', '--avatar-5', '--avatar-6'];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Same person, same tint, on every device: picked from a hash of a stable id. */
export function avatarTint(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(${TINTS[hash % TINTS.length] ?? '--avatar-1'})`;
}

export interface AvatarProps {
  name: string;
  /** Stable id for the tint (membership id); falls back to the name. */
  id?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, id, size = 48, className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-semibold text-[#1e1916]',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: avatarTint(id ?? name),
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </span>
  );
}
