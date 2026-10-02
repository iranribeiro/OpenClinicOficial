import type { FastifyRequest, FastifyReply } from 'fastify';
import { AccessDeniedError, ErrorCode, ResourceAction, UserRole, UserRole as UserRoleEnum, ResourceAction as ActionEnum, ROLE_HIERARCHY, type AppResourceCode } from '@openclinic/core';
import type { IAMUnitOfWork } from '../../domain/repositories.js';
import { IAMPermissionService } from '../../application/services/iam-permission.service.js';

export function requireRole(minimumRole: UserRole) {
  return async function checkRole(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.user;
    if (!user) {
      throw new AccessDeniedError(ErrorCode.FORBIDDEN);
    }

    const userLevel = ROLE_HIERARCHY[user.role as UserRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      throw new AccessDeniedError(ErrorCode.INSUFFICIENT_ROLE, undefined, { minimumRole });
    }
  };
}

/**
 * Guards a route on a manifest resource. The key is typed against the manifest codes so a route
 * left pointing at a renamed resource fails to compile, instead of silently denying every
 * non-OWNER caller the way a stale string literal does at runtime.
 */
export function requirePermission(uow: IAMUnitOfWork, resourceKey: AppResourceCode, action: ResourceAction = ActionEnum.READ) {
  const service = new IAMPermissionService(uow);
  return async function checkPermission(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.user;
    if (!user) {
      throw new AccessDeniedError(ErrorCode.FORBIDDEN);
    }

    if (user.role === UserRoleEnum.OWNER) {
      return;
    }

    const hasAccess = await service.hasPermission(user.sub, resourceKey, action);
    if (!hasAccess) {
      throw new AccessDeniedError(ErrorCode.INSUFFICIENT_ROLE, undefined, { resourceKey, action });
    }
  };
}
