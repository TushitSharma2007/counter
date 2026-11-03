import { Toaster } from '@repo/ui';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useWakeLock } from '../lib/wake-lock.ts';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
});

function Root() {
  useWakeLock();
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
