import { brand } from '@repo/config/brand';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  formatINR,
  Icon,
  Input,
  NumberPad,
  PriceTag,
  Sheet,
  SheetContent,
  SheetTrigger,
  StatusPill,
  SyncIndicator,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
} from '@repo/ui';
import { createFileRoute } from '@tanstack/react-router';
import { Minus, Plus, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export const Route = createFileRoute('/playground')({
  component: Playground,
});

const MENU = {
  'Hot Coffee': [
    ['Cappuccino', 14900],
    ['Hazelnut Latte', 17900],
    ['Americano', 12900],
  ],
  'Cold Coffee': [
    ['Cold Coffee', 14900],
    ['Iced Mocha', 18900],
  ],
  Tea: [
    ['Masala Chai', 4900],
    ['Lemon Iced Tea', 9900],
  ],
  Snacks: [
    ['Veg Puff', 3900],
    ['Paneer Sandwich', 11900],
  ],
} as const satisfies Record<string, readonly (readonly [string, number])[]>;

const TOP_ITEMS = [
  ['Cold Coffee', 84, 12_51_600],
  ['Hazelnut Latte', 61, 10_91_900],
  ['Masala Chai', 142, 6_95_800],
  ['Veg Puff', 97, 3_78_300],
  ['Paneer Sandwich', 23, 2_73_700],
] as const;

const CART = [
  ['Hazelnut Latte', 'Large, oat milk', 1, 21900],
  ['Masala Chai', null, 2, 4900],
  ['Veg Puff', null, 1, 3900],
] as const;
const CART_TOTAL = CART.reduce((sum, [, , qty, price]) => sum + qty * price, 0);

const ACCENTS = [
  ['Ink', '#2c4a7c'],
  ['Pine', '#285e52'],
  ['Clay', '#a4512b'],
] as const;

function Playground() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [accent, setAccent] = useState<string>(ACCENTS[0][1]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--brand', accent);
  }, [accent]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold">{brand.pos.name}</span>
            <span className="text-ink-2">Components</span>
          </p>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Tenant accent">
              {ACCENTS.map(([name, hex]) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`${name} accent`}
                  aria-pressed={accent === hex}
                  onClick={() => {
                    setAccent(hex);
                  }}
                  className="group flex size-tap items-center justify-center rounded-full"
                >
                  <span
                    className="size-6 rounded-full ring-ink ring-offset-2 ring-offset-canvas group-aria-pressed:ring-2"
                    style={{ background: hex }}
                  />
                </button>
              ))}
            </div>
            <div
              className="flex rounded-md border border-line-strong p-0.5"
              role="group"
              aria-label="Theme"
            >
              {(['light', 'dark'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => {
                    setTheme(value);
                  }}
                  className="h-10 rounded-sm px-3 text-sm font-medium text-ink-2 aria-pressed:bg-ink aria-pressed:text-canvas"
                >
                  {value === 'light' ? 'Light' : 'Night'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <Section
          title="Colour and type"
          note="Paper and espresso ink. One accent per tenant; colour otherwise means state."
        >
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
              <Swatch name="Canvas" className="bg-canvas" />
              <Swatch name="Surface" className="bg-surface" />
              <Swatch name="Sunken" className="bg-sunken" />
              <Swatch name="Ink" className="bg-ink" />
              <Swatch name="Ink 2" className="bg-ink-2" />
              <Swatch name="Accent" className="bg-accent" />
              <Swatch name="Paid" className="bg-success" />
              <Swatch name="Pending" className="bg-warning" />
              <Swatch name="Void" className="bg-danger" />
            </div>
            <div className="flex flex-col gap-1 border-t border-line pt-5">
              <p className="text-sm text-ink-2">Today, all outlets</p>
              <PriceTag paise={1_24_58_000} size="xl" />
              <p className="font-display text-xl">Hazelnut Latte, large</p>
              <p className="max-w-prose text-ink-2">
                Geist for the interface, Fraunces for headings and big numbers. Every price and
                quantity uses tabular figures, so columns line up: ₹1,111 and ₹8,888 are the same
                width.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Button"
          note="48px tall by default, 56px for the main action. Pressed states, never hover-only."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" size="lg">
                Pay {formatINR(CART_TOTAL)}
              </Button>
              <Button variant="primary">Hold bill</Button>
              <Button>Add note</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Void bill</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button busy>Printing</Button>
              <Button disabled>Day closed</Button>
              <Button size="sm">Export CSV</Button>
              <span className="text-sm text-ink-2">
                Small size is for back-office screens only.
              </span>
            </div>
          </div>
        </Section>

        <Section
          title="Input"
          note="Label above, hint or error below. Numeric fields get the number keyboard."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Search menu"
              hideLabel
              placeholder="Search menu  /"
              prefix={<Icon icon={Search} size={18} />}
            />
            <Input
              label="Customer phone"
              prefix="+91"
              numeric
              placeholder="98260 12345"
              hint="Links their loyalty card"
            />
            <Input
              label="Bill discount"
              prefix="₹"
              numeric
              defaultValue="80"
              error="Cashiers can give up to ₹50. Ask a manager."
            />
            <Input label="Note for kitchen" placeholder="Less sugar" />
          </div>
        </Section>

        <Section
          title="Number pad"
          note="Cash, quantity and PIN entry. Also takes keyboard digits, Backspace and Enter."
        >
          <CashDemo />
        </Section>

        <Section
          title="Price tag"
          note="Integer paise in, rupees out. Lakh grouping; .00 only on bills."
        >
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <PriceTag paise={4900} size="sm" />
            <PriceTag paise={14900} wasPaise={17900} />
            <PriceTag paise={1_24_050} size="lg" decimals="always" />
            <PriceTag paise={1_24_58_000} size="xl" />
          </div>
        </Section>

        <Section
          title="Status"
          note="Colour only for state. The dot keeps it readable without colour."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="success">Paid</StatusPill>
              <StatusPill tone="warning">Pending</StatusPill>
              <StatusPill tone="danger">Void</StatusPill>
              <StatusPill tone="warning">Low stock</StatusPill>
              <StatusPill tone="accent">New</StatusPill>
              <StatusPill tone="neutral">Served</StatusPill>
            </div>
            <div className="flex flex-wrap gap-2">
              <SyncIndicator state="live" />
              <SyncIndicator state="syncing" queued={2} />
              <SyncIndicator state="offline" queued={3} />
            </div>
          </div>
        </Section>

        <Section title="Tabs" note="The category rail. Scrolls sideways on a phone.">
          <Tabs defaultValue="Hot Coffee">
            <TabsList aria-label="Menu categories">
              {Object.keys(MENU).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(MENU).map(([category, items]) => (
              <TabsContent key={category} value={category}>
                <ul>
                  {items.map(([name, price]) => (
                    <li
                      key={name}
                      className="flex h-tap items-center justify-between border-b border-line last:border-0"
                    >
                      <span>{name}</span>
                      <PriceTag paise={price} />
                    </li>
                  ))}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
        </Section>

        <Section title="Table" note="Dense, hairline rules, numbers right-aligned.">
          <Table>
            <caption className="sr-only">Top items today</caption>
            <THead>
              <Tr>
                <Th>Item</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Sales</Th>
              </Tr>
            </THead>
            <TBody>
              {TOP_ITEMS.map(([name, qty, sales]) => (
                <Tr key={name}>
                  <Td>{name}</Td>
                  <Td numeric>{qty}</Td>
                  <Td numeric>{formatINR(sales)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Section>

        <Section
          title="Sheet, dialog, toast"
          note="The cart is a bottom sheet on phones. Destructive actions confirm in a dialog."
        >
          <div className="flex flex-wrap gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="primary">Open cart</Button>
              </SheetTrigger>
              <SheetContent
                title="Bill"
                description="Counter, Arera Colony"
                footer={
                  <Button variant="accent" size="lg" className="w-full">
                    Pay {formatINR(CART_TOTAL)}
                  </Button>
                }
              >
                <ul>
                  {CART.map(([name, detail, qty, price]) => (
                    <li
                      key={name}
                      className="flex items-center gap-3 border-b border-line py-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{name}</p>
                        {detail ? <p className="text-sm text-ink-2">{detail}</p> : null}
                      </div>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          aria-label={`One less ${name}`}
                          className="w-tap px-0"
                        >
                          <Icon icon={Minus} size={18} />
                        </Button>
                        <span className="num w-6 text-center">{qty}</span>
                        <Button
                          variant="ghost"
                          aria-label={`One more ${name}`}
                          className="w-tap px-0"
                        >
                          <Icon icon={Plus} size={18} />
                        </Button>
                      </div>
                      <PriceTag paise={qty * price} className="w-16 justify-end" />
                    </li>
                  ))}
                </ul>
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <Button>Side panel</Button>
              </SheetTrigger>
              <SheetContent side="right" title="Order BR1-T2/2526/000123">
                <p className="text-ink-2">Order details, payments and reprint go here.</p>
              </SheetContent>
            </Sheet>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="danger">Void bill</Button>
              </DialogTrigger>
              <DialogContent
                title="Void bill BR1-T2/2526/000123?"
                description="The bill stays in reports as void. A manager PIN is needed."
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="ghost">Keep bill</Button>
                    </DialogClose>
                    <Button variant="danger">Void bill</Button>
                  </>
                }
              >
                <Input label="Reason" placeholder="Customer cancelled" />
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => {
                toast({
                  title: 'Bill paid',
                  description: `${formatINR(CART_TOTAL)} by UPI`,
                  tone: 'success',
                });
              }}
            >
              Toast: paid
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: 'Printer not found',
                  description: 'Check that it is on and paired.',
                  tone: 'danger',
                  action: { label: 'Retry', onPress: () => undefined },
                });
              }}
            >
              Toast: error
            </Button>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-8 md:grid-cols-[13rem_1fr] md:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-ink-2">{note}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`size-10 shrink-0 rounded-md border border-line ${className}`} />
      <span className="text-sm">{name}</span>
    </div>
  );
}

function CashDemo() {
  const [cash, setCash] = useState('500');
  const receivedPaise = Number(cash || '0') * 100;
  const change = receivedPaise - CART_TOTAL;

  return (
    <div className="grid max-w-2xl gap-6 sm:grid-cols-[1fr_16rem]">
      <dl className="flex flex-col">
        <Row label="Bill">
          <PriceTag paise={CART_TOTAL} size="lg" />
        </Row>
        <Row label="Cash received">
          <PriceTag paise={receivedPaise} size="lg" />
        </Row>
        <Row label={change >= 0 ? 'Change to return' : 'Still to pay'}>
          <PriceTag
            paise={Math.abs(change)}
            size="lg"
            className={change >= 0 ? 'text-success' : 'text-danger'}
          />
        </Row>
      </dl>
      <NumberPad
        label="Cash received"
        value={cash}
        onChange={setCash}
        doubleZero
        maxLength={6}
        captureKeyboard
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-3 last:border-0">
      <dt className="text-ink-2">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
