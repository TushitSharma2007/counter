/** Joins class names, skipping falsy ones. (No tailwind-merge: it would cost the loyalty bundle ~7 KB.) */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
