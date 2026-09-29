export type PatientGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export interface PatientDTO {
  id: string;
  tenant_id: string;
  full_name: string;
  cpf?: string | null;
  cns?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  insurance_name?: string | null;
  insurance_number?: string | null;
  allergies_notes?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreatePatientDTO {
  full_name: string;
  cpf?: string | null;
  cns?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  insurance_name?: string | null;
  insurance_number?: string | null;
  allergies_notes?: string | null;
}

export type PractitionerType =
  | 'PHYSICIAN'
  | 'NURSE'
  | 'PHYSIOTHERAPIST'
  | 'PSYCHOLOGIST'
  | 'DENTIST'
  | 'PHARMACIST'
  | 'NUTRITIONIST'
  | 'ADMINISTRATIVE'
  | 'OTHER';

export interface PractitionerDTO {
  id: string;
  tenant_id: string;
  user_id: string;
  username?: string | null;
  full_name: string;
  cpf?: string | null;
  practitioner_type: string;
  job_title?: string | null;
  council_type?: string | null;
  council_number?: string | null;
  council_uf?: string | null;
  primary_specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  birth_date: string;
  gender: string;
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
  is_technical_lead: boolean;
  digital_signature_type: string;
  calendar_color?: string | null;
  notes?: string | null;
  is_clinical_staff: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreatePractitionerDTO {
  user_id?: string;
  username?: string | null;
  full_name: string;
  cpf?: string | null;
  practitioner_type?: string;
  job_title?: string | null;
  council_type?: string | null;
  council_number?: string | null;
  council_uf?: string | null;
  primary_specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  birth_date: string;
  gender: string;
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
  is_clinical_staff?: boolean;
}

export interface PractitionerRegistrationDTO {
  id: string;
  tenant_id: string;
  practitioner_id: string;
  registration_type: string;
  registration_number: string;
  registration_state?: string | null;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  status: string;
  verification_url?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePractitionerRegistrationDTO {
  registration_type: string;
  registration_number: string;
  registration_state?: string | null;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  status?: string;
  verification_url?: string | null;
}

export interface SpecialtyDTO {
  id: string;
  code: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  cbo_code?: string | null;
  fhir_code?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PractitionerSpecialtyDTO {
  id: string;
  tenant_id: string;
  practitioner_id: string;
  specialty_id: string;
  specialty_name?: string;
  specialty_code?: string;
  is_primary: boolean;
  qualification_date?: string | null;
  rqe_number?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePractitionerSpecialtyDTO {
  specialty_id: string;
  is_primary?: boolean;
  qualification_date?: string | null;
  rqe_number?: string | null;
}

export interface PractitionerQualificationDTO {
  id: string;
  tenant_id: string;
  practitioner_id: string;
  qualification_type: string;
  issuing_institution: string;
  degree_name: string;
  year_issued: number;
  country_code?: string | null;
  valid_until?: string | null;
  document_url?: string | null;
  verified: boolean;
  verified_by?: string | null;
  verified_at?: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePractitionerQualificationDTO {
  qualification_type: string;
  issuing_institution: string;
  degree_name: string;
  year_issued: number;
  country_code?: string | null;
  valid_until?: string | null;
  document_url?: string | null;
}

export interface PractitionerAvailabilityDTO {
  id: string;
  tenant_id: string;
  practitioner_id: string;
  organization_unit_id?: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
  slot_duration_minutes: number;
  room_id?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePractitionerAvailabilityDTO {
  organization_unit_id?: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
  slot_duration_minutes?: number;
  room_id?: string | null;
}

export interface StaffDTO {
  id: string;
  tenant_id: string;
  user_id: string;
  username?: string | null;
  full_name: string;
  cpf: string;
  rg?: string | null;
  birth_date: string;
  gender?: string | null;
  staff_type: string;
  department?: string | null;
  job_position?: string | null;
  contract_type?: string | null;
  hire_date: string;
  termination_date?: string | null;
  phone?: string | null;
  email: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  photo_url?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateStaffDTO {
  user_id?: string;
  username?: string | null;
  full_name: string;
  cpf: string;
  rg?: string | null;
  birth_date: string;
  gender?: string | null;
  staff_type: string;
  department?: string | null;
  job_position?: string | null;
  contract_type?: string | null;
  hire_date: string;
  termination_date?: string | null;
  phone?: string | null;
  email: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  photo_url?: string | null;
}

export interface StaffQualificationDTO {
  id: string;
  tenant_id: string;
  staff_id: string;
  qualification_type: string;
  title: string;
  issuing_institution?: string | null;
  year_issued?: number | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStaffQualificationDTO {
  qualification_type: string;
  title: string;
  issuing_institution?: string | null;
  year_issued?: number | null;
  valid_until?: string | null;
}

export type EncounterStatus =
  | 'PLANNED'
  | 'ARRIVED'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'ON_LEAVE'
  | 'FINISHED'
  | 'CANCELLED';

export interface EncounterDTO {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  appointment_id?: string | null;
  start_time: Date;
  end_time?: Date | null;
  status: string;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  clinical_notes?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface EncounterSummaryDTO {
  id: string;
  start_time: Date;
  end_time?: Date | null;
  status: string;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  clinical_notes?: string | null;
  patient_id: string;
  patient_name: string;
  practitioner_id: string;
  practitioner_name: string;
  specialty?: string | null;
}

export interface CreateEncounterDTO {
  patient_id: string;
  practitioner_id: string;
  appointment_id?: string | null;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  clinical_notes?: string | null;
}

export interface HealthPlanDTO {
  id: string;
  name: string;
  ans_code?: string | null;
  tiss_version?: string | null;
  payment_term_days?: number | null;
  is_active: boolean;
}

export interface ProcedureDTO {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tuss_code?: string | null;
  estimated_duration_minutes: number;
  requires_room: boolean;
  preparation_instructions?: string | null;
  return_after_days?: number | null;
  minimum_interval_days?: number | null;
  calendar_color?: string | null;
  practitioner_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}


export interface RoomDTO {
  id: string;
  tenant_id: string;
  unit_id: string;
  name: string;
  room_type?: string | null;
  is_schedulable: boolean;
  equipment: string[];
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AvailabilityDTO {
  id: string;
  tenant_id: string;
  unit_id: string;
  practitioner_id?: string | null;
  room_id?: string | null;
  series_id: string;
  replaces_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  timezone: string;
  valid_from: string;
  valid_until?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ScheduleBlockDTO {
  id: string;
  tenant_id: string;
  unit_id?: string | null;
  practitioner_id?: string | null;
  room_id?: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  reason?: string | null;
  recurrence?: { frequency: 'DAILY' | 'WEEKLY'; interval: number; until?: string | null } | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export interface AppointmentDTO {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  procedure_id: string | null;
  unit_id: string | null;
  room_id: string | null;
  appointment_date: string;
  duration_minutes: number;
  status: string;
  is_overbook: boolean;
  payer_type: 'PARTICULAR';
  source_channel: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
