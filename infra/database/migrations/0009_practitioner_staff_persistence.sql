ALTER TABLE "app_practitioner_registrations" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_reg_primary" ON "app_practitioner_registrations" USING btree ("practitioner_id","is_primary");
--> statement-breakpoint
ALTER TABLE "app_practitioner_availability" ALTER COLUMN "day_of_week" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "app_practitioner_availability" ALTER COLUMN "day_of_week" SET DATA TYPE integer USING (
  CASE
    WHEN btrim("day_of_week") ~ '^[0-6]$' THEN btrim("day_of_week")::integer
    ELSE GREATEST(COALESCE(array_position(
      ARRAY['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'],
      upper(btrim("day_of_week"))
    ) - 1, 0), 0)
  END
);
--> statement-breakpoint
ALTER TABLE "app_practitioner_availability" ADD CONSTRAINT "app_practitioner_availability_day_check" CHECK ("day_of_week" BETWEEN 0 AND 6);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_avail_unit" ON "app_practitioner_availability" USING btree ("organization_unit_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_staff_units" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "staff_id" varchar(36) NOT NULL,
  "organization_unit_id" varchar(36) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_app_staff_units_staff_unit" UNIQUE("staff_id","organization_unit_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_units_tenant" ON "app_staff_units" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_units_staff" ON "app_staff_units" USING btree ("staff_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_units_unit" ON "app_staff_units" USING btree ("organization_unit_id");
--> statement-breakpoint
ALTER TABLE "app_staff_units" ADD CONSTRAINT "fk_app_staff_units_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_staff_units" ADD CONSTRAINT "fk_app_staff_units_staff" FOREIGN KEY ("staff_id") REFERENCES "public"."app_staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_staff_units" ADD CONSTRAINT "fk_app_staff_units_unit" FOREIGN KEY ("organization_unit_id") REFERENCES "public"."app_organization_units"("id") ON DELETE restrict ON UPDATE no action;
