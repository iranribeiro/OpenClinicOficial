import { ValueObject } from './value-object.base.js';
import { ValidationError, ErrorCode } from '../../errors/index.js';

/**
 * Value Object representing a system Username.
 * Enforces canonical lowercase normalization, minimum/maximum length (3-50 chars),
 * and safe characters with dot, underscore, or hyphen separators.
 *
 * The first character must be a letter. `UserRepository.getByIdentifier` resolves an account by
 * `email OR username OR cpf`, so a username made only of digits could shadow somebody's CPF and
 * make authentication ambiguous. Requiring a leading letter rules that out by construction, and
 * it is the convention institution logins follow (`dr.silva`, not `12345678901`).
 */
export class Username extends ValueObject<string> {
  public static readonly ERROR_CODE = 'VALIDATION_ERROR_USERNAME_INVALID' as const;
  public static readonly MIN_LENGTH = 3;
  public static readonly MAX_LENGTH = 50;

  // Starts with a letter and ends alphanumeric. Internal characters can include '.', '_', '-' but not consecutively.
  // Published as a string so JSON schemas, which take a pattern rather than a RegExp, share this one definition.
  public static readonly PATTERN = '^[a-z](?:[a-z0-9._-]{1,48}[a-z0-9])?$';

  private static readonly USERNAME_REGEX = new RegExp(Username.PATTERN);
  private static readonly CONSECUTIVE_SEPARATORS = /[._-]{2,}/;

  private constructor(value: string) {
    super(value);
  }

  /**
   * Sanitizes username by trimming and converting to lowercase.
   */
  public static clean(raw: string | null | undefined): string {
    return (raw || '').trim().toLowerCase();
  }

  /**
   * Validates whether a raw string constitutes an acceptable username.
   */
  public static isValid(raw: string | null | undefined): boolean {
    const cleaned = this.clean(raw);
    if (cleaned.length < this.MIN_LENGTH || cleaned.length > this.MAX_LENGTH) {
      return false;
    }

    if (this.CONSECUTIVE_SEPARATORS.test(cleaned)) {
      return false;
    }

    return this.USERNAME_REGEX.test(cleaned);
  }

  /**
   * Factory method to create a validated and canonical Username instance.
   * Throws ValidationError if username does not satisfy domain invariants.
   */
  public static create(raw: string): Username {
    const cleaned = this.clean(raw);
    if (!this.isValid(cleaned)) {
      throw new ValidationError('username', ErrorCode.VALIDATION_ERROR, { value: raw });
    }
    return new Username(cleaned);
  }

  /**
   * Returns canonical username string.
   */
  public toString(): string {
    return this._value;
  }
}
