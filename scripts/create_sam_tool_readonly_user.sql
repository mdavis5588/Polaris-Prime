-- Creates (or updates the password of) a read-only Postgres role for
-- Polaris Prime's sam-pricing backend plugin to use against the SAM-tool
-- (Helios) database.
--
-- Grants are scoped to exactly what the plugin reads today:
-- shared.oracle_product_list_prices. No write access anywhere is granted.
--
-- Not meant to be run directly with plain psql — invoke via
-- create_sam_tool_readonly_user.sh, which supplies the required psql
-- variables (ro_user, ro_password, db_name). If running manually, pass
-- them yourself, e.g.:
--   psql "<connection string>" \
--     -v ro_user=polaris_readonly -v ro_password=<password> \
--     -v db_name=<sam_tool_db_name> \
--     -f create_sam_tool_readonly_user.sql

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'ro_user') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', :'ro_user', :'ro_password');
  ELSE
    EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', :'ro_user', :'ro_password');
  END IF;
END
$$;

GRANT CONNECT ON DATABASE :"db_name" TO :"ro_user";
GRANT USAGE ON SCHEMA shared TO :"ro_user";
GRANT SELECT ON shared.oracle_product_list_prices TO :"ro_user";

-- Optional: automatically extend SELECT to any new tables later added to
-- the `shared` schema, so this role doesn't need re-granting each time.
-- Uncomment if you want that (only affects tables created AFTER this runs):
-- ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT SELECT ON TABLES TO :"ro_user";

-- Confirm the grant.
\echo 'Granted privileges for' :ro_user 'on shared.oracle_product_list_prices:'
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'shared'
  AND table_name = 'oracle_product_list_prices'
  AND grantee = :'ro_user';
