import { createFileRoute } from '@tanstack/react-router';

// The customer's card: the first route, held to the 120 KB gzipped JS budget (scripts/check-bundle-size.js).
export const Route = createFileRoute('/c/$merchantSlug')({
  component: Card,
});

function Card() {
  const { merchantSlug } = Route.useParams();
  return (
    <main className="p-6">
      <h1>{merchantSlug}</h1>
      <p>Your card will show here.</p>
    </main>
  );
}
