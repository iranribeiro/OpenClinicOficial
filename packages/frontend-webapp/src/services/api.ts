import type {
  LoginResponse,
  UserProfile,
  RefreshResponse,
  MenuResponse,
  IAMCapability,
  NavigationMenuGroup,
  AclPermissionRecord,
} from '../arch/types/auth.js';
import type {
  OrganizationData,
  OrganizationUnitData,
  RoomData,
  RoomType,
} from '../business/registries/organizations/types.js';
import {
  UserRole,
  ApplicationContext,
  ResourceAction,
  PermissionEffect,
  TenantStatus,
  LoginIdentifierType,
  LoginMethod,
  Cpf,
} from '@openclinic/core/shared';
import { getTranslation, getStoredLocale } from '../i18n/index.js';

const API_BASE = '/api/v1';

let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly detail: string;
  public readonly details?: Record<string, unknown>;

  constructor(detail: string, code: string = 'ERR_INTERNAL', status: number = 500, details?: Record<string, unknown>) {
    super(detail);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.details = details;
  }
}

export interface ActionResponse<T = unknown> {
  code: string;
  message: string;
  data?: T;
}

export function setTokens(accessToken: string | null, refreshToken: string | null): void {
  _accessToken = accessToken;
  _refreshToken = refreshToken;
}

export function clearTokens(): void {
  _accessToken = null;
  _refreshToken = null;
}

export function getAccessToken(): string | null {
  return _accessToken;
}


type SessionExpiredHandler = () => void;
let _onSessionExpired: SessionExpiredHandler | null = null;
let _refreshPromise: Promise<RefreshResponse> | null = null;

export function setOnSessionExpired(handler: SessionExpiredHandler | null): void {
  _onSessionExpired = handler;
}

async function apiFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const currentLocale = getStoredLocale();
  const headers: Record<string, string> = {
    'Accept-Language': currentLocale === 'en-US' ? 'en-US,en;q=0.9' : 'pt-BR,pt;q=0.9',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? 'same-origin',
  });
  if (!response.ok) {
    // Intercept 401 for silent refresh attempt via HttpOnly cookie or RAM token
    if (response.status === 401 && !isRetry && path !== '/auth/login' && path !== '/auth/refresh') {
      try {
        if (!_refreshPromise) {
          _refreshPromise = refreshTokens().finally(() => {
            _refreshPromise = null;
          });
        }
        await _refreshPromise;
        return apiFetch<T>(path, options, true);
      } catch {
        if (_onSessionExpired) {
          _onSessionExpired();
        }
      }
    }

    const errorBody = await response.json().catch(() => ({
      code: 'ERR_COMMUNICATION',
      detail: getTranslation('ERROR_COMMUNICATION'),
    }));
    const errorMsg = errorBody.detail || errorBody.title || getTranslation('ERROR_HTTP_GENERIC', { status: response.status });
    throw new ApiError(errorMsg, errorBody.code || 'ERR_UNKNOWN', response.status, errorBody.details);
  }
  return response.json() as Promise<T>;
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
    credentials: 'same-origin',
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/auth/profile');
}

export async function refreshTokens(): Promise<RefreshResponse> {
  const body = _refreshToken ? JSON.stringify({ refresh_token: _refreshToken }) : JSON.stringify({});
  const data = await apiFetch<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body,
    credentials: 'same-origin',
  });
  setTokens(data.access_token, data.refresh_token ?? _refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  try {
    const body = _refreshToken ? JSON.stringify({ refresh_token: _refreshToken }) : JSON.stringify({});
    await apiFetch('/auth/logout', {
      method: 'POST',
      body,
      credentials: 'same-origin',
    });
  } finally {
    clearTokens();
  }
}

export async function getMenu(): Promise<MenuResponse> {
  return apiFetch<MenuResponse>('/auth/menu');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<ActionResponse<{ id: string }>> {
  return apiFetch<ActionResponse<{ id: string }>>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function forgotPassword(identifier: string): Promise<ActionResponse<{ simulated_email?: string; reset_token?: string; expires_in_minutes: number }>> {
  return apiFetch<ActionResponse<{ simulated_email?: string; reset_token?: string; expires_in_minutes: number }>>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<ActionResponse<{ id: string }>> {
  return apiFetch<ActionResponse<{ id: string }>>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export interface UserListItem {
  id: string;
  username: string;
  email: string;
  cpf?: string | null;
  full_name: string;
  display_name: string;
  job_title?: string | null;
  role: UserRole;
  role_id?: string;
  is_active: boolean;
  is_tenant_owner?: boolean;
  tenant_id?: string | null;
  is_locked?: boolean;
  last_access?: string | null;
  created_at?: string;
}

const INITIAL_USERS_STORE: UserListItem[] = [
  {
    id: '671b5b17-b31a-459e-8707-bdc80994e0d4',
    username: 'joao.silva',
    email: 'joao@clinica.com.br',
    cpf: '123.456.789-09',
    full_name: 'João Silva',
    display_name: 'João Silva',
    role: UserRole.OWNER,
    job_title: 'Superadministrador / Proprietário',
    is_tenant_owner: true,
    is_active: true,
    created_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: '0ff9708d-b06e-4548-b74c-a2849a7daee0',
    username: 'lucas.santos',
    email: 'lucas@clinica.com.br',
    cpf: '987.654.321-00',
    full_name: 'Lucas Santos',
    display_name: 'Lucas Santos',
    role: UserRole.ADMIN,
    job_title: 'Administrador de Sistemas',
    is_tenant_owner: false,
    is_active: true,
    created_at: new Date(Date.now() - 75 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-pract-001',
    username: 'roberto.mendes',
    email: 'roberto.mendes@openclinic.local',
    cpf: '123.456.789-00',
    full_name: 'Dr. Roberto Albuquerque Mendes',
    display_name: 'Dr. Roberto Albuquerque',
    role: UserRole.USER,
    job_title: 'Diretor Clínico e Responsável Técnico',
    is_tenant_owner: false,
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-pract-002',
    username: 'juliana.mendes',
    email: 'juliana.mendes@openclinic.local',
    cpf: '987.654.321-11',
    full_name: 'Dra. Juliana Ferreira Mendes',
    display_name: 'Dra. Juliana Mendes',
    role: UserRole.USER,
    job_title: 'Médica Pediatra',
    is_tenant_owner: false,
    is_active: true,
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-staff-001',
    username: 'carlos.silva',
    email: 'carlos.silva@openclinic.local',
    cpf: '333.444.555-66',
    full_name: 'Carlos Eduardo da Silva',
    display_name: 'Carlos Eduardo da Silva',
    role: UserRole.USER,
    job_title: 'Supervisor de Recepção',
    is_tenant_owner: false,
    is_active: true,
    created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-staff-002',
    username: 'mariana.lima',
    email: 'mariana.lima@openclinic.local',
    cpf: '444.555.666-77',
    full_name: 'Mariana Costa Lima',
    display_name: 'Mariana Costa Lima',
    role: UserRole.USER,
    job_title: 'Analista de Faturamento TISS',
    is_tenant_owner: false,
    is_active: true,
    created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
  },
];

export function getStoredUsers(): UserListItem[] {
  if (typeof window === 'undefined') return INITIAL_USERS_STORE;
  try {
    const raw = localStorage.getItem('openclinic_users_cache');
    if (!raw) {
      localStorage.setItem('openclinic_users_cache', JSON.stringify(INITIAL_USERS_STORE));
      return INITIAL_USERS_STORE;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_USERS_STORE;
  }
}

export function saveStoredUsers(items: UserListItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('openclinic_users_cache', JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function listUsers(): Promise<UserListItem[]> {
  try {
    return await apiFetch<UserListItem[]>('/iam/users');
  } catch {
    return getStoredUsers();
  }
}

export async function createUser(data: {
  email: string;
  username: string;
  cpf?: string | null;
  full_name: string;
  display_name?: string | null;
  job_title?: string | null;
  password: string;
  role: UserRole;
  is_active?: boolean;
}): Promise<ActionResponse<UserListItem>> {
  try {
    return await apiFetch<ActionResponse<UserListItem>>('/iam/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch {
    const list = getStoredUsers();
    const newUser: UserListItem = {
      id: 'user-' + Date.now(),
      username: data.username,
      email: data.email,
      cpf: data.cpf,
      full_name: data.full_name,
      display_name: data.display_name || data.full_name,
      job_title: data.job_title,
      role: data.role,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
    };
    list.unshift(newUser);
    saveStoredUsers(list);
    return {
      code: 'SUCCESS',
      message: 'User created successfully',
      data: newUser,
    };
  }
}

export async function updateUser(
  userId: string,
  data: {
    email: string;
    username: string;
    cpf?: string | null;
    full_name: string;
    display_name?: string | null;
    job_title?: string | null;
    role: UserRole;
    is_active?: boolean;
  }
): Promise<ActionResponse<UserListItem>> {
  try {
    return await apiFetch<ActionResponse<UserListItem>>(`/iam/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch {
    const list = getStoredUsers();
    const idx = list.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ...data,
        display_name: data.display_name || data.full_name || list[idx].display_name,
      };
      saveStoredUsers(list);
      return {
        code: 'SUCCESS',
        message: 'User updated successfully',
        data: list[idx],
      };
    }
    throw new ApiError('User not found', 'NOT_FOUND', 404);
  }
}

export async function adminResetPassword(userId: string, newPassword: string): Promise<ActionResponse<{ id: string }>> {
  return apiFetch<ActionResponse<{ id: string }>>(`/iam/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function toggleUserStatus(userId: string): Promise<ActionResponse<{ id: string; is_active: boolean }>> {
  return apiFetch<ActionResponse<{ id: string; is_active: boolean }>>(`/iam/users/${userId}/status`, {
    method: 'PATCH',
  });
}

export async function deleteUser(userId: string): Promise<ActionResponse<{ id: string }>> {
  return apiFetch<ActionResponse<{ id: string }>>(`/iam/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function unlockUser(userId: string): Promise<ActionResponse<{ id: string }>> {
  return apiFetch<ActionResponse<{ id: string }>>(`/iam/users/${userId}/unlock`, {
    method: 'POST',
  });
}

// ── USER GROUPS & MEMBERSHIPS ──

export interface GroupListItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default?: boolean;
  member_count: number;
  tenant_id: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface GroupMembersResponse {
  group: GroupListItem;
  members: UserListItem[];
  available_users: UserListItem[];
}

export interface UserGroupsResponse {
  user: UserListItem;
  groups: GroupListItem[];
  available_groups: GroupListItem[];
}

export async function listGroups(): Promise<GroupListItem[]> {
  return apiFetch<GroupListItem[]>('/iam/groups');
}

export async function createGroup(data: { name: string; description: string; is_active?: boolean }): Promise<ActionResponse<GroupListItem>> {
  return apiFetch<ActionResponse<GroupListItem>>('/iam/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGroup(groupId: string, data: { name?: string; description?: string; is_active?: boolean }): Promise<ActionResponse<GroupListItem>> {
  return apiFetch<ActionResponse<GroupListItem>>(`/iam/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteGroup(groupId: string): Promise<ActionResponse<{ id: string; name: string }>> {
  return apiFetch<ActionResponse<{ id: string; name: string }>>(`/iam/groups/${groupId}`, {
    method: 'DELETE',
  });
}

export async function getGroupMembers(groupId: string): Promise<GroupMembersResponse> {
  return apiFetch<GroupMembersResponse>(`/iam/groups/${groupId}/members`);
}

export async function addGroupMember(groupId: string, userId: string): Promise<ActionResponse<{ groupId: string; userId: string }>> {
  return apiFetch<ActionResponse<{ groupId: string; userId: string }>>(`/iam/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function removeGroupMember(groupId: string, userId: string): Promise<ActionResponse<{ groupId: string; userId: string }>> {
  return apiFetch<ActionResponse<{ groupId: string; userId: string }>>(`/iam/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function getUserGroups(userId: string): Promise<UserGroupsResponse> {
  return apiFetch<UserGroupsResponse>(`/iam/users/${userId}/groups`);
}

export async function addUserToGroup(userId: string, groupId: string): Promise<ActionResponse<{ userId: string; groupId: string }>> {
  return apiFetch<ActionResponse<{ userId: string; groupId: string }>>(`/iam/users/${userId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ group_id: groupId }),
  });
}

export async function removeUserFromGroup(userId: string, groupId: string): Promise<ActionResponse<{ userId: string; groupId: string }>> {
  return apiFetch<ActionResponse<{ userId: string; groupId: string }>>(`/iam/users/${userId}/groups/${groupId}`, {
    method: 'DELETE',
  });
}

// ── IAM & ACCESS CONTROL (RBAC + ACL) ──

export async function getPermissions(): Promise<string[]> {
  return apiFetch<string[]>('/iam/permissions');
}

export async function getCapabilities(): Promise<IAMCapability[]> {
  return apiFetch<IAMCapability[]>('/iam/capabilities');
}

export async function getNavigation(context: ApplicationContext = ApplicationContext.BUSINESS): Promise<NavigationMenuGroup[]> {
  return apiFetch<NavigationMenuGroup[]>(`/iam/navigation?context=${context}`);
}

export async function listResources(): Promise<any[]> {
  return apiFetch<any[]>('/iam/resources');
}

export async function getResourceTree(context?: ApplicationContext): Promise<any[]> {
  return apiFetch<any[]>(`/iam/resources/tree${context ? `?context=${context}` : ''}`);
}

export async function getUserAcl(userId: string): Promise<AclPermissionRecord[]> {
  return apiFetch<AclPermissionRecord[]>(`/iam/permissions/user/${userId}`);
}

export async function getUserInheritedAcl(userId: string): Promise<AclPermissionRecord[]> {
  return apiFetch<AclPermissionRecord[]>(`/iam/permissions/user/${userId}/inherited`);
}

export async function getGroupAcl(groupId: string): Promise<AclPermissionRecord[]> {
  return apiFetch<AclPermissionRecord[]>(`/iam/permissions/group/${groupId}`);
}

export async function syncPermissions(payload: {
  user_id?: string;
  group_id?: string;
  permissions: { resource_key: string; actions: ResourceAction[]; effect?: PermissionEffect }[];
}): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/iam/permissions/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


// ── SYSTEM & PLATFORM (SYS_APPLICATIONS & CONFIGS) ──

export interface PlatformApplicationData {
  id: string;
  code: string;
  appName: string;
  appVersion: string;
  appLogoUrl: string | null;
  appFaviconUrl: string | null;
  appSubtitle: string | null;
  appDescription: string | null;
  defaultLocale: string;
  defaultSupportedLocales: string[];
  defaultTimezone: string;
  defaultDialingCode: string;
  defaultMaxLoginAttempts: number;
  defaultLockoutDurationMinutes: number;
  defaultSessionTimeoutMinutes: number;
  defaultMinPasswordLength: number;
  defaultMfaEnabled: boolean;
  defaultPasswordResetTokenTtlHours: number;
  defaultEnableAuditLog?: boolean;
  defaultAuditRetentionDays: number;
  defaultAcceptedLoginMethods: LoginMethod[];
  defaultExtraSettings: Record<string, unknown>;
  primaryLoginIdentifier: LoginIdentifierType;
  allowDirectUserCreation?: boolean;
  isMultiTenant: boolean;
  isDefaultApplication: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantApplicationConfigData {
  id: string;
  applicationId: string;
  tenantId: string | null;
  isPrimaryForTenant: boolean;
  isActive: boolean;
  enforceDocumentAcceptanceOnLogin: boolean;
  configJson: {
    operatingHours?: {
      weekdays?: string;
      saturdays?: string;
      sundays?: string;
    };
    appointmentIntervalMinutes?: number;
    cancellationLeadTimeHours?: number;
    contactPhone?: string;
    contactEmail?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TenantApplicationConfigResponse {
  application: {
    id: string;
    code: string;
    appName: string;
    appVersion: string;
    appSubtitle: string | null;
    appDescription: string | null;
    appLogoUrl: string | null;
    appFaviconUrl: string | null;
    defaultLocale: string;
    defaultSupportedLocales: string[];
    defaultTimezone: string;
    isMultiTenant: boolean;
  };
  config: TenantApplicationConfigData;
}

export async function getPlatformApplication(): Promise<PlatformApplicationData> {
  return apiFetch<PlatformApplicationData>('/arch/platform/application');
}

export async function updatePlatformApplication(
  data: Partial<PlatformApplicationData>
): Promise<ActionResponse<PlatformApplicationData>> {
  return apiFetch<ActionResponse<PlatformApplicationData>>('/arch/platform/application', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getCurrentApplicationConfig(): Promise<TenantApplicationConfigResponse> {
  return apiFetch<TenantApplicationConfigResponse>('/arch/application-configs/current');
}

export async function updateCurrentApplicationConfig(data: {
  isActive?: boolean;
  enforceDocumentAcceptanceOnLogin?: boolean;
  configJson?: Record<string, unknown>;
}): Promise<ActionResponse<TenantApplicationConfigData>> {
  return apiFetch<ActionResponse<TenantApplicationConfigData>>('/arch/application-configs/current', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface PublicConfig {
  productName?: string;
  appName: string;
  appSubtitle: string | null;
  appVersion: string;
  appLogoUrl: string | null;
  appFaviconUrl: string | null;
  appDescription: string | null;
  tenantName: string;
  defaultLocale: string;
  supportedLocales: string[];
  defaultTimezone: string;
  defaultDialingCode: string;
  acceptedLoginMethods?: LoginMethod[];
  primaryLoginIdentifier?: LoginIdentifierType;
  allowDirectUserCreation?: boolean;
  sessionTimeoutMinutes?: number;
}


export async function getPublicConfig(): Promise<PublicConfig> {
  return apiFetch<PublicConfig>(`/public/config?_t=${Date.now()}`, {
    cache: 'no-store',
  });
}


export function applyDocumentBranding(
  title?: string | null,
  faviconUrl?: string | null,
  locale?: string | null
): void {
  if (typeof document === 'undefined') return;
  if (locale && locale.trim()) {
    document.documentElement.lang = locale.trim();
  }
  if (title && title.trim()) {
    document.title = title.trim();
  }
  if (faviconUrl && faviconUrl.trim()) {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl.trim();
  }
}

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  taxId?: string | null;
  cnpj?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isDefault: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type TenantPayload = Partial<Omit<TenantData, 'id' | 'createdAt' | 'updatedAt'>>;

export async function listTenants(): Promise<TenantData[]> {
  return apiFetch<TenantData[]>('/arch/tenants');
}

export async function getTenantById(id: string): Promise<TenantData> {
  return apiFetch<TenantData>(`/arch/tenants/${encodeURIComponent(id)}`);
}

export async function createTenant(data: TenantPayload): Promise<ActionResponse<TenantData>> {
  return apiFetch<ActionResponse<TenantData>>('/arch/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTenant(id: string, data: TenantPayload): Promise<ActionResponse<TenantData>> {
  return apiFetch<ActionResponse<TenantData>>(`/arch/tenants/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTenant(id: string): Promise<ActionResponse<void>> {
  return apiFetch<ActionResponse<void>>(`/arch/tenants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Business Registries: Practitioners (Profissionais de Saúde) ──

export interface PractitionerRegistrationItem {
  id?: string;
  registration_number: string;
  registration_type: string;
  registration_state: string;
  is_primary: boolean;
  issued_date?: string | null;
  valid_until?: string | null;
}

export interface PractitionerSpecialtyItem {
  id?: string;
  specialty_id: string;
  specialty_name?: string;
  is_primary: boolean;
  rqe_number?: string | null;
  rqe_issued_date?: string | null;
}

export interface PractitionerQualificationItem {
  id?: string;
  qualification_type: string;
  degree_name: string;
  institution_name: string;
  completion_year?: number | null;
}

export interface PractitionerAvailabilityItem {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

export interface PractitionerItem {
  id: string;
  tenant_id: string;
  user_id: string;
  username?: string | null;
  full_name: string;
  social_name?: string | null;
  cpf?: string | null;
  cns?: string | null;
  birth_date: string;
  gender: string;
  email: string;
  phone?: string | null;
  photo_url?: string | null;
  is_active: boolean;
  is_technical_lead: boolean;
  digital_signature_type: string;
  calendar_color?: string | null;
  notes?: string | null;
  created_at: string;
  registrations?: PractitionerRegistrationItem[];
  specialties?: PractitionerSpecialtyItem[];
  qualifications?: PractitionerQualificationItem[];
  availability?: PractitionerAvailabilityItem[];
}

export interface CreatePractitionerPayload {
  username?: string;
  full_name: string;
  social_name?: string;
  cpf?: string;
  cns?: string;
  birth_date: string;
  gender: string;
  email: string;
  phone?: string;
  photo_url?: string;
  is_technical_lead?: boolean;
  digital_signature_type?: string;
  calendar_color?: string;
  notes?: string;
  login_password?: string;
  registrations?: PractitionerRegistrationItem[];
  specialties?: PractitionerSpecialtyItem[];
  qualifications?: PractitionerQualificationItem[];
  availability?: PractitionerAvailabilityItem[];
}

export interface SpecialtyItem {
  id: string;
  code: string;
  name: string;
  name_en?: string | null;
  cbo_code?: string | null;
  fhir_code?: string | null;
  is_active: boolean;
}

const DEFAULT_SPECIALTIES: SpecialtyItem[] = [
  { id: 'spec-001', code: '2251-05', name: 'Clínica Geral', name_en: 'General Practice', cbo_code: '2251-05', fhir_code: 'GP', is_active: true },
  { id: 'spec-002', code: '2251-10', name: 'Cirurgia Geral', name_en: 'General Surgery', cbo_code: '2251-10', fhir_code: 'SURG', is_active: true },
  { id: 'spec-003', code: '2251-15', name: 'Cardiologia', name_en: 'Cardiology', cbo_code: '2251-15', fhir_code: 'CARD', is_active: true },
  { id: 'spec-004', code: '2251-20', name: 'Dermatologia', name_en: 'Dermatology', cbo_code: '2251-20', fhir_code: 'DERM', is_active: true },
  { id: 'spec-005', code: '2251-25', name: 'Gastroenterologia', name_en: 'Gastroenterology', cbo_code: '2251-25', fhir_code: 'GASTRO', is_active: true },
  { id: 'spec-006', code: '2251-30', name: 'Pediatria', name_en: 'Pediatrics', cbo_code: '2251-30', fhir_code: 'PED', is_active: true },
  { id: 'spec-007', code: '2251-35', name: 'Oftalmologia', name_en: 'Ophthalmology', cbo_code: '2251-35', fhir_code: 'OPH', is_active: true },
  { id: 'spec-008', code: '2251-40', name: 'Otorrinolaringologia', name_en: 'Otolaryngology', cbo_code: '2251-40', fhir_code: 'ORL', is_active: true },
  { id: 'spec-009', code: '2251-45', name: 'Neurologia', name_en: 'Neurology', cbo_code: '2251-45', fhir_code: 'NEUR', is_active: true },
  { id: 'spec-010', code: '2251-50', name: 'Psiquiatria', name_en: 'Psychiatry', cbo_code: '2251-50', fhir_code: 'PSY', is_active: true },
  { id: 'spec-011', code: '2251-55', name: 'Ortopedia e Traumatologia', name_en: 'Orthopedics', cbo_code: '2251-55', fhir_code: 'ORTHO', is_active: true },
  { id: 'spec-012', code: '2251-60', name: 'Ginecologia e Obstetrícia', name_en: 'Gynecology and Obstetrics', cbo_code: '2251-60', fhir_code: 'OBGYN', is_active: true },
  { id: 'spec-013', code: '2261-10', name: 'Odontologia', name_en: 'Dentistry', cbo_code: '2261-10', fhir_code: 'DENT', is_active: true },
  { id: 'spec-014', code: '3222-05', name: 'Enfermagem', name_en: 'Nursing', cbo_code: '3222-05', fhir_code: 'NURSE', is_active: true },
  { id: 'spec-015', code: '2515-10', name: 'Psicologia Clínica', name_en: 'Clinical Psychology', cbo_code: '2515-10', fhir_code: 'PSYCH', is_active: true },
  { id: 'spec-016', code: '2236-05', name: 'Fisioterapia Geral', name_en: 'Physiotherapy', cbo_code: '2236-05', fhir_code: 'PHYSIO', is_active: true },
  { id: 'spec-017', code: '2237-10', name: 'Nutrição', name_en: 'Nutrition', cbo_code: '2237-10', fhir_code: 'NUT', is_active: true },
];

const INITIAL_PRACTITIONERS_STORE: PractitionerItem[] = [
  {
    id: 'pract-001',
    tenant_id: 'acme-tenant',
    user_id: 'user-pract-001',
    username: 'roberto.mendes',
    full_name: 'Dr. Roberto Albuquerque Mendes',
    social_name: 'Dr. Roberto Albuquerque',
    cpf: '123.456.789-00',
    cns: '700000000000001',
    birth_date: '1982-05-14',
    gender: 'MALE',
    email: 'roberto.mendes@openclinic.local',
    phone: '(11) 98765-4321',
    is_active: true,
    is_technical_lead: true,
    digital_signature_type: 'ICP_BRASIL_A3',
    calendar_color: '#0284c7',
    notes: 'Diretor Clínico e Responsável Técnico (CRM 123456-SP). Especialista Titular em Cardiologia com RQE ativo.',
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    registrations: [
      {
        id: 'reg-001',
        registration_number: '123456',
        registration_type: 'CRM',
        registration_state: 'SP',
        is_primary: true,
        issued_date: '2008-01-15',
        valid_until: null,
      },
    ],
    specialties: [
      {
        id: 'pspec-001',
        specialty_id: 'spec-003',
        specialty_name: 'Cardiologia',
        is_primary: true,
        rqe_number: '45892',
        rqe_issued_date: '2012-06-20',
      },
      {
        id: 'pspec-002',
        specialty_id: 'spec-001',
        specialty_name: 'Clínica Geral',
        is_primary: false,
        rqe_number: null,
        rqe_issued_date: null,
      },
    ],
    qualifications: [
      {
        id: 'qual-001',
        qualification_type: 'GRADUATION',
        degree_name: 'Medicina',
        institution_name: 'Faculdade de Medicina da USP',
        completion_year: 2007,
      },
      {
        id: 'qual-002',
        qualification_type: 'RESIDENCY',
        degree_name: 'Residência em Cardiologia Clínica',
        institution_name: 'Instituto do Coração (InCor)',
        completion_year: 2011,
      },
    ],
    availability: [
      { id: 'avail-001', day_of_week: 1, start_time: '08:00', end_time: '12:00', slot_duration_minutes: 30 },
      { id: 'avail-002', day_of_week: 3, start_time: '14:00', end_time: '18:00', slot_duration_minutes: 30 },
      { id: 'avail-003', day_of_week: 5, start_time: '08:00', end_time: '12:00', slot_duration_minutes: 30 },
    ],
  },
  {
    id: 'pract-002',
    tenant_id: 'acme-tenant',
    user_id: 'user-pract-002',
    username: 'juliana.mendes',
    full_name: 'Dra. Juliana Ferreira Mendes',
    social_name: 'Dra. Juliana Mendes',
    cpf: '987.654.321-11',
    cns: '700000000000002',
    birth_date: '1987-11-22',
    gender: 'FEMALE',
    email: 'juliana.mendes@openclinic.local',
    phone: '(21) 99887-1122',
    is_active: true,
    is_technical_lead: false,
    digital_signature_type: 'ICP_BRASIL_CLOUD',
    calendar_color: '#059669',
    notes: 'Pediatra geral e Neonatologista. Atendimento humanizado e puericultura.',
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    registrations: [
      {
        id: 'reg-002',
        registration_number: '789012',
        registration_type: 'CRM',
        registration_state: 'RJ',
        is_primary: true,
        issued_date: '2012-08-10',
        valid_until: null,
      },
    ],
    specialties: [
      {
        id: 'pspec-003',
        specialty_id: 'spec-006',
        specialty_name: 'Pediatria',
        is_primary: true,
        rqe_number: '62134',
        rqe_issued_date: '2016-03-15',
      },
    ],
    qualifications: [
      {
        id: 'qual-003',
        qualification_type: 'GRADUATION',
        degree_name: 'Medicina',
        institution_name: 'UFRJ',
        completion_year: 2012,
      },
    ],
    availability: [
      { id: 'avail-004', day_of_week: 2, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 20 },
      { id: 'avail-005', day_of_week: 4, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 20 },
    ],
  },
];

function getStoredPractitioners(): PractitionerItem[] {
  if (typeof window === 'undefined') return INITIAL_PRACTITIONERS_STORE;
  try {
    const raw = localStorage.getItem('openclinic_practitioners_cache');
    if (!raw) {
      localStorage.setItem('openclinic_practitioners_cache', JSON.stringify(INITIAL_PRACTITIONERS_STORE));
      return INITIAL_PRACTITIONERS_STORE;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PRACTITIONERS_STORE;
  }
}

function saveStoredPractitioners(items: PractitionerItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('openclinic_practitioners_cache', JSON.stringify(items));
  } catch {
    // Ignore storage quota
  }
}

export function checkIdentityUniqueness(params: {
  username?: string;
  cpf?: string;
  email?: string;
  excludeUserId?: string;
  excludePractitionerId?: string;
  excludeStaffId?: string;
}): { usernameError?: string; cpfError?: string; emailError?: string } {
  const result: { usernameError?: string; cpfError?: string; emailError?: string } = {};

  const cleanUser = params.username?.trim().toLowerCase();
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanCpfNum = params.cpf ? Cpf.clean(params.cpf) : '';

  const users = getStoredUsers();
  const practitioners = getStoredPractitioners();
  const staff = getStoredStaff();

  // 1. Check in Users
  for (const u of users) {
    if (params.excludeUserId && u.id === params.excludeUserId) continue;

    if (cleanEmail && u.email?.trim().toLowerCase() === cleanEmail) {
      result.emailError = getTranslation('VALIDATION_ERROR_EMAIL_EXISTS');
    }
    if (cleanUser && u.username?.trim().toLowerCase() === cleanUser) {
      result.usernameError = getTranslation('VALIDATION_ERROR_USERNAME_EXISTS');
    }
    if (cleanCpfNum && u.cpf && Cpf.clean(u.cpf) === cleanCpfNum) {
      result.cpfError = getTranslation('VALIDATION_ERROR_CPF_EXISTS');
    }
  }

  // 2. Check in Practitioners
  for (const p of practitioners) {
    if (params.excludePractitionerId && p.id === params.excludePractitionerId) continue;
    if (params.excludeUserId && p.user_id === params.excludeUserId) continue;

    if (cleanEmail && p.email?.trim().toLowerCase() === cleanEmail) {
      result.emailError = getTranslation('VALIDATION_ERROR_EMAIL_EXISTS');
    }
    if (cleanUser && p.username && p.username.trim().toLowerCase() === cleanUser) {
      result.usernameError = getTranslation('VALIDATION_ERROR_USERNAME_EXISTS');
    }
    if (cleanCpfNum && p.cpf && Cpf.clean(p.cpf) === cleanCpfNum) {
      result.cpfError = getTranslation('VALIDATION_ERROR_CPF_EXISTS');
    }
  }

  // 3. Check in Staff
  for (const s of staff) {
    if (params.excludeStaffId && s.id === params.excludeStaffId) continue;
    if (params.excludeUserId && s.user_id === params.excludeUserId) continue;

    if (cleanEmail && s.email?.trim().toLowerCase() === cleanEmail) {
      result.emailError = getTranslation('VALIDATION_ERROR_EMAIL_EXISTS');
    }
    if (cleanUser && s.username && s.username.trim().toLowerCase() === cleanUser) {
      result.usernameError = getTranslation('VALIDATION_ERROR_USERNAME_EXISTS');
    }
    if (cleanCpfNum && s.cpf && Cpf.clean(s.cpf) === cleanCpfNum) {
      result.cpfError = getTranslation('VALIDATION_ERROR_CPF_EXISTS');
    }
  }

  return result;
}

export async function listPractitioners(): Promise<PractitionerItem[]> {
  try {
    const res = await apiFetch<{ items?: PractitionerItem[]; total?: number } | PractitionerItem[]>(
      '/business/practitioners'
    );
    const items = Array.isArray(res) ? res : (res?.items || []);
    if (items.length > 0) return items;
    return getStoredPractitioners();
  } catch {
    return getStoredPractitioners();
  }
}

export async function getPractitionerById(id: string): Promise<PractitionerItem | null> {
  try {
    return await apiFetch<PractitionerItem>(`/business/practitioners/${encodeURIComponent(id)}`);
  } catch {
    const list = getStoredPractitioners();
    return list.find((p) => p.id === id) ?? null;
  }
}

export async function createPractitioner(payload: CreatePractitionerPayload): Promise<ActionResponse<PractitionerItem>> {
  try {
    return await apiFetch<ActionResponse<PractitionerItem>>('/business/practitioners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    const username = payload.username?.trim().toLowerCase() || payload.email.split('@')[0];
    const collisions = checkIdentityUniqueness({
      username,
      cpf: payload.cpf,
      email: payload.email,
    });
    if (collisions.usernameError || collisions.cpfError || collisions.emailError) {
      const err = collisions.usernameError || collisions.cpfError || collisions.emailError;
      throw new ApiError(err!, 'VALIDATION_ERROR', 400);
    }

    const list = getStoredPractitioners();
    const newId = 'pract-' + Date.now();
    const newUserId = 'user-' + Date.now();
    const newPractitioner: PractitionerItem = {
      id: newId,
      tenant_id: 'default-tenant',
      user_id: newUserId,
      username,
      full_name: payload.full_name,
      social_name: payload.social_name || null,
      cpf: payload.cpf || null,
      cns: payload.cns || null,
      birth_date: payload.birth_date,
      gender: payload.gender,
      email: payload.email,
      phone: payload.phone || null,
      photo_url: payload.photo_url || null,
      is_active: true,
      is_technical_lead: payload.is_technical_lead ?? false,
      digital_signature_type: payload.digital_signature_type ?? 'NONE',
      calendar_color: payload.calendar_color || '#0284c7',
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
      registrations: payload.registrations || [],
      specialties: payload.specialties || [],
      qualifications: payload.qualifications || [],
      availability: payload.availability || [],
    };
    list.unshift(newPractitioner);
    saveStoredPractitioners(list);

    // Sync to stored users
    const users = getStoredUsers();
    users.unshift({
      id: newUserId,
      username,
      email: payload.email,
      cpf: payload.cpf || null,
      full_name: payload.full_name,
      display_name: payload.social_name || payload.full_name,
      job_title: 'Profissional de Saúde',
      role: UserRole.USER,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    saveStoredUsers(users);

    return {
      code: 'SUCCESS',
      message: 'Practitioner created successfully',
      data: newPractitioner,
    };
  }
}

export async function updatePractitioner(id: string, payload: Partial<CreatePractitionerPayload>): Promise<ActionResponse<PractitionerItem>> {
  try {
    return await apiFetch<ActionResponse<PractitionerItem>>(`/business/practitioners/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } catch {
    const list = getStoredPractitioners();
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const current = list[idx];
      const newUsername = payload.username !== undefined ? payload.username?.trim().toLowerCase() : current.username;
      const newEmail = payload.email !== undefined ? payload.email?.trim().toLowerCase() : current.email;
      const newCpf = payload.cpf !== undefined ? payload.cpf : current.cpf;

      const collisions = checkIdentityUniqueness({
        username: newUsername || undefined,
        cpf: newCpf || undefined,
        email: newEmail || undefined,
        excludePractitionerId: current.id,
        excludeUserId: current.user_id,
      });
      if (collisions.usernameError || collisions.cpfError || collisions.emailError) {
        const err = collisions.usernameError || collisions.cpfError || collisions.emailError;
        throw new ApiError(err!, 'VALIDATION_ERROR', 400);
      }

      list[idx] = {
        ...list[idx],
        ...payload,
        full_name: payload.full_name ?? list[idx].full_name,
        username: newUsername,
        cpf: newCpf,
        email: newEmail ?? list[idx].email,
        birth_date: payload.birth_date ?? list[idx].birth_date,
        gender: payload.gender ?? list[idx].gender,
        registrations: payload.registrations ?? list[idx].registrations,
        specialties: payload.specialties ?? list[idx].specialties,
        qualifications: payload.qualifications ?? list[idx].qualifications,
        availability: payload.availability ?? list[idx].availability,
      };
      saveStoredPractitioners(list);

      // Cascading update to users store via user_id!
      if (current.user_id) {
        const users = getStoredUsers();
        const uIdx = users.findIndex((u) => u.id === current.user_id);
        if (uIdx >= 0) {
          users[uIdx] = {
            ...users[uIdx],
            full_name: list[idx].full_name,
            display_name: list[idx].social_name || list[idx].full_name,
            email: list[idx].email,
            cpf: list[idx].cpf,
            username: list[idx].username || users[uIdx].username,
          };
          saveStoredUsers(users);
        }
      }

      return {
        code: 'SUCCESS',
        message: 'Practitioner updated successfully',
        data: list[idx],
      };
    }
    throw new ApiError('Practitioner not found', 'NOT_FOUND', 404);
  }
}

export async function deletePractitioner(id: string): Promise<ActionResponse<void>> {
  try {
    return await apiFetch<ActionResponse<void>>(`/business/practitioners/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    const list = getStoredPractitioners();
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) {
      list[idx].is_active = false;
      saveStoredPractitioners(list);
    }
    return {
      code: 'SUCCESS',
      message: 'Practitioner deactivated successfully',
    };
  }
}

export async function listSpecialties(): Promise<SpecialtyItem[]> {
  try {
    return await apiFetch<SpecialtyItem[]>('/business/specialties');
  } catch {
    return DEFAULT_SPECIALTIES;
  }
}

// ── Business Registries: Staff (Administrative Collaborators) ──

export interface StaffQualificationItem {
  id?: string;
  qualification_type: string;
  title: string;
  institution_name: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  certificate_number?: string | null;
}

export interface StaffItem {
  id: string;
  tenant_id: string;
  user_id: string;
  username?: string | null;
  full_name: string;
  cpf?: string | null;
  email: string;
  phone?: string | null;
  staff_type: string;
  department: string;
  job_title: string;
  contract_type: string;
  admission_date: string;
  resignation_date?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  qualifications?: StaffQualificationItem[];
}

export interface CreateStaffPayload {
  username?: string;
  full_name: string;
  cpf?: string;
  email: string;
  phone?: string;
  staff_type: string;
  department: string;
  job_title: string;
  contract_type: string;
  admission_date: string;
  notes?: string;
  login_password?: string;
  qualifications?: StaffQualificationItem[];
}

const INITIAL_STAFF_STORE: StaffItem[] = [
  {
    id: 'staff-001',
    tenant_id: 'acme-tenant',
    user_id: 'user-staff-001',
    username: 'carlos.silva',
    full_name: 'Carlos Eduardo da Silva',
    cpf: '333.444.555-66',
    email: 'carlos.silva@openclinic.local',
    phone: '(11) 97654-3210',
    staff_type: 'RECEPTIONIST',
    department: 'Recepção e Atendimento',
    job_title: 'Supervisor de Recepção',
    contract_type: 'CLT',
    admission_date: '2021-03-01',
    is_active: true,
    notes: 'Responsável pela triagem de pacientes, controle de guias TISS e treinamento da recepção.',
    created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    qualifications: [
      {
        id: 'squal-001',
        qualification_type: 'TRAINING_LGPD',
        title: 'Certificação em Boas Práticas LGPD na Saúde',
        institution_name: 'OpenClinic Academy',
        issue_date: '2023-04-10',
        certificate_number: 'LGPD-2023-9981',
      },
      {
        id: 'squal-002',
        qualification_type: 'TISS_BILLING',
        title: 'Faturamento de Guias e Protocolos TISS/ANS',
        institution_name: 'SENAC Saúde',
        issue_date: '2022-09-15',
        certificate_number: 'TISS-8841',
      },
    ],
  },
  {
    id: 'staff-002',
    tenant_id: 'acme-tenant',
    user_id: 'user-staff-002',
    username: 'mariana.lima',
    full_name: 'Mariana Costa Lima',
    cpf: '444.555.666-77',
    email: 'mariana.lima@openclinic.local',
    phone: '(11) 98112-2334',
    staff_type: 'FINANCIAL',
    department: 'Faturamento & Convênios',
    job_title: 'Analista de Faturamento TISS',
    contract_type: 'CLT',
    admission_date: '2022-07-15',
    is_active: true,
    notes: 'Auditoria de glosas e conciliação de XMLs ANS.',
    created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
    qualifications: [
      {
        id: 'squal-003',
        qualification_type: 'TISS_BILLING',
        title: 'Especialista em Glosas e Recursos de Operadoras',
        institution_name: 'ABRAMGE Cursos',
        issue_date: '2023-01-20',
        certificate_number: 'GLOSA-5521',
      },
    ],
  },
];

function getStoredStaff(): StaffItem[] {
  if (typeof window === 'undefined') return INITIAL_STAFF_STORE;
  try {
    const raw = localStorage.getItem('openclinic_staff_cache');
    if (!raw) {
      localStorage.setItem('openclinic_staff_cache', JSON.stringify(INITIAL_STAFF_STORE));
      return INITIAL_STAFF_STORE;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_STAFF_STORE;
  }
}

function saveStoredStaff(items: StaffItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('openclinic_staff_cache', JSON.stringify(items));
  } catch {
    // Ignore storage quota
  }
}

export async function listStaff(): Promise<StaffItem[]> {
  try {
    const res = await apiFetch<{ items?: StaffItem[]; total?: number } | StaffItem[]>('/business/staff');
    const items = Array.isArray(res) ? res : (res?.items || []);
    if (items.length > 0) return items;
    return getStoredStaff();
  } catch {
    return getStoredStaff();
  }
}

export async function getStaffById(id: string): Promise<StaffItem | null> {
  try {
    return await apiFetch<StaffItem>(`/business/staff/${encodeURIComponent(id)}`);
  } catch {
    const list = getStoredStaff();
    return list.find((s) => s.id === id) ?? null;
  }
}

export async function createStaff(payload: CreateStaffPayload): Promise<ActionResponse<StaffItem>> {
  try {
    return await apiFetch<ActionResponse<StaffItem>>('/business/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    const username = payload.username?.trim().toLowerCase() || payload.email.split('@')[0];
    const collisions = checkIdentityUniqueness({
      username,
      cpf: payload.cpf,
      email: payload.email,
    });
    if (collisions.usernameError || collisions.cpfError || collisions.emailError) {
      const err = collisions.usernameError || collisions.cpfError || collisions.emailError;
      throw new ApiError(err!, 'VALIDATION_ERROR', 400);
    }

    const list = getStoredStaff();
    const newId = 'staff-' + Date.now();
    const newUserId = 'user-' + Date.now();
    const newStaff: StaffItem = {
      id: newId,
      tenant_id: 'default-tenant',
      user_id: newUserId,
      username,
      full_name: payload.full_name,
      cpf: payload.cpf || null,
      email: payload.email,
      phone: payload.phone || null,
      staff_type: payload.staff_type,
      department: payload.department,
      job_title: payload.job_title,
      contract_type: payload.contract_type,
      admission_date: payload.admission_date,
      is_active: true,
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
      qualifications: payload.qualifications || [],
    };
    list.unshift(newStaff);
    saveStoredStaff(list);

    // Sync to stored users
    const users = getStoredUsers();
    users.unshift({
      id: newUserId,
      username,
      email: payload.email,
      cpf: payload.cpf || null,
      full_name: payload.full_name,
      display_name: payload.full_name,
      job_title: payload.job_title,
      role: UserRole.USER,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    saveStoredUsers(users);

    return {
      code: 'SUCCESS',
      message: 'Staff member created successfully',
      data: newStaff,
    };
  }
}

export async function updateStaff(id: string, payload: Partial<CreateStaffPayload>): Promise<ActionResponse<StaffItem>> {
  try {
    return await apiFetch<ActionResponse<StaffItem>>(`/business/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } catch {
    const list = getStoredStaff();
    const idx = list.findIndex((s) => s.id === id);
    if (idx >= 0) {
      const current = list[idx];
      const newUsername = payload.username !== undefined ? payload.username?.trim().toLowerCase() : current.username;
      const newEmail = payload.email !== undefined ? payload.email?.trim().toLowerCase() : current.email;
      const newCpf = payload.cpf !== undefined ? payload.cpf : current.cpf;

      const collisions = checkIdentityUniqueness({
        username: newUsername || undefined,
        cpf: newCpf || undefined,
        email: newEmail || undefined,
        excludeStaffId: current.id,
        excludeUserId: current.user_id,
      });
      if (collisions.usernameError || collisions.cpfError || collisions.emailError) {
        const err = collisions.usernameError || collisions.cpfError || collisions.emailError;
        throw new ApiError(err!, 'VALIDATION_ERROR', 400);
      }

      list[idx] = {
        ...list[idx],
        ...payload,
        full_name: payload.full_name ?? list[idx].full_name,
        username: newUsername,
        cpf: newCpf,
        email: newEmail ?? list[idx].email,
        staff_type: payload.staff_type ?? list[idx].staff_type,
        department: payload.department ?? list[idx].department,
        job_title: payload.job_title ?? list[idx].job_title,
        contract_type: payload.contract_type ?? list[idx].contract_type,
        admission_date: payload.admission_date ?? list[idx].admission_date,
        qualifications: payload.qualifications ?? list[idx].qualifications,
      };
      saveStoredStaff(list);

      // Cascading update to users store via user_id!
      if (current.user_id) {
        const users = getStoredUsers();
        const uIdx = users.findIndex((u) => u.id === current.user_id);
        if (uIdx >= 0) {
          users[uIdx] = {
            ...users[uIdx],
            full_name: list[idx].full_name,
            display_name: list[idx].full_name,
            email: list[idx].email,
            cpf: list[idx].cpf,
            username: list[idx].username || users[uIdx].username,
            job_title: list[idx].job_title || users[uIdx].job_title,
          };
          saveStoredUsers(users);
        }
      }

      return {
        code: 'SUCCESS',
        message: 'Staff member updated successfully',
        data: list[idx],
      };
    }
    throw new ApiError('Staff member not found', 'NOT_FOUND', 404);
  }
}

export async function deleteStaff(id: string): Promise<ActionResponse<void>> {
  try {
    return await apiFetch<ActionResponse<void>>(`/business/staff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    const list = getStoredStaff();
    const idx = list.findIndex((s) => s.id === id);
    if (idx >= 0) {
      list[idx].is_active = false;
      saveStoredStaff(list);
    }
    return {
      code: 'SUCCESS',
      message: 'Staff member deactivated successfully',
    };
  }
}

// ── Business Registries: Organizations, Units & Rooms ────────────────────────

export async function listOrganizations(): Promise<OrganizationData[]> {
  return await apiFetch<OrganizationData[]>('/business/organizations');
}

export async function getOrganizationById(id: string): Promise<OrganizationData> {
  return await apiFetch<OrganizationData>(`/business/organizations/${encodeURIComponent(id)}`);
}

export async function createOrganization(
  payload: OrganizationData,
  autoCreateHeadquarters = false
): Promise<ActionResponse<OrganizationData>> {
  return await apiFetch<ActionResponse<OrganizationData>>('/business/organizations', {
    method: 'POST',
    body: JSON.stringify({ ...payload, autoCreateHeadquarters }),
  });
}

export async function updateOrganization(
  id: string,
  payload: Partial<OrganizationData>
): Promise<ActionResponse<OrganizationData>> {
  return await apiFetch<ActionResponse<OrganizationData>>(`/business/organizations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOrganization(id: string): Promise<ActionResponse<void>> {
  return await apiFetch<ActionResponse<void>>(`/business/organizations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Organization Units API ──

export async function listOrganizationUnits(organizationId?: string): Promise<OrganizationUnitData[]> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  return await apiFetch<OrganizationUnitData[]>(`/business/organization-units${query}`);
}

export async function createOrganizationUnit(
  payload: OrganizationUnitData
): Promise<ActionResponse<OrganizationUnitData>> {
  return await apiFetch<ActionResponse<OrganizationUnitData>>('/business/organization-units', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrganizationUnit(
  id: string,
  payload: Partial<OrganizationUnitData>
): Promise<ActionResponse<OrganizationUnitData>> {
  return await apiFetch<ActionResponse<OrganizationUnitData>>(`/business/organization-units/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOrganizationUnit(id: string): Promise<ActionResponse<void>> {
  return await apiFetch<ActionResponse<void>>(`/business/organization-units/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Rooms API ──

interface RawRoomBackend {
  id: string;
  unit_id?: string;
  unitId?: string;
  name: string;
  room_type?: string;
  roomType?: string;
  is_schedulable?: boolean;
  isSchedulable?: boolean;
  equipment?: string[];
  equipment_resources?: string;
  equipmentResources?: string;
  notes?: string | null;
  is_active?: boolean;
  isActive?: boolean;
}

function normalizeRoom(r: RawRoomBackend): RoomData {
  return {
    id: r.id,
    unitId: r.unit_id || r.unitId || '',
    name: r.name,
    roomType: (r.room_type || r.roomType || 'CONSULTORIO') as RoomType,
    isSchedulable: r.is_schedulable ?? r.isSchedulable ?? true,
    equipmentResources: Array.isArray(r.equipment)
      ? r.equipment.join(', ')
      : (r.equipment_resources || r.equipmentResources || ''),
    notes: r.notes ?? undefined,
    isActive: r.is_active ?? r.isActive ?? true,
  };
}

function toBackendRoomPayload(payload: Partial<RoomData>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (payload.name !== undefined) result.name = payload.name;
  if (payload.unitId !== undefined) result.unit_id = payload.unitId;
  if (payload.roomType !== undefined) result.room_type = payload.roomType;
  if (payload.isSchedulable !== undefined) result.is_schedulable = payload.isSchedulable;
  if (payload.equipmentResources !== undefined) {
    result.equipment = payload.equipmentResources
      ? payload.equipmentResources.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  }
  if (payload.notes !== undefined) result.notes = payload.notes;
  if (payload.isActive !== undefined) result.is_active = payload.isActive;
  return result;
}

export async function listRooms(unitId?: string): Promise<RoomData[]> {
  const query = unitId ? `?unit_id=${encodeURIComponent(unitId)}` : '';
  const res = await apiFetch<{ items?: RawRoomBackend[]; total?: number } | RawRoomBackend[]>(
    `/business/rooms${query}`
  );
  const items = Array.isArray(res) ? res : res.items || [];
  return items.map(normalizeRoom);
}

export async function createRoom(payload: RoomData): Promise<ActionResponse<RoomData>> {
  const backendPayload = toBackendRoomPayload(payload);
  const res = await apiFetch<ActionResponse<RawRoomBackend> | RawRoomBackend>('/business/rooms', {
    method: 'POST',
    body: JSON.stringify(backendPayload),
  });
  const data = (res && 'data' in res && res.data) ? res.data : (res as RawRoomBackend);
  return {
    code: 'SUCCESS',
    message: 'Room created successfully',
    data: normalizeRoom(data),
  };
}

export async function updateRoom(
  id: string,
  payload: Partial<RoomData>
): Promise<ActionResponse<RoomData>> {
  const backendPayload = toBackendRoomPayload(payload);
  const res = await apiFetch<ActionResponse<RawRoomBackend> | RawRoomBackend>(
    `/business/rooms/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(backendPayload),
    }
  );
  const data = (res && 'data' in res && res.data) ? res.data : (res as RawRoomBackend);
  return {
    code: 'SUCCESS',
    message: 'Room updated successfully',
    data: normalizeRoom(data),
  };
}

export async function deleteRoom(id: string): Promise<ActionResponse<void>> {
  return await apiFetch<ActionResponse<void>>(`/business/rooms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export { apiFetch, TenantStatus };




