export interface OrganizationData {
  id: string;
  legalName: string;
  tradeName: string;
  taxId?: string;
  cnpj: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  email?: string;
  phone?: string;
  website?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive: boolean;
}

export interface OrganizationUnitData {
  id: string;
  organizationId: string;
  name: string;
  tradeName?: string;
  cnesCode: string;
  taxId?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  isHeadquarters: boolean;
  isActive: boolean;
}

export type RoomType =
  | 'CONSULTORIO'
  | 'PROCEDIMENTO'
  | 'EXAME'
  | 'TRIAGEM'
  | 'CIRURGIA'
  | 'ATENDIMENTO'
  | 'OUTRO';

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  CONSULTORIO: 'Consultório',
  PROCEDIMENTO: 'Procedimento',
  EXAME: 'Exame',
  TRIAGEM: 'Triagem',
  CIRURGIA: 'Cirurgia',
  ATENDIMENTO: 'Atendimento',
  OUTRO: 'Outro',
};

export interface RoomData {
  id: string;
  unitId: string;
  name: string;
  roomType: RoomType;
  isSchedulable: boolean;
  equipmentResources?: string;
  notes?: string;
  isActive: boolean;
}
export type OrganizationsTabMode = 'ORGANIZATIONS' | 'UNITS';

