import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Username } from '@openclinic/core';
import type { PractitionerInput, PractitionerRepository } from '../domain/practitioner.js';
import {
  PractitionerAvailabilityInputSchema, PractitionerQualificationSchema, PractitionerRegistrationSchema,
  PractitionerSchema, PractitionerSpecialtySchema, practitionerErrors,
} from './practitioner.schemas.js';
import { SecurityBearer } from './openapi.schemas.js';
import { PractitionerService } from '../application/services/practitioner.service.js';

const basePath = '/api/v1/business/practitioners';
const nullableString = { type: ['string', 'null'] };
const properties = {
  full_name: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S' },
  cpf: { ...nullableString, pattern: '^[0-9]{11}$' },
  /** Derived from the primary registration; only sent to override it explicitly. */
  practitioner_type: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' },
  job_title: { ...nullableString, maxLength: 100 },
  council_type: { ...nullableString, maxLength: 20 },
  council_number: { ...nullableString, maxLength: 20 },
  council_uf: { ...nullableString, enum: [null, 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] },
  primary_specialty: { ...nullableString, maxLength: 150 },
  is_clinical_staff: { type: 'boolean' },
  email: { type: 'string', format: 'email', maxLength: 255 },
  phone: { ...nullableString, maxLength: 20 },
  birth_date: { ...nullableString, format: 'date' },
  gender: { ...nullableString, maxLength: 20 },
  social_name: { ...nullableString, maxLength: 255 },
  cns: { ...nullableString, maxLength: 15 },
  photo_url: { ...nullableString, maxLength: 500 },
  street: { ...nullableString, maxLength: 255 },
  number: { ...nullableString, maxLength: 20 },
  complement: { ...nullableString, maxLength: 100 },
  neighborhood: { ...nullableString, maxLength: 100 },
  city: { ...nullableString, maxLength: 100 },
  state: { ...nullableString, maxLength: 2 },
  postal_code: { ...nullableString, maxLength: 20 },
  is_technical_lead: { type: 'boolean' },
  digital_signature_type: { type: 'string', maxLength: 50 },
  calendar_color: { ...nullableString, maxLength: 20 },
  notes: { ...nullableString },
  /** Login account linked to this practitioner. Created when absent, refreshed when present. */
  username: { type: 'string', pattern: Username.PATTERN },
  login_password: { type: 'string', minLength: 8, maxLength: 128 },
  /** Supplying a collection replaces it wholesale; omitting one leaves it untouched. */
  registrations: { type: 'array', maxItems: 20, items: PractitionerRegistrationSchema },
  specialties: { type: 'array', maxItems: 50, items: PractitionerSpecialtySchema },
  qualifications: { type: 'array', maxItems: 50, items: PractitionerQualificationSchema },
  availability: { type: 'array', maxItems: 100, items: PractitionerAvailabilityInputSchema },
};
const params = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
};
const notFound = { statusCode: 404, error: 'Not Found', message: 'Practitioner not found' };

export function registerPractitionerRoutes(
  app: FastifyInstance,
  { practitioners }: { practitioners: PractitionerRepository | ((request: FastifyRequest) => PractitionerRepository) },
): void {
  const repository = (request: FastifyRequest) => typeof practitioners === 'function' ? practitioners(request) : practitioners;
  app.get<{ Querystring: { offset: number; limit: number } }>(basePath, {
    schema: {
      tags: ['Practitioners'],
      security: SecurityBearer,
      summary: 'List practitioners',
      description: 'Lists non-deleted practitioners in the authenticated tenant. Requires registries_practitioners READ permission.',
      response: { ...practitionerErrors, 200: {
        type: 'object', properties: { items: { type: 'array', items: PractitionerSchema }, total: { type: 'integer' } },
      } },
      querystring: {
        type: 'object',
        properties: {
          offset: { type: 'integer', minimum: 0, default: 0 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request) => repository(request).list({ offset: request.query.offset, limit: request.query.limit }));

  app.post<{ Body: PractitionerInput }>(basePath, {
    schema: {
      tags: ['Practitioners'],
      security: SecurityBearer,
      summary: 'Create practitioner',
      description: 'Creates a practitioner, its registrations/specialties/qualifications/shifts and its system account in one transaction. Requires registries_practitioners WRITE permission. tenant_id and practitioner_type are assigned by the server.',
      response: { ...practitionerErrors, 201: PractitionerSchema },
      // Every practitioner is linked to an access account, and that account is identified by its
      // email, so the email is part of what it takes to create one.
      body: { type: 'object', required: ['full_name', 'email'], additionalProperties: false, properties },
    },
  }, async (request, reply) => reply.status(201).send(await new PractitionerService(repository(request)).create(request.body)));

  app.get<{ Params: { id: string } }>(`${basePath}/:id`, {
    schema: { tags: ['Practitioners'], params, security: SecurityBearer, summary: 'Get practitioner',
      description: 'Requires registries_practitioners READ permission. Deleted practitioners and practitioners in other tenants return 404.',
      response: { ...practitionerErrors, 200: PractitionerSchema } },
  }, async (request, reply) => {
    const practitioner = await repository(request).getById(request.params.id);
    return practitioner ? reply.send(practitioner) : reply.status(404).send(notFound);
  });

  app.put<{ Params: { id: string }; Body: Partial<PractitionerInput> }>(`${basePath}/:id`, {
    schema: {
      tags: ['Practitioners'],
      security: SecurityBearer,
      summary: 'Update practitioner',
      description: 'Updates supplied fields; omitted fields remain unchanged. Requires registries_practitioners WRITE permission.',
      response: { ...practitionerErrors, 200: PractitionerSchema },
      params,
      body: { type: 'object', minProperties: 1, additionalProperties: false, properties },
    },
  }, async (request, reply) => {
    const practitioner = await new PractitionerService(repository(request)).update(request.params.id, request.body);
    return practitioner ? reply.send(practitioner) : reply.status(404).send(notFound);
  });

  app.delete<{ Params: { id: string } }>(`${basePath}/:id`, {
    schema: { tags: ['Practitioners'], params, security: SecurityBearer, summary: 'Delete practitioner',
      description: 'Soft-deletes a practitioner in the authenticated tenant. Requires registries_practitioners DELETE permission.',
      response: { ...practitionerErrors, 204: { type: 'null', description: 'Practitioner deleted; empty response' } } },
  }, async (request, reply) => {
    if (!await repository(request).getById(request.params.id)) return reply.status(404).send(notFound);
    await repository(request).softDelete(request.params.id);
    return reply.status(204).send();
  });
}

