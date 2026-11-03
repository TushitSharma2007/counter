import { brand } from '@repo/config/brand';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="p-6">
      <h1>{brand.loyalty.name}</h1>
      <p>Tap the stamp at the counter to open your card.</p>
    </main>
  );
}
