CREATE TABLE IF NOT EXISTS "app_specialties" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_en" varchar(100),
  "description" text,
  "cbo_code" varchar(10),
  "fhir_code" varchar(50),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_app_specialties_code" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_specialties_code" ON "app_specialties" USING btree ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_specialties_name" ON "app_specialties" USING btree ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_practitioner_registrations" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "practitioner_id" varchar(36) NOT NULL,
  "registration_type" varchar(20) NOT NULL,
  "registration_number" varchar(50) NOT NULL,
  "registration_state" varchar(2),
  "issuing_body" varchar(100),
  "issue_date" date,
  "expiration_date" date,
  "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
  "verification_url" varchar(500),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_reg_tenant" ON "app_practitioner_registrations" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_reg_practitioner" ON "app_practitioner_registrations" USING btree ("practitioner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_reg_number" ON "app_practitioner_registrations" USING btree ("registration_number","registration_type","registration_state");
--> statement-breakpoint
ALTER TABLE "app_practitioner_registrations" ADD CONSTRAINT "fk_app_pract_reg_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_registrations" ADD CONSTRAINT "fk_app_pract_reg_practitioner" FOREIGN KEY ("practitioner_id") REFERENCES "public"."app_practitioners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_practitioner_specialties" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "practitioner_id" varchar(36) NOT NULL,
  "specialty_id" varchar(36) NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "qualification_date" date,
  "rqe_number" varchar(50),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_spec_tenant" ON "app_practitioner_specialties" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_spec_practitioner" ON "app_practitioner_specialties" USING btree ("practitioner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_spec_specialty" ON "app_practitioner_specialties" USING btree ("specialty_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_spec_primary" ON "app_practitioner_specialties" USING btree ("practitioner_id","is_primary");
--> statement-breakpoint
ALTER TABLE "app_practitioner_specialties" ADD CONSTRAINT "fk_app_pract_spec_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_specialties" ADD CONSTRAINT "fk_app_pract_spec_practitioner" FOREIGN KEY ("practitioner_id") REFERENCES "public"."app_practitioners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_specialties" ADD CONSTRAINT "fk_app_pract_spec_specialty" FOREIGN KEY ("specialty_id") REFERENCES "public"."app_specialties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_practitioner_qualifications" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "practitioner_id" varchar(36) NOT NULL,
  "qualification_type" varchar(50) NOT NULL,
  "issuing_institution" varchar(255) NOT NULL,
  "degree_name" varchar(255) NOT NULL,
  "year_issued" integer NOT NULL,
  "country_code" varchar(2),
  "valid_until" date,
  "document_url" varchar(500),
  "verified" boolean DEFAULT false NOT NULL,
  "verified_by" varchar(36),
  "verified_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_qual_tenant" ON "app_practitioner_qualifications" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_qual_practitioner" ON "app_practitioner_qualifications" USING btree ("practitioner_id");
--> statement-breakpoint
ALTER TABLE "app_practitioner_qualifications" ADD CONSTRAINT "fk_app_pract_qual_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_qualifications" ADD CONSTRAINT "fk_app_pract_qual_practitioner" FOREIGN KEY ("practitioner_id") REFERENCES "public"."app_practitioners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_qualifications" ADD CONSTRAINT "fk_app_pract_qual_verified_by" FOREIGN KEY ("verified_by") REFERENCES "public"."iam_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_practitioner_availability" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "practitioner_id" varchar(36) NOT NULL,
  "organization_unit_id" varchar(36),
  "day_of_week" varchar(15) NOT NULL,
  "start_time" varchar(10) NOT NULL,
  "end_time" varchar(10) NOT NULL,
  "lunch_start" varchar(10),
  "lunch_end" varchar(10),
  "slot_duration_minutes" integer DEFAULT 30 NOT NULL,
  "room_id" varchar(36),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_avail_tenant" ON "app_practitioner_availability" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_pract_avail_practitioner" ON "app_practitioner_availability" USING btree ("practitioner_id");
--> statement-breakpoint
ALTER TABLE "app_practitioner_availability" ADD CONSTRAINT "fk_app_pract_avail_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_availability" ADD CONSTRAINT "fk_app_pract_avail_practitioner" FOREIGN KEY ("practitioner_id") REFERENCES "public"."app_practitioners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_practitioner_availability" ADD CONSTRAINT "fk_app_pract_avail_unit" FOREIGN KEY ("organization_unit_id") REFERENCES "public"."app_organization_units"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_staff" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "cpf" varchar(11) NOT NULL,
  "rg" varchar(20),
  "birth_date" date NOT NULL,
  "gender" varchar(20),
  "staff_type" varchar(50) NOT NULL,
  "department" varchar(100),
  "job_position" varchar(100),
  "contract_type" varchar(50),
  "hire_date" date NOT NULL,
  "termination_date" date,
  "phone" varchar(20),
  "email" varchar(255) NOT NULL,
  "emergency_contact_name" varchar(255),
  "emergency_contact_phone" varchar(20),
  "street" varchar(255),
  "number" varchar(20),
  "complement" varchar(100),
  "neighborhood" varchar(100),
  "city" varchar(100),
  "state" varchar(2),
  "postal_code" varchar(20),
  "photo_url" varchar(500),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_tenant_id" ON "app_staff" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_user_id" ON "app_staff" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_cpf" ON "app_staff" USING btree ("cpf");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_type" ON "app_staff" USING btree ("staff_type");
--> statement-breakpoint
ALTER TABLE "app_staff" ADD CONSTRAINT "fk_app_staff_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_staff" ADD CONSTRAINT "fk_app_staff_user" FOREIGN KEY ("user_id") REFERENCES "public"."iam_users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_staff_qualifications" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(36) NOT NULL,
  "staff_id" varchar(36) NOT NULL,
  "qualification_type" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "issuing_institution" varchar(255),
  "year_issued" integer,
  "valid_until" date,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_qual_tenant" ON "app_staff_qualifications" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_staff_qual_staff" ON "app_staff_qualifications" USING btree ("staff_id");
--> statement-breakpoint
ALTER TABLE "app_staff_qualifications" ADD CONSTRAINT "fk_app_staff_qual_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."sys_tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_staff_qualifications" ADD CONSTRAINT "fk_app_staff_qual_staff" FOREIGN KEY ("staff_id") REFERENCES "public"."app_staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sys_applications" ADD COLUMN IF NOT EXISTS "allow_direct_user_creation" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "birth_date" date;
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "gender" varchar(20);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "social_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "cns" varchar(15);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "photo_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "street" varchar(255);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "number" varchar(20);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "complement" varchar(100);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "neighborhood" varchar(100);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "city" varchar(100);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "state" varchar(2);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "postal_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "is_technical_lead" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "digital_signature_type" varchar(50) DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "calendar_color" varchar(20);
--> statement-breakpoint
ALTER TABLE "app_practitioners" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
UPDATE "sys_application_resources"
SET "item_code" = 'base_organizations',
    "context" = 'BUSINESS',
    "label_key" = 'NAV_BASE_ORGANIZATIONS',
    "route" = '/registries/organizations',
    "sort_order" = 80,
    "min_role" = 'USER',
    "description" = 'Healthcare organizations, healthcare establishments (EAS/CNES), and clinical rooms/offices',
    "updated_at" = now()
WHERE "item_code" = 'menu_sys_institution';
--> statement-breakpoint
INSERT INTO "sys_application_resources" ("id", "item_code", "resource_type", "context", "description", "label_key", "icon", "route", "sort_order", "min_role", "is_active", "application_id")
VALUES ('7a1c3e50-9d4f-4a8b-b12e-8e4a901f4a21', 'base_practitioners', 'MENU', 'BUSINESS', 'Cadastro clínico de médicos e profissionais assistenciais com CRM/COREN/CRO', 'NAV_BASE_PRACTITIONERS', 'activity', '/registries/practitioners', 85, 'USER', true, (SELECT id FROM "sys_applications" WHERE code = 'openclinic'))
ON CONFLICT ("item_code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "iam_permissions" ("id", "group_id", "resource_id", "action", "effect", "tenant_id")
SELECT gen_random_uuid(), p."group_id", res."id", p."action", p."effect", p."tenant_id"
FROM "iam_permissions" p
JOIN "sys_application_resources" staff_res ON staff_res."id" = p."resource_id" AND staff_res."item_code" = 'base_staff'
CROSS JOIN "sys_application_resources" res
WHERE res."item_code" = 'base_practitioners'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_specialties" ("id", "code", "name", "name_en", "cbo_code", "fhir_code", "is_active")
VALUES
    ('spec-001', '2251-05', 'Clínica Geral', 'General Practice', '2251-05', 'GP', true),
    ('spec-002', '2251-10', 'Cirurgia Geral', 'General Surgery', '2251-10', 'SURG', true),
    ('spec-003', '2251-15', 'Cardiologia', 'Cardiology', '2251-15', 'CARD', true),
    ('spec-004', '2251-20', 'Dermatologia', 'Dermatology', '2251-20', 'DERM', true),
    ('spec-005', '2251-25', 'Gastroenterologia', 'Gastroenterology', '2251-25', 'GASTRO', true),
    ('spec-006', '2251-30', 'Pediatria', 'Pediatrics', '2251-30', 'PED', true),
    ('spec-007', '2251-35', 'Oftalmologia', 'Ophthalmology', '2251-35', 'OPH', true),
    ('spec-008', '2251-40', 'Otorrinolaringologia', 'Otolaryngology', '2251-40', 'ORL', true),
    ('spec-009', '2251-45', 'Neurologia', 'Neurology', '2251-45', 'NEUR', true),
    ('spec-010', '2251-50', 'Psiquiatria', 'Psychiatry', '2251-50', 'PSY', true),
    ('spec-011', '2251-55', 'Ortopedia e Traumatologia', 'Orthopedics', '2251-55', 'ORTHO', true),
    ('spec-012', '2251-60', 'Ginecologia e Obstetrícia', 'Gynecology and Obstetrics', '2251-60', 'OBGYN', true),
    ('spec-013', '2261-10', 'Odontologia', 'Dentistry', '2261-10', 'DENT', true),
    ('spec-014', '3222-05', 'Enfermagem', 'Nursing', '3222-05', 'NURSE', true),
    ('spec-015', '2515-10', 'Psicologia Clínica', 'Clinical Psychology', '2515-10', 'PSYCH', true),
    ('spec-016', '2236-05', 'Fisioterapia Geral', 'Physiotherapy', '2236-05', 'PHYSIO', true),
    ('spec-017', '2237-10', 'Nutrição', 'Nutrition', '2237-10', 'NUT', true)
ON CONFLICT ("code") DO NOTHING;
