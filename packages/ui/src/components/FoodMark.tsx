import { cx } from '../cx.ts';

export type FoodType = 'veg' | 'nonveg' | 'egg';

const LABEL: Record<FoodType, string> = { veg: 'Veg', nonveg: 'Non-veg', egg: 'Contains egg' };
const COLOR: Record<FoodType, string> = {
  veg: 'border-veg text-veg',
  nonveg: 'border-nonveg text-nonveg',
  egg: 'border-egg text-egg',
};

/** The Indian food mark: a square outline with a dot (veg, egg) or a triangle (non-veg). */
export function FoodMark({
  type,
  size = 14,
  className,
}: {
  type: FoodType;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={LABEL[type]}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-[2px] border-[1.5px]',
        COLOR[type],
        className,
      )}
      style={{ width: size, height: size }}
    >
      {type === 'nonveg' ? (
        <svg viewBox="0 0 10 10" width={size * 0.55} height={size * 0.55} aria-hidden>
          <path d="M5 1 9.3 9H.7z" fill="currentColor" />
        </svg>
      ) : (
        <span
          className="rounded-full bg-current"
          style={{ width: size * 0.45, height: size * 0.45 }}
        />
      )}
    </span>
  );
}
