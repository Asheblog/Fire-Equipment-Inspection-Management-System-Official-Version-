import { api } from './client';

// 权限管理相关类型定义
export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  module: string;
  category: 'SYSTEM' | 'MODULE' | 'DATA' | 'FIELD';
  level: number;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  level: number;
  isActive: boolean;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  rolePermissions?: {
    permission: Permission;
  }[];
  userRoles?: {
    user: {
      id: number;
      username: string;
      fullName: string;
    };
  }[];
}

export interface UserPermission {
  user: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  };
  roles: Role[];
  effectivePermissions: Permission[];
  personalPermissions: Permission[];
  rolePermissions: Permission[];
}

export interface PermissionLog {
  id: number;
  actionType: string;
  targetUserId: number;
  operatorId?: number;
  roleId?: number;
  permissionId?: number;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  factoryId?: number;
  timestamp: string;
  targetUser: {
    id: number;
    username: string;
    fullName: string;
  };
  operator?: {
    id: number;
    username: string;
    fullName: string;
  };
  role?: {
    id: number;
    code: string;
    name: string;
  };
  permission?: {
    id: number;
    code: string;
    name: string;
    module: string;
  };
}

export interface BatchOperation {
  type: 'ASSIGN_ROLE' | 'REVOKE_ROLE' | 'GRANT_PERMISSION' | 'REVOKE_PERMISSION';
  userId: number;
  roleId?: number;
  permissionId?: number;
  options?: {
    expiresAt?: string;
    reason?: string;
  };
}

// 权限管理API
export const permissionApi = {
  // === 权限管理 ===
  
  // 获取权限列表
  getPermissions: (params?: {
    module?: string;
    category?: string;
    isActive?: boolean;
  }) => {
    return api.get<Permission[]>('/permissions', { params });
  },

  // 获取权限模块信息
  getPermissionModules: () => {
    return api.get<Record<string, string[]>>('/permissions/modules');
  },

  // 创建权限
  createPermission: (data: Partial<Permission>) => {
    return api.post<Permission>('/permissions', data);
  },

  // 更新权限
  updatePermission: (id: number, data: Partial<Permission>) => {
    return api.put<Permission>(`/permissions/${id}`, data);
  },

  // 删除权限
  deletePermission: (id: number) => {
    return api.delete(`/permissions/${id}`);
  },

  // === 角色管理 ===
  
  // 获取角色列表
  getRoles: (params?: {
    isActive?: boolean;
    isSystem?: boolean;
  }) => {
    return api.get<Role[]>('/permissions/roles', { params });
  },

  // 创建角色
  createRole: (data: Partial<Role>) => {
    return api.post<Role>('/permissions/roles', data);
  },

  // 更新角色
  updateRole: (id: number, data: Partial<Role>) => {
    return api.put<Role>(`/permissions/roles/${id}`, data);
  },

  // 删除角色
  deleteRole: (id: number) => {
    return api.delete(`/permissions/roles/${id}`);
  },

  // 设置角色权限
  setRolePermissions: (roleId: number, permissionIds: number[]) => {
    return api.put<Role>(`/permissions/roles/${roleId}/permissions`, {
      permissionIds
    });
  },

  // === 用户权限管理 ===
  
  // 获取用户权限信息
  getUserPermissions: (userId: number) => {
    return api.get<UserPermission>(`/permissions/users/${userId}/permissions`);
  },

  // 分配用户角色
  assignUserRole: (userId: number, data: {
    roleId: number;
    expiresAt?: string;
    reason?: string;
  }) => {
    return api.post(`/permissions/users/${userId}/roles`, data);
  },

  // 撤销用户角色
  revokeUserRole: (userId: number, roleId: number, reason?: string) => {
    return api.delete(`/permissions/users/${userId}/roles/${roleId}`, {
      data: { reason }
    });
  },

  // 授予用户个人权限
  grantUserPermission: (userId: number, data: {
    permissionId: number;
    expiresAt?: string;
    reason?: string;
  }) => {
    return api.post(`/permissions/users/${userId}/permissions`, data);
  },

  // 撤销用户个人权限
  revokeUserPermission: (userId: number, permissionId: number, reason?: string) => {
    return api.delete(`/permissions/users/${userId}/permissions/${permissionId}`, {
      data: { reason }
    });
  },

  // === 权限日志和统计 ===
  
  // 获取权限变更日志
  getPermissionLogs: (params?: {
    targetUserId?: number;
    operatorId?: number;
    actionType?: string;
    factoryId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    return api.get<{
      logs: PermissionLog[];
      total: number;
      limit: number;
      offset: number;
    }>('/permissions/logs', { params });
  },

  // 获取权限统计信息
  getPermissionStats: () => {
    return api.get<{
      totalPermissions: number;
      totalRoles: number;
      activeRoles: number;
      permissionsByModule: Record<string, number>;
      rolesByLevel: Record<string, number>;
    }>('/permissions/stats');
  },

  // === 批量操作 ===
  
  // 批量权限操作
  batchPermissionOperation: (operations: BatchOperation[]) => {
    return api.post<{
      operation: BatchOperation;
      success: boolean;
      result?: any;
      error?: string;
    }[]>('/permissions/batch', { operations });
  }
};