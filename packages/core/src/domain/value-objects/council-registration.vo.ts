import { ValueObject } from './value-object.base.js';
import { CouncilType } from '../enums.js';
import { BRAZILIAN_UFS, type BrazilianUfCode } from './uf.vo.js';
import { ValidationError, ErrorCode } from '../../errors/index.js';

export interface CouncilRegistrationProps {
  councilType: CouncilType;
  number: string;
  uf: BrazilianUfCode;
}

/**
 * Value Object representing a Brazilian Professional Health Council Registration
 * (e.g. CRM/SP 123456, COREN/RJ 98765-ENF, CRO/MG 54321).
 * Enforces valid council type, Brazilian UF, and registration number.
 */
export class CouncilRegistration extends ValueObject<CouncilRegistrationProps> {
  public static readonly ERROR_CODE = 'VALIDATION_ERROR_COUNCIL_NUMBER_INVALID' as const;

  private constructor(props: CouncilRegistrationProps) {
    super(props);
  }

  /**
   * Sanitizes registration number by stripping whitespace and non-alphanumeric/hyphen chars.
   */
  public static cleanNumber(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw.trim().replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
  }

  /**
   * Validates council registration parameters.
   */
  public static isValid(props: { councilType?: unknown; number?: unknown; uf?: unknown }): boolean {
    if (!props) return false;

    const { councilType, number, uf } = props;

    // Validate Council Type
    if (!councilType || !Object.values(CouncilType).includes(councilType as CouncilType)) {
      return false;
    }

    // Validate Registration Number (1 to 12 alphanumeric characters / hyphens)
    const cleanedNumber = typeof number === 'string' ? this.cleanNumber(number) : '';
    if (!cleanedNumber || cleanedNumber.length < 1 || cleanedNumber.length > 12) {
      return false;
    }

    // Validate UF
    if (!uf || typeof uf !== 'string' || !BRAZILIAN_UFS.includes(uf.toUpperCase() as BrazilianUfCode)) {
      return false;
    }

    return true;
  }

  /**
   * Factory method to create a validated CouncilRegistration instance.
   */
  public static create(props: { councilType: CouncilType; number: string; uf: string }): CouncilRegistration {
    const cleanedNumber = this.cleanNumber(props.number);
    const normalizedUf = (props.uf || '').trim().toUpperCase() as BrazilianUfCode;

    if (!this.isValid({ councilType: props.councilType, number: cleanedNumber, uf: normalizedUf })) {
      throw new ValidationError('councilRegistration', ErrorCode.VALIDATION_ERROR, {
        councilType: props.councilType,
        number: props.number,
        uf: props.uf,
      });
    }

    return new CouncilRegistration({
      councilType: props.councilType,
      number: cleanedNumber,
      uf: normalizedUf,
    });
  }

  public get councilType(): CouncilType {
    return this._value.councilType;
  }

  public get number(): string {
    return this._value.number;
  }

  public get uf(): BrazilianUfCode {
    return this._value.uf;
  }

  /**
   * Returns canonical string representation (e.g. "CRM/SP 123456").
   */
  public format(): string {
    return `${this._value.councilType}/${this._value.uf} ${this._value.number}`;
  }

  public override toString(): string {
    return this.format();
  }
}
