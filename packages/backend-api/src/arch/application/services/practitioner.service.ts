import {
  BirthDate,
  Cns,
  Cpf,
  Email,
  ErrorCode,
  Phone,
  Rqe,
  ValidationError,
} from '@openclinic/core';
import type { PractitionerInput, PractitionerRepository } from '../../domain/practitioner.js';

/** Business validation shared by creation and partial updates. */
export class PractitionerService {
  constructor(private readonly repository: PractitionerRepository) {}

  private static validateDate(field: string, value: string | null | undefined): void {
    if (value == null || value === '') return;
    if (!BirthDate.isValid(value)) throw new ValidationError(field, ErrorCode.VALIDATION_ERROR, { value });
  }

  private validate(input: Partial<PractitionerInput>, isCreate: boolean): void {
    if (input.cpf != null) Cpf.create(input.cpf);
    if (input.cns != null && input.cns !== '') Cns.create(input.cns);
    if (input.email != null && input.email !== '') Email.create(input.email);
    if (input.phone != null && input.phone !== '') Phone.create(input.phone);
    PractitionerService.validateDate('birth_date', input.birth_date);

    // docs/cadastros.md makes the council mandatory: it is what defines the category, so a
    // practitioner without a registration has no derivable practitioner_type.
    if (isCreate && !input.registrations?.length) {
      throw new ValidationError('registrations', ErrorCode.REQUIRED_FIELDS_MISSING);
    }
    for (const registration of input.registrations ?? []) {
      PractitionerService.validateDate('registrations.issue_date', registration.issue_date);
      PractitionerService.validateDate('registrations.expiration_date', registration.expiration_date);
    }

    for (const specialty of input.specialties ?? []) {
      if (specialty.rqe_number) Rqe.create(specialty.rqe_number);
      PractitionerService.validateDate('specialties.qualification_date', specialty.qualification_date);
    }

    for (const qualification of input.qualifications ?? []) {
      if (!qualification.qualification_type?.trim() || !qualification.degree_name?.trim()
        || !qualification.issuing_institution?.trim()) {
        throw new ValidationError('qualifications', ErrorCode.REQUIRED_FIELDS_MISSING);
      }
      if (!Number.isInteger(qualification.year_issued)) {
        throw new ValidationError('qualifications', ErrorCode.VALIDATION_ERROR, { year_issued: qualification.year_issued });
      }
      PractitionerService.validateDate('qualifications.valid_until', qualification.valid_until);
    }
  }

  async create(input: PractitionerInput) {
    this.validate(input, true);
    return this.repository.create(input);
  }

  async update(id: string, input: Partial<PractitionerInput>) {
    this.validate(input, false);
    return this.repository.update(id, input);
  }
}
