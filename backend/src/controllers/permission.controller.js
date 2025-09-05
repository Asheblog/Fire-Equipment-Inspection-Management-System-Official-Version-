const PermissionService = require('../services/permission.service');
const ResponseHelper = require('../utils/response.helper');

/**
 * 权限管理控制器
 */
class PermissionController {
  constructor() {
    this.permissionService = new PermissionService();
  }

  /**
   * 获取所有权限列表
   */
  getPermissionList = async (req, res) => {
    try {
      const { module, category, isActive } = req.query;
      
      const filters = {};
      if (module) filters.module = module;
      if (category) filters.category = category;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const permissions = await this.permissionService.getAllPermissions(filters);
      
      return ResponseHelper.success(res, permissions, '权限列表获取成功');
    } catch (error) {
      console.error('获取权限列表失败:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  };

  /**
   * 获取权限模块信息
   */
  getPermissionModules = async (req, res) => {
    try {
      const modules = await this.permissionService.getPermissionModules();
      
      return ResponseHelper.success(res, modules, '权限模块信息获取成功');
    } catch (error) {
      console.error('获取权限模块失败:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  };

  /**
   * 创建权限
   */
  createPermission = async (req, res) => {
    try {
      const permission = await this.permissionService.createPermission(req.body);
      
      return ResponseHelper.success(res, permission, '权限创建成功', 201);
    } catch (error) {
      console.error('创建权限失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 更新权限
   */
  updatePermission = async (req, res) => {
    try {
      const { id } = req.params;
      const permission = await this.permissionService.updatePermission(
        parseInt(id), 
        req.body
      );
      
      return ResponseHelper.success(res, permission, '权限更新成功');
    } catch (error) {
      console.error('更新权限失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 删除权限
   */
  deletePermission = async (req, res) => {
    try {
      const { id } = req.params;
      await this.permissionService.deletePermission(parseInt(id));
      
      return ResponseHelper.success(res, null, '权限删除成功');
    } catch (error) {
      console.error('删除权限失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 获取所有角色列表
   */
  getRoleList = async (req, res) => {
    try {
      const { isActive, isSystem } = req.query;
      
      const filters = {};
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (isSystem !== undefined) filters.isSystem = isSystem === 'true';

      const roles = await this.permissionService.getAllRoles(filters);
      
      return ResponseHelper.success(res, roles, '角色列表获取成功');
    } catch (error) {
      console.error('获取角色列表失败:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  };

  /**
   * 创建角色
   */
  createRole = async (req, res) => {
    try {
      const role = await this.permissionService.createRole(req.body);
      
      return ResponseHelper.success(res, role, '角色创建成功', 201);
    } catch (error) {
      console.error('创建角色失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 更新角色
   */
  updateRole = async (req, res) => {
    try {
      const { id } = req.params;
      const role = await this.permissionService.updateRole(
        parseInt(id), 
        req.body
      );
      
      return ResponseHelper.success(res, role, '角色更新成功');
    } catch (error) {
      console.error('更新角色失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 删除角色
   */
  deleteRole = async (req, res) => {
    try {
      const { id } = req.params;
      await this.permissionService.deleteRole(parseInt(id));
      
      return ResponseHelper.success(res, null, '角色删除成功');
    } catch (error) {
      console.error('删除角色失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 设置角色权限
   */
  setRolePermissions = async (req, res) => {
    try {
      const { id } = req.params;
      const { permissionIds } = req.body;
      const operatorId = req.user.id;
      
      const role = await this.permissionService.setRolePermissions(
        parseInt(id),
        permissionIds,
        operatorId
      );
      
      return ResponseHelper.success(res, role, '角色权限设置成功');
    } catch (error) {
      console.error('设置角色权限失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 获取用户权限信息
   */
  getUserPermissions = async (req, res) => {
    try {
      const { id } = req.params;
      const userPermissions = await this.permissionService.getUserPermissions(parseInt(id));
      
      return ResponseHelper.success(res, userPermissions, '用户权限信息获取成功');
    } catch (error) {
      console.error('获取用户权限失败:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  };

  /**
   * 分配用户角色
   */
  assignUserRole = async (req, res) => {
    try {
      const { userId } = req.params;
      const { roleId, expiresAt, reason } = req.body;
      const operatorId = req.user.id;
      
      const userRole = await this.permissionService.assignUserRole(
        parseInt(userId),
        roleId,
        operatorId,
        { expiresAt: expiresAt ? new Date(expiresAt) : null, reason }
      );
      
      return ResponseHelper.success(res, userRole, '用户角色分配成功', 201);
    } catch (error) {
      console.error('分配用户角色失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 撤销用户角色
   */
  revokeUserRole = async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      const { reason } = req.body;
      const operatorId = req.user.id;
      
      await this.permissionService.revokeUserRole(
        parseInt(userId),
        parseInt(roleId),
        operatorId,
        reason
      );
      
      return ResponseHelper.success(res, null, '用户角色撤销成功');
    } catch (error) {
      console.error('撤销用户角色失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 授予用户权限
   */
  grantUserPermission = async (req, res) => {
    try {
      const { userId } = req.params;
      const { permissionId, expiresAt, reason } = req.body;
      const operatorId = req.user.id;
      
      const userPermission = await this.permissionService.grantUserPermission(
        parseInt(userId),
        permissionId,
        operatorId,
        { expiresAt: expiresAt ? new Date(expiresAt) : null, reason }
      );
      
      return ResponseHelper.success(res, userPermission, '用户权限授予成功', 201);
    } catch (error) {
      console.error('授予用户权限失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 撤销用户权限
   */
  revokeUserPermission = async (req, res) => {
    try {
      const { userId, permissionId } = req.params;
      const { reason } = req.body;
      const operatorId = req.user.id;
      
      await this.permissionService.revokeUserPermission(
        parseInt(userId),
        parseInt(permissionId),
        operatorId,
        reason
      );
      
      return ResponseHelper.success(res, null, '用户权限撤销成功');
    } catch (error) {
      console.error('撤销用户权限失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };

  /**
   * 获取权限变更日志
   */
  getPermissionLogs = async (req, res) => {
    try {
      const {
        targetUserId,
        operatorId,
        actionType,
        factoryId,
        startDate,
        endDate,
        limit,
        offset
      } = req.query;
      
      const filters = {
        targetUserId: targetUserId ? parseInt(targetUserId) : undefined,
        operatorId: operatorId ? parseInt(operatorId) : undefined,
        actionType,
        factoryId: factoryId ? parseInt(factoryId) : undefined,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };
      
      const logs = await this.permissionService.getPermissionLogs(filters);
      
      return ResponseHelper.success(res, logs, '权限日志获取成功');
    } catch (error) {
      console.error('获取权限日志失败:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  };

  /**
   * 获取权限统计信息
   */
  getPermissionStats = async (req, res) => {
    try {
      const stats = await this.permissionService.getPermissionStats();
      
      return ResponseHelper.success(res, stats, '权限统计信息获取成功');
    } catch (error) {
      console.error('获取权限统计失败:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  };

  /**
   * 批量权限操作
   */
  batchPermissionOperation = async (req, res) => {
    try {
      const { operations } = req.body;
      const operatorId = req.user.id;
      
      const results = await this.permissionService.batchPermissionOperation(
        operations,
        operatorId
      );
      
      return ResponseHelper.success(res, results, '批量权限操作完成');
    } catch (error) {
      console.error('批量权限操作失败:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  };
}

module.exports = new PermissionController();