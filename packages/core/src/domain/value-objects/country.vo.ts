import { ValueObject } from './value-object.base.js';
import { ValidationError, ErrorCode } from '../../errors/index.js';

/**
 * Standard ISO 3166-1 alpha-3 country codes supported in OpenClinic.
 * Implemented as const-asserted enum pattern to allow both value and type usage.
 */
export const CountryCode = {
  BRA: 'BRA',
  PRT: 'PRT',
  USA: 'USA',
  ARG: 'ARG',
  URY: 'URY',
  CHL: 'CHL',
  PRY: 'PRY',
  BOL: 'BOL',
  PER: 'PER',
  COL: 'COL',
  ESP: 'ESP',
  FRA: 'FRA',
  DEU: 'DEU',
  ITA: 'ITA',
  GBR: 'GBR',
  CAN: 'CAN',
  MEX: 'MEX',
  AGO: 'AGO',
  MOZ: 'MOZ',
  CPV: 'CPV',
  // Semantic country aliases
  BRAZIL: 'BRA',
  PORTUGAL: 'PRT',
  UNITED_STATES: 'USA',
  ARGENTINA: 'ARG',
  URUGUAY: 'URY',
  CHILE: 'CHL',
  PARAGUAY: 'PRY',
  BOLIVIA: 'BOL',
  PERU: 'PER',
  COLOMBIA: 'COL',
  SPAIN: 'ESP',
  FRANCE: 'FRA',
  GERMANY: 'DEU',
  ITALY: 'ITA',
  UNITED_KINGDOM: 'GBR',
  CANADA: 'CAN',
  MEXICO: 'MEX',
  ANGOLA: 'AGO',
  MOZAMBIQUE: 'MOZ',
  CAPE_VERDE: 'CPV',
} as const;

export type CountryCode = (typeof CountryCode)[keyof typeof CountryCode];

/**
 * Metadata descriptor for supported countries.
 */
export interface CountryMetadata {
  readonly code: CountryCode;
  readonly alpha2: string;
  readonly ddi: string;
  readonly flag: string;
  readonly namePt: string;
  readonly nameEn: string;
}

export const COUNTRY_METADATA: Record<CountryCode, CountryMetadata> = {
  [CountryCode.BRA]: {
    code: CountryCode.BRA,
    alpha2: 'BR',
    ddi: '+55',
    flag: '🇧🇷',
    namePt: 'Brasil',
    nameEn: 'Brazil',
  },
  [CountryCode.PRT]: {
    code: CountryCode.PRT,
    alpha2: 'PT',
    ddi: '+351',
    flag: '🇵🇹',
    namePt: 'Portugal',
    nameEn: 'Portugal',
  },
  [CountryCode.USA]: {
    code: CountryCode.USA,
    alpha2: 'US',
    ddi: '+1',
    flag: '🇺🇸',
    namePt: 'Estados Unidos',
    nameEn: 'United States',
  },
  [CountryCode.ARG]: {
    code: CountryCode.ARG,
    alpha2: 'AR',
    ddi: '+54',
    flag: '🇦🇷',
    namePt: 'Argentina',
    nameEn: 'Argentina',
  },
  [CountryCode.URY]: {
    code: CountryCode.URY,
    alpha2: 'UY',
    ddi: '+598',
    flag: '🇺🇾',
    namePt: 'Uruguai',
    nameEn: 'Uruguay',
  },
  [CountryCode.CHL]: {
    code: CountryCode.CHL,
    alpha2: 'CL',
    ddi: '+56',
    flag: '🇨🇱',
    namePt: 'Chile',
    nameEn: 'Chile',
  },
  [CountryCode.PRY]: {
    code: CountryCode.PRY,
    alpha2: 'PY',
    ddi: '+595',
    flag: '🇵🇾',
    namePt: 'Paraguai',
    nameEn: 'Paraguay',
  },
  [CountryCode.BOL]: {
    code: CountryCode.BOL,
    alpha2: 'BO',
    ddi: '+591',
    flag: '🇧🇴',
    namePt: 'Bolívia',
    nameEn: 'Bolivia',
  },
  [CountryCode.PER]: {
    code: CountryCode.PER,
    alpha2: 'PE',
    ddi: '+51',
    flag: '🇵🇪',
    namePt: 'Peru',
    nameEn: 'Peru',
  },
  [CountryCode.COL]: {
    code: CountryCode.COL,
    alpha2: 'CO',
    ddi: '+57',
    flag: '🇨🇴',
    namePt: 'Colômbia',
    nameEn: 'Colombia',
  },
  [CountryCode.ESP]: {
    code: CountryCode.ESP,
    alpha2: 'ES',
    ddi: '+34',
    flag: '🇪🇸',
    namePt: 'Espanha',
    nameEn: 'Spain',
  },
  [CountryCode.FRA]: {
    code: CountryCode.FRA,
    alpha2: 'FR',
    ddi: '+33',
    flag: '🇫🇷',
    namePt: 'França',
    nameEn: 'France',
  },
  [CountryCode.DEU]: {
    code: CountryCode.DEU,
    alpha2: 'DE',
    ddi: '+49',
    flag: '🇩🇪',
    namePt: 'Alemanha',
    nameEn: 'Germany',
  },
  [CountryCode.ITA]: {
    code: CountryCode.ITA,
    alpha2: 'IT',
    ddi: '+39',
    flag: '🇮🇹',
    namePt: 'Itália',
    nameEn: 'Italy',
  },
  [CountryCode.GBR]: {
    code: CountryCode.GBR,
    alpha2: 'GB',
    ddi: '+44',
    flag: '🇬🇧',
    namePt: 'Reino Unido',
    nameEn: 'United Kingdom',
  },
  [CountryCode.CAN]: {
    code: CountryCode.CAN,
    alpha2: 'CA',
    ddi: '+1',
    flag: '🇨🇦',
    namePt: 'Canadá',
    nameEn: 'Canada',
  },
  [CountryCode.MEX]: {
    code: CountryCode.MEX,
    alpha2: 'MX',
    ddi: '+52',
    flag: '🇲🇽',
    namePt: 'México',
    nameEn: 'Mexico',
  },
  [CountryCode.AGO]: {
    code: CountryCode.AGO,
    alpha2: 'AO',
    ddi: '+244',
    flag: '🇦🇴',
    namePt: 'Angola',
    nameEn: 'Angola',
  },
  [CountryCode.MOZ]: {
    code: CountryCode.MOZ,
    alpha2: 'MZ',
    ddi: '+258',
    flag: '🇲🇿',
    namePt: 'Moçambique',
    nameEn: 'Mozambique',
  },
  [CountryCode.CPV]: {
    code: CountryCode.CPV,
    alpha2: 'CV',
    ddi: '+238',
    flag: '🇨🇻',
    namePt: 'Cabo Verde',
    nameEn: 'Cape Verde',
  },
};

export const STANDARD_COUNTRIES = [
  CountryCode.BRA,
  CountryCode.PRT,
  CountryCode.USA,
  CountryCode.ARG,
  CountryCode.URY,
  CountryCode.CHL,
  CountryCode.PRY,
  CountryCode.BOL,
  CountryCode.PER,
  CountryCode.COL,
  CountryCode.ESP,
  CountryCode.FRA,
  CountryCode.DEU,
  CountryCode.ITA,
  CountryCode.GBR,
  CountryCode.CAN,
  CountryCode.MEX,
  CountryCode.AGO,
  CountryCode.MOZ,
  CountryCode.CPV,
] as const;

export const COUNTRY_NAMES_PT: Record<CountryCode, string> = {
  BRA: COUNTRY_METADATA.BRA.namePt,
  PRT: COUNTRY_METADATA.PRT.namePt,
  USA: COUNTRY_METADATA.USA.namePt,
  ARG: COUNTRY_METADATA.ARG.namePt,
  URY: COUNTRY_METADATA.URY.namePt,
  CHL: COUNTRY_METADATA.CHL.namePt,
  PRY: COUNTRY_METADATA.PRY.namePt,
  BOL: COUNTRY_METADATA.BOL.namePt,
  PER: COUNTRY_METADATA.PER.namePt,
  COL: COUNTRY_METADATA.COL.namePt,
  ESP: COUNTRY_METADATA.ESP.namePt,
  FRA: COUNTRY_METADATA.FRA.namePt,
  DEU: COUNTRY_METADATA.DEU.namePt,
  ITA: COUNTRY_METADATA.ITA.namePt,
  GBR: COUNTRY_METADATA.GBR.namePt,
  CAN: COUNTRY_METADATA.CAN.namePt,
  MEX: COUNTRY_METADATA.MEX.namePt,
  AGO: COUNTRY_METADATA.AGO.namePt,
  MOZ: COUNTRY_METADATA.MOZ.namePt,
  CPV: COUNTRY_METADATA.CPV.namePt,
};

export const COUNTRY_NAMES_EN: Record<CountryCode, string> = {
  BRA: COUNTRY_METADATA.BRA.nameEn,
  PRT: COUNTRY_METADATA.PRT.nameEn,
  USA: COUNTRY_METADATA.USA.nameEn,
  ARG: COUNTRY_METADATA.ARG.nameEn,
  URY: COUNTRY_METADATA.URY.nameEn,
  CHL: COUNTRY_METADATA.CHL.nameEn,
  PRY: COUNTRY_METADATA.PRY.nameEn,
  BOL: COUNTRY_METADATA.BOL.nameEn,
  PER: COUNTRY_METADATA.PER.nameEn,
  COL: COUNTRY_METADATA.COL.nameEn,
  ESP: COUNTRY_METADATA.ESP.nameEn,
  FRA: COUNTRY_METADATA.FRA.nameEn,
  DEU: COUNTRY_METADATA.DEU.nameEn,
  ITA: COUNTRY_METADATA.ITA.nameEn,
  GBR: COUNTRY_METADATA.GBR.nameEn,
  CAN: COUNTRY_METADATA.CAN.nameEn,
  MEX: COUNTRY_METADATA.MEX.nameEn,
  AGO: COUNTRY_METADATA.AGO.nameEn,
  MOZ: COUNTRY_METADATA.MOZ.nameEn,
  CPV: COUNTRY_METADATA.CPV.nameEn,
};

export interface CountryOption {
  code: CountryCode;
  name: string;
  display: string;
}

/**
 * Value Object representing a country by ISO 3166-1 alpha-3 code.
 * Exposes standardized country lists, validation, localized display names, and metadata.
 */
export class Country extends ValueObject<CountryCode> {
  public static readonly Code = CountryCode;
  public static readonly BRAZIL: CountryCode = CountryCode.BRAZIL;

  private constructor(value: CountryCode) {
    super(value);
  }

  /**
   * Returns the ISO alpha-3 country code.
   */
  public get code(): CountryCode {
    return this._value;
  }

  /**
   * Returns complete metadata record for this country.
   */
  public get metadata(): CountryMetadata {
    return COUNTRY_METADATA[this._value];
  }

  /**
   * Returns ISO 3166-1 alpha-2 code (e.g. 'BR', 'US', 'PT').
   */
  public get alpha2(): string {
    return this.metadata.alpha2;
  }

  /**
   * Returns international telephone dialing prefix (e.g. '+55', '+1', '+351').
   */
  public get ddi(): string {
    return this.metadata.ddi;
  }

  /**
   * Returns national flag emoji (e.g. '🇧🇷', '🇺🇸', '🇵🇹').
   */
  public get flag(): string {
    return this.metadata.flag;
  }

  /**
   * Returns Portuguese country name (e.g. 'Brasil').
   */
  public get namePt(): string {
    return this.metadata.namePt;
  }

  /**
   * Returns English country name (e.g. 'Brazil').
   */
  public get nameEn(): string {
    return this.metadata.nameEn;
  }

  /**
   * True if this country instance is Brazil.
   */
  public get isBrazil(): boolean {
    return this._value === CountryCode.BRA;
  }

  /**
   * Returns localized country name according to specified locale.
   */
  public getName(locale = 'pt-BR'): string {
    return Country.getName(this._value, locale);
  }

  /**
   * Returns formatted display representation: "Nome (CODE)".
   */
  public format(locale = 'pt-BR'): string {
    return `${this.getName(locale)} (${this._value})`;
  }

  /**
   * Returns string representation (ISO alpha-3 code).
   */
  public toString(): string {
    return this._value;
  }

  /**
   * Checks whether a raw country code corresponds to Brazil.
   */
  public static isBrazil(raw: string | null | undefined): boolean {
    return this.clean(raw) === CountryCode.BRA;
  }

  /**
   * Sanitizes raw country code by trimming and converting to uppercase.
   */
  public static clean(raw: string | null | undefined): string {
    return (raw || '').trim().toUpperCase();
  }

  /**
   * Validates if a given code is an accepted ISO 3166-1 alpha-3 standard code.
   */
  public static isValid(raw: string | null | undefined): boolean {
    const cleaned = this.clean(raw);
    return STANDARD_COUNTRIES.includes(cleaned as CountryCode);
  }

  /**
   * Returns localized name for the country code.
   */
  public static getName(code: string | null | undefined, locale = 'pt-BR'): string {
    const cleaned = this.clean(code) as CountryCode;
    if (locale.startsWith('en')) {
      return COUNTRY_NAMES_EN[cleaned] || cleaned;
    }
    return COUNTRY_NAMES_PT[cleaned] || cleaned;
  }

  /**
   * Returns metadata for given country code if valid.
   */
  public static getMetadata(code: string | null | undefined): CountryMetadata | undefined {
    const cleaned = this.clean(code) as CountryCode;
    return COUNTRY_METADATA[cleaned];
  }

  /**
   * Returns a sorted list of country options formatted for UI dropdowns.
   */
  public static getAllCountries(locale = 'pt-BR'): CountryOption[] {
    const isEn = locale.startsWith('en');
    const nameMap = isEn ? COUNTRY_NAMES_EN : COUNTRY_NAMES_PT;

    return STANDARD_COUNTRIES.map((code) => ({
      code,
      name: nameMap[code] || code,
      display: `${nameMap[code] || code} (${code})`,
    })).sort((a, b) => {
      // Keep BRA first as default primary country, then alphabetical
      if (a.code === CountryCode.BRA) return -1;
      if (b.code === CountryCode.BRA) return 1;
      return a.name.localeCompare(b.name, locale);
    });
  }

  /**
   * Factory method to create a validated Country instance.
   * Throws ValidationError if code is invalid.
   */
  public static create(raw: string | null | undefined): Country {
    const cleaned = this.clean(raw);
    if (!this.isValid(cleaned)) {
      throw new ValidationError(
        'country',
        ErrorCode.VALIDATION_ERROR,
        { received: raw, expected: STANDARD_COUNTRIES }
      );
    }
    return new Country(cleaned as CountryCode);
  }

  /**
   * Safe factory method that returns null if code is invalid.
   */
  public static tryCreate(raw: string | null | undefined): Country | null {
    try {
      return this.create(raw);
    } catch {
      return null;
    }
  }
}

