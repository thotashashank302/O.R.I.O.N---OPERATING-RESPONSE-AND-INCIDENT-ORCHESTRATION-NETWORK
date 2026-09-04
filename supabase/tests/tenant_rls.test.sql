begin;
select plan(5);

select has_table('public', 'incidents', 'incidents table exists');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'incidents'), 'incidents RLS is active');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'assignments'), 'assignments RLS is active');
select has_function('private', 'is_active_member', array['uuid'], 'fresh membership helper exists');
select has_function('public', 'claim_jobs', array['text', 'integer', 'integer'], 'durable claim function exists');

select * from finish();
rollback;
