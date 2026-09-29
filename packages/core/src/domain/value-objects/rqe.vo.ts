import { ValueObject } from './value-object.base.js';
import { ValidationError, ErrorCode } from '../../errors/index.js';

/**
 * Value Object representing CFM Registro de Qualificação de Especialista (RQE).
 * Enforces CFM Resolutions 2.162/17 and 2.336/23:
 * Mandatory for all medical advertising, prescription headers, and specialty appointments.
 * Typically 1 to 8 digits numeric.
 */
export class Rqe extends ValueObject<string> {
  public static readonly ERROR_CODE = 'VALIDATION_ERROR_RQE_INVALID' as const;

  private constructor(value: string) {
    super(value);
  }

  /**
   * Sanitizes RQE by stripping whitespace and non-numeric chars.
   */
  public static clean(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw.trim().replace(/\D/g, '');
  }

  /**
   * Validates if raw string constitutes a valid RQE (1 to 8 numeric digits).
   */
  public static isValid(raw: string | null | undefined): boolean {
    const cleaned = this.clean(raw);
    if (!cleaned) return false;
    return cleaned.length >= 1 && cleaned.length <= 8;
  }

  /**
   * Factory method to create a validated Rqe instance.
   */
  public static create(raw: string): Rqe {
    const cleaned = this.clean(raw);
    if (!this.isValid(cleaned)) {
      throw new ValidationError('rqe', ErrorCode.VALIDATION_ERROR, { value: raw });
    }
    return new Rqe(cleaned);
  }

  /**
   * Formatted RQE string (e.g. "RQE 12345").
   */
  public format(): string {
    return `RQE ${this._value}`;
  }

  public override toString(): string {
    return this._value;
  }
}
