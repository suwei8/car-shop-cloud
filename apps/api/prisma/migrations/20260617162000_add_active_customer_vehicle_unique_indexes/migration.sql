-- Add database-level safeguards for the application rule that active customer
-- phones and active vehicle plates are unique within a tenant. Historical
-- inactive rows may keep duplicate values.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_active_tenant_phone_key"
  ON "customers" ("tenant_id", "phone")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_active_tenant_upper_plate_no_key"
  ON "vehicles" ("tenant_id", upper("plate_no"))
  WHERE "status" = 'active';
