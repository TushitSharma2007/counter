import { describe, expect, it } from 'vitest';
import { readDbConfig } from './env.ts';

// The well-known demo keys every local Supabase stack ships with; not secrets.
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_ROLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const env = (key: string, url = 'https://abc.supabase.co') => ({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
});

describe('readDbConfig', () => {
  it('accepts a publishable key', () => {
    expect(readDbConfig(env('sb_publishable_abc'))).toEqual({
      url: 'https://abc.supabase.co',
      publishableKey: 'sb_publishable_abc',
    });
  });

  it('accepts a legacy anon key and a local http URL', () => {
    expect(readDbConfig(env(LOCAL_ANON, 'http://127.0.0.1:54321')).publishableKey).toBe(LOCAL_ANON);
  });

  it('refuses secret keys of both kinds', () => {
    expect(() => readDbConfig(env('sb_secret_abc'))).toThrow(/secret key/);
    expect(() => readDbConfig(env(LOCAL_SERVICE_ROLE))).toThrow(/publishable key/);
  });

  it('explains what is missing', () => {
    expect(() => readDbConfig({})).toThrow(/\.env\.local/);
    expect(() => readDbConfig(env('sb_publishable_abc', 'not a url'))).toThrow(/http\(s\) URL/);
  });
});
