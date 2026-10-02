import { ProblemDetailsSchema } from './openapi.schemas.js';

const nullableString = { type: ['string', 'null'] };
const dateString = { ...nullableString, format: 'date' };
const clockString = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };

const ufEnum = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** A council may hold several registrations; the primary one defines the practitioner type. */
export const PractitionerRegistrationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['registration_type', 'registration_number'],
  properties: {
    id: { type: 'string' },
    registration_type: { type: 'string', minLength: 1, maxLength: 20 },
    registration_number: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' },
    registration_state: { type: ['string', 'null'], enum: [...ufEnum, null] },
    is_primary: { type: 'boolean' },
    issuing_body: { ...nullableString, maxLength: 100 },
    issue_date: dateString,
    expiration_date: dateString,
    status: { type: 'string', maxLength: 20 },
    verification_url: { ...nullableString, maxLength: 500 },
  },
};

export const PractitionerSpecialtySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specialty_id'],
  properties: {
    id: { type: 'string' },
    specialty_id: { type: 'string', minLength: 1, maxLength: 36 },
    is_primary: { type: 'boolean' },
    qualification_date: dateString,
    rqe_number: { ...nullableString, maxLength: 50 },
  },
};

export const PractitionerQualificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['qualification_type', 'issuing_institution', 'degree_name', 'year_issued'],
  properties: {
    id: { type: 'string' },
    qualification_type: { type: 'string', minLength: 1, maxLength: 50 },
    issuing_institution: { type: 'string', minLength: 1, maxLength: 255 },
    degree_name: { type: 'string', minLength: 1, maxLength: 255 },
    year_issued: { type: 'integer', minimum: 1900, maximum: 2200 },
    country_code: { ...nullableString, maxLength: 2 },
    valid_until: dateString,
    document_url: { ...nullableString, maxLength: 500 },
  },
};

/** A unit with at least one shift is, by definition, a unit the practitioner works at. */
const availabilityProperties = {
  id: { type: 'string' },
  day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
  start_time: clockString,
  end_time: clockString,
  lunch_start: { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
  lunch_end: { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
  slot_duration_minutes: { type: 'integer', minimum: 1, maximum: 1439 },
  room_id: { ...nullableString, maxLength: 36 },
};

/** A caller must always name the unit; the column itself is nullable because deleting a unit nulls it. */
export const PractitionerAvailabilityInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['organization_unit_id', 'day_of_week', 'start_time', 'end_time'],
  properties: { ...availabilityProperties, organization_unit_id: { type: 'string', minLength: 1, maxLength: 36 } },
};

export const PractitionerAvailabilitySchema = {
  type: 'object',
  properties: { ...availabilityProperties, organization_unit_id: { ...nullableString, maxLength: 36 } },
};

export const PractitionerSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    tenant_id: { type: 'string' },
    user_id: nullableString,
    username: nullableString,
    full_name: { type: 'string' },
    cpf: nullableString, email: nullableString, phone: nullableString,
    practitioner_type: { type: 'string' },
    job_title: nullableString, council_type: nullableString,
    council_number: nullableString, council_uf: nullableString,
    primary_specialty: nullableString,
    is_clinical_staff: { type: 'boolean' },
    birth_date: dateString,
    gender: nullableString,
    social_name: nullableString,
    cns: nullableString,
    photo_url: nullableString,
    street: nullableString,
    number: nullableString,
    complement: nullableString,
    neighborhood: nullableString,
    city: nullableString,
    state: nullableString,
    postal_code: nullableString,
    is_technical_lead: { type: 'boolean' },
    digital_signature_type: { type: 'string' },
    calendar_color: nullableString,
    notes: nullableString,
    is_active: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    deleted_at: { ...nullableString, format: 'date-time' },
    registrations: { type: 'array', items: PractitionerRegistrationSchema },
    specialties: { type: 'array', items: PractitionerSpecialtySchema },
    qualifications: { type: 'array', items: PractitionerQualificationSchema },
    availability: { type: 'array', items: PractitionerAvailabilitySchema },
  },
};

// Inline errors also allow the router to be registered in isolation.
const { $id: _id, ...problem } = ProblemDetailsSchema;
export const practitionerErrors = {
  400: { ...problem, description: 'Invalid request' },
  401: { ...problem, description: 'Missing or invalid bearer token' },
  403: { ...problem, description: 'Missing tenant or practitioner permission' },
  404: {
    type: 'object', description: 'Practitioner not found in the current tenant',
    properties: { statusCode: { type: 'integer' }, error: { type: 'string' }, message: { type: 'string' } },
  },
  409: { ...problem, description: 'Email, username or CPF already belongs to a system account' },
  422: { ...problem, description: 'Rejected by a domain rule, such as an invalid CPF or council number' },
  500: { ...problem, description: 'Internal server error' },
};
