import { brand } from '@repo/config/brand';
import { Button } from '@repo/ui';
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="flex flex-col items-start gap-3 p-6">
      <h1 className="font-display text-xl font-semibold">{brand.pos.name}</h1>
      <p className="text-ink-2">Billing comes next. The design system is ready to review.</p>
      <Button asChild variant="primary">
        <Link to="/playground">Open component playground</Link>
      </Button>
    </main>
  );
}
