export interface OrganizationDTO {
  id: string;
  tenant_id: string;
  legal_name: string;
  trade_name: string;
  tax_id?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateOrganizationDTO {
  legal_name: string;
  trade_name: string;
  tax_id?: string | null;
  cnpj: string;
  state_registration?: string | null;
  municipal_registration?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  auto_create_headquarters?: boolean;
}

export interface UpdateOrganizationDTO {
  legal_name?: string;
  trade_name?: string;
  tax_id?: string | null;
  cnpj?: string;
  state_registration?: string | null;
  municipal_registration?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_active?: boolean;
}

export interface OrganizationUnitDTO {
  id: string;
  tenant_id: string;
  organization_id: string;
  name: string;
  trade_name?: string | null;
  cnes_code?: string | null;
  tax_id?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateOrganizationUnitDTO {
  organization_id: string;
  name: string;
  trade_name?: string | null;
  cnes_code: string;
  tax_id?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_headquarters?: boolean;
}

export interface UpdateOrganizationUnitDTO {
  organization_id?: string;
  name?: string;
  trade_name?: string | null;
  cnes_code?: string;
  tax_id?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_headquarters?: boolean;
  is_active?: boolean;
}

export interface OrganizationSummaryDTO extends OrganizationDTO {
  units_count: number;
  active_units_count: number;
  has_headquarters: boolean;
}

export type RoomType =
  | 'CONSULTORIO'
  | 'PROCEDIMENTO'
  | 'EXAME'
  | 'TRIAGEM'
  | 'CIRURGIA'
  | 'ATENDIMENTO'
  | 'OUTRO';

export interface RoomDTO {
  id: string;
  tenant_id: string;
  unit_id: string;
  name: string;
  room_type?: RoomType | string | null;
  is_schedulable: boolean;
  equipment_resources?: string[] | string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateRoomDTO {
  unit_id: string;
  name: string;
  room_type?: RoomType | string | null;
  is_schedulable?: boolean;
  equipment_resources?: string[] | string | null;
  notes?: string | null;
}

export interface UpdateRoomDTO {
  unit_id?: string;
  name?: string;
  room_type?: RoomType | string | null;
  is_schedulable?: boolean;
  equipment_resources?: string[] | string | null;
  notes?: string | null;
  is_active?: boolean;
}

