// Design system: tokens (tokens.css, theme.css), components and icons. The only place styles are defined.
export { cx } from './cx.ts';
export { formatINR, type FormatInrOptions } from './logic/money.ts';
export { applyPadKey, type PadKey } from './logic/numpad.ts';
export { syncLabel, type SyncState } from './logic/sync.ts';

export { Avatar, avatarTint, initials, type AvatarProps } from './components/Avatar.tsx';

export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './components/Button.tsx';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  type DialogContentProps,
} from './components/Dialog.tsx';
export { FoodMark, type FoodType } from './components/FoodMark.tsx';
export { Icon, ICON_STROKE, type IconProps } from './components/Icon.tsx';
export { Input, type InputProps } from './components/Input.tsx';
export { NumberPad, type NumberPadProps } from './components/NumberPad.tsx';
export { PriceTag, type PriceTagProps, type PriceTagSize } from './components/PriceTag.tsx';
export { Segmented, type SegmentedOption, type SegmentedProps } from './components/Segmented.tsx';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  type SheetContentProps,
} from './components/Sheet.tsx';
export { StatusPill, type StatusPillProps, type StatusTone } from './components/StatusPill.tsx';
export { SyncIndicator, type SyncIndicatorProps } from './components/SyncIndicator.tsx';
export { Table, TBody, Td, Th, THead, Tr } from './components/Table.tsx';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/Tabs.tsx';
export { toast, Toaster, type ToastOptions, type ToastTone } from './components/Toast.tsx';
