begin;
select plan(3);

select function_privs_are(
  'public', 'health', array[]::text[], 'anon', array['EXECUTE'],
  'anon can call health()'
);

select is(
  (public.health() ->> 'ok')::boolean, true,
  'health() reports ok'
);

-- A function created after the baseline migration must not be callable until granted.
create function public.probe_private() returns int language sql as $$ select 1 $$;
select ok(
  not has_function_privilege('anon', 'public.probe_private()', 'execute')
    and not has_function_privilege('authenticated', 'public.probe_private()', 'execute'),
  'new functions are private by default'
);

select * from finish();
rollback;
