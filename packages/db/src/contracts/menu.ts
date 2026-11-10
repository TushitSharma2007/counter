// What the menu editor sends to save_item / save_modifier_group. Shared by the POS form and the
// database call, so this file imports nothing but zod.
import { z } from 'zod';

const rupeesToPaise = z.number().int().nonnegative().max(10_000_000);

export const GST_SLABS_BP = [0, 500, 1_200, 1_800, 2_800] as const;

export const ItemInput = z
  .object({
    id: z.uuid().optional(),
    orgId: z.uuid(),
    categoryId: z.uuid({ error: 'Pick a category' }),
    name: z.string().trim().min(1, 'Give the item a name').max(80),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,6}$/, 'Up to 6 letters or numbers, like CC or HZL'),
    food: z.enum(['veg', 'nonveg', 'egg']),
    pricePaise: rupeesToPaise,
    taxRateBp: z.union(GST_SLABS_BP.map((n) => z.literal(n))),
    description: z.string().trim().max(300).optional(),
    isActive: z.boolean().default(true),
    variants: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Name the size').max(30),
          pricePaise: rupeesToPaise,
        }),
      )
      .default([]),
    modifierGroupIds: z.array(z.uuid()).default([]),
  })
  .superRefine((item, ctx) => {
    if (item.variants.length === 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Add at least two sizes, or use one price',
      });
    }
    const names = item.variants.map((v) => v.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Each size needs a different name',
      });
    }
  });
export type ItemInput = z.input<typeof ItemInput>;

export const ModifierGroupInput = z.object({
  id: z.uuid().optional(),
  orgId: z.uuid(),
  name: z.string().trim().min(1, 'Name the group, like Milk or Extras').max(40),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Name the add-on').max(40),
        pricePaise: rupeesToPaise,
      }),
    )
    .min(1, 'Add at least one option'),
});
export type ModifierGroupInput = z.input<typeof ModifierGroupInput>;
