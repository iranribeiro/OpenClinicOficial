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

export async function listUsers(): Promise<UserListItem[]> {
  return apiFetch<UserListItem[]>('/iam/users');
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
  return apiFetch<ActionResponse<UserListItem>>('/iam/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  return apiFetch<ActionResponse<UserListItem>>(`/iam/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
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

/**
 * Nested collections mirror the API column names one-to-one, so the wire shape is the
 * response shape plus the server-assigned `id`. Payloads use the `*Input` aliases below,
 * which strip both the `id` and the display-only fields the API rejects.
 */
export interface PractitionerRegistrationItem {
  id?: string;
  registration_number: string;
  registration_type: string;
  registration_state: string;
  is_primary: boolean;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  status?: string | null;
}

export interface PractitionerSpecialtyItem {
  id?: string;
  specialty_id: string;
  /** Display-only: resolved from the catalog, never sent back. */
  specialty_name?: string;
  is_primary: boolean;
  rqe_number?: string | null;
  qualification_date?: string | null;
}

export interface PractitionerQualificationItem {
  id?: string;
  qualification_type: string;
  degree_name: string;
  issuing_institution: string;
  year_issued?: number | null;
  valid_until?: string | null;
}

export interface PractitionerAvailabilityItem {
  id?: string;
  /**
   * Organization unit the shift belongs to. This is what links the practitioner to
   * the unit — a unit with no shifts is, by definition, not linked.
   */
  organization_unit_id?: string | null;
  /** Sunday is 0 (matches `app_availabilities.day_of_week`). */
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

export type PractitionerRegistrationInput = Omit<PractitionerRegistrationItem, 'id'>;
export type PractitionerSpecialtyInput = Omit<PractitionerSpecialtyItem, 'id' | 'specialty_name'>;
export type PractitionerQualificationInput = Omit<PractitionerQualificationItem, 'id'>;
/** A caller must always name the unit; only the stored row may have it nulled by a unit deletion. */
export type PractitionerAvailabilityInput =
  Omit<PractitionerAvailabilityItem, 'id' | 'organization_unit_id'> & { organization_unit_id: string };

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
  /** Omitted, the server generates a strong password the user must change on first login. */
  login_password?: string;
  registrations?: PractitionerRegistrationInput[];
  specialties?: PractitionerSpecialtyInput[];
  qualifications?: PractitionerQualificationInput[];
  availability?: PractitionerAvailabilityInput[];
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

export function checkIdentityUniqueness(params: {
  username?: string;
  cpf?: string;
  email?: string;
  excludeUserId?: string;
  excludePractitionerId?: string;
  excludeStaffId?: string;
  users?: UserListItem[];
  practitioners?: PractitionerItem[];
  staff?: StaffItem[];
}): { usernameError?: string; cpfError?: string; emailError?: string } {
  const result: { usernameError?: string; cpfError?: string; emailError?: string } = {};

  const cleanUser = params.username?.trim().toLowerCase();
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanCpfNum = params.cpf ? Cpf.clean(params.cpf) : '';

  if (params.users) {
    for (const u of params.users) {
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
  }

  if (params.practitioners) {
    for (const p of params.practitioners) {
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
  }

  if (params.staff) {
    for (const s of params.staff) {
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
  }

  return result;
}

export async function listPractitioners(): Promise<PractitionerItem[]> {
  const res = await apiFetch<{ items?: PractitionerItem[]; total?: number } | PractitionerItem[]>(
    '/business/practitioners'
  );
  return Array.isArray(res) ? res : (res?.items || []);
}

export async function getPractitionerById(id: string): Promise<PractitionerItem | null> {
  return await apiFetch<PractitionerItem>(`/business/practitioners/${encodeURIComponent(id)}`);
}

export async function createPractitioner(payload: CreatePractitionerPayload): Promise<ActionResponse<PractitionerItem>> {
  return await apiFetch<ActionResponse<PractitionerItem>>('/business/practitioners', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePractitioner(
  id: string,
  payload: Partial<CreatePractitionerPayload>
): Promise<ActionResponse<PractitionerItem>> {
  return await apiFetch<ActionResponse<PractitionerItem>>(`/business/practitioners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePractitioner(id: string): Promise<ActionResponse<void>> {
  return await apiFetch<ActionResponse<void>>(`/business/practitioners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listSpecialties(): Promise<SpecialtyItem[]> {
  // No placeholder catalog: a specialty is chosen by its server id, which a locally
  // invented id would never match, so a failed load leaves the list empty instead.
  return await apiFetch<SpecialtyItem[]>('/business/specialties');
}

// ── Business Registries: Staff (Administrative Collaborators) ──

export interface StaffQualificationItem {
  id?: string;
  qualification_type: string;
  title: string;
  issuing_institution?: string | null;
  year_issued?: number | null;
  valid_until?: string | null;
}

export interface StaffItem {
  id: string;
  tenant_id: string;
  user_id: string;
  username?: string | null;
  full_name: string;
  cpf: string;
  rg?: string | null;
  birth_date: string;
  gender?: string | null;
  staff_type: string;
  department?: string | null;
  job_position?: string | null;
  contract_type?: string | null;
  hire_date: string;
  termination_date?: string | null;
  phone?: string | null;
  email: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  photo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  qualifications?: StaffQualificationItem[];
  /** Ids of the organization units the collaborator works at. */
  units?: string[];
}

export interface CreateStaffPayload {
  full_name: string;
  cpf: string;
  rg?: string;
  birth_date: string;
  gender?: string;
  staff_type: string;
  department?: string;
  job_position?: string;
  contract_type?: string;
  hire_date: string;
  termination_date?: string;
  phone?: string;
  email: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  photo_url?: string;
  is_active?: boolean;
  username?: string;
  /** Omitted, the server generates a strong password the user must change on first login. */
  login_password?: string;
  qualifications?: StaffQualificationItem[];
  /** Supplying the list replaces the collaborator's units wholesale. */
  units?: string[];
}

export async function listStaff(): Promise<StaffItem[]> {
  const res = await apiFetch<{ items?: StaffItem[]; total?: number } | StaffItem[]>('/business/staff');
  return Array.isArray(res) ? res : (res?.items || []);
}

export async function getStaffById(id: string): Promise<StaffItem | null> {
  return await apiFetch<StaffItem>(`/business/staff/${encodeURIComponent(id)}`);
}

export async function createStaff(payload: CreateStaffPayload): Promise<ActionResponse<StaffItem>> {
  return await apiFetch<ActionResponse<StaffItem>>('/business/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateStaff(id: string, payload: Partial<CreateStaffPayload>): Promise<ActionResponse<StaffItem>> {
  return await apiFetch<ActionResponse<StaffItem>>(`/business/staff/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteStaff(id: string): Promise<ActionResponse<void>> {
  return await apiFetch<ActionResponse<void>>(`/business/staff/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
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




