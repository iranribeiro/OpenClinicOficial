/**
 * Council registrations. A practitioner may hold more than one; the primary one defines
 * `practitioner_type` and feeds the denormalized `council_*` columns.
 */
export interface PractitionerRegistrationInput {
  registration_type: string;
  registration_number: string;
  registration_state?: string | null;
  is_primary?: boolean;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  status?: string;
  verification_url?: string | null;
}

export interface PractitionerSpecialtyInput {
  specialty_id: string;
  is_primary?: boolean;
  qualification_date?: string | null;
  rqe_number?: string | null;
}

export interface PractitionerQualificationInput {
  qualification_type: string;
  issuing_institution: string;
  degree_name: string;
  year_issued: number;
  country_code?: string | null;
  valid_until?: string | null;
  document_url?: string | null;
}

export interface PractitionerAvailabilityInput {
  organization_unit_id: string;
  /** Sunday is 0. */
  day_of_week: number;
  start_time: string;
  end_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
  slot_duration_minutes?: number;
  room_id?: string | null;
}

/**
 * Collections are replaced wholesale on save: supplying one replaces every row of that
 * collection, omitting it leaves the stored rows untouched.
 */
export interface PractitionerCollections {
  registrations?: PractitionerRegistrationInput[];
  specialties?: PractitionerSpecialtyInput[];
  qualifications?: PractitionerQualificationInput[];
  availability?: PractitionerAvailabilityInput[];
}

export interface PractitionerInput extends PractitionerCollections {
  /** Derived from the primary registration when registrations are supplied. */
  practitioner_type?: string;
  username?: string;
  login_password?: string;
  full_name: string;
  job_title?: string | null;
  council_type?: string | null;
  council_number?: string | null;
  council_uf?: string | null;
  primary_specialty?: string | null;
  is_clinical_staff?: boolean;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  social_name?: string | null;
  cns?: string | null;
  photo_url?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  is_technical_lead?: boolean;
  digital_signature_type?: string;
  calendar_color?: string | null;
  notes?: string | null;
}

/**
 * Council → practitioner category. Per docs/cadastros.md the council defines the category,
 * so `practitioner_type` is derived from the primary registration rather than typed by hand.
 */
export const COUNCIL_PRACTITIONER_TYPE: Readonly<Record<string, string>> = {
  CRM: 'PHYSICIAN',
  COREN: 'NURSE',
  CRO: 'DENTIST',
  CRP: 'PSYCHOLOGIST',
  CREFITO: 'PHYSIOTHERAPIST',
  CRF: 'PHARMACIST',
  CRN: 'NUTRITIONIST',
  RMS: 'OTHER',
  OTHER: 'OTHER',
};

/** Falls back to the first entry, so a collection never needs an explicit primary. */
export function primaryOf<T extends { is_primary?: boolean }>(items: readonly T[]): T | undefined {
  return items.find((item) => item.is_primary) ?? items[0];
}

/** Persisted child row: the input plus the server-assigned id. */
export type PractitionerRegistration = PractitionerRegistrationInput & { id: string };
export type PractitionerSpecialty = PractitionerSpecialtyInput & { id: string };
export type PractitionerQualification = PractitionerQualificationInput & { id: string };
/** The unit reference is nullable on the row: deleting a unit nulls it instead of cascading. */
export type PractitionerAvailability = Omit<PractitionerAvailabilityInput, 'organization_unit_id'>
  & { id: string; organization_unit_id: string | null };

export interface Practitioner extends Omit<PractitionerInput, 'availability'> {
  id: string;
  user_id?: string | null;
  tenant_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  registrations: PractitionerRegistration[];
  specialties: PractitionerSpecialty[];
  qualifications: PractitionerQualification[];
  availability: PractitionerAvailability[];
}

// The caller supplies a repository scoped to the authorized tenant.
export interface PractitionerRepository {
  list(options: { offset: number; limit: number }): Promise<{ items: Practitioner[]; total: number }>;
  getById(id: string): Promise<Practitioner | null>;
  create(input: PractitionerInput): Promise<Practitioner>;
  update(id: string, input: Partial<PractitionerInput>): Promise<Practitioner | null>;
  softDelete(id: string): Promise<void>;
}
