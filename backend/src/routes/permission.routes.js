/**
 * 权限管理路由
 * 定义权限、角色、用户权限管理相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const permissionController = require('../controllers/permission.controller');

// 导入验证中间件
const ValidationHelper = require('../utils/validation.helper');
const Joi = require('joi');

// 权限验证schemas
const permissionSchemas = {
  createPermission: Joi.object({
    code: Joi.string().min(3).max(50).pattern(/^[a-z_]+:[a-z_]+$/).required().messages({
      'string.pattern.base': '权限编码格式错误，应为 module:action 格式'
    }),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(200).allow('', null),
    module: Joi.string().min(2).max(50).required(),
    category: Joi.string().valid('SYSTEM', 'MODULE', 'DATA', 'FIELD').default('MODULE'),
    level: Joi.number().integer().min(1).max(3).default(1),
    isActive: Joi.boolean().default(true),
    sortOrder: Joi.number().integer().min(0).default(0)
  }),
  
  createRole: Joi.object({
    code: Joi.string().min(3).max(50).pattern(/^[A-Z_]+$/).required(),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(200).allow('', null),
    level: Joi.number().integer().min(1).max(3).default(1),
    isActive: Joi.boolean().default(true)
  }),
  
  setRolePermissions: Joi.object({
    permissionIds: Joi.array().items(Joi.number().integer().positive()).min(1).required()
  }),
  
  assignUserRole: Joi.object({
    roleId: Joi.number().integer().positive().required(),
    expiresAt: Joi.date().iso().greater('now').allow(null),
    reason: Joi.string().max(200).allow('', null)
  }),
  
  grantUserPermission: Joi.object({
    permissionId: Joi.number().integer().positive().required(),
    expiresAt: Joi.date().iso().greater('now').allow(null),
    reason: Joi.string().max(200).allow('', null)
  }),
  
  batchOperation: Joi.object({
    operations: Joi.array().items(Joi.object({
      type: Joi.string().valid('ASSIGN_ROLE', 'REVOKE_ROLE', 'GRANT_PERMISSION', 'REVOKE_PERMISSION').required(),
      userId: Joi.number().integer().positive().required(),
      roleId: Joi.number().integer().positive().when('type', {
        is: Joi.valid('ASSIGN_ROLE', 'REVOKE_ROLE'),
        then: Joi.required(),
        otherwise: Joi.forbidden()
      }),
      permissionId: Joi.number().integer().positive().when('type', {
        is: Joi.valid('GRANT_PERMISSION', 'REVOKE_PERMISSION'),
        then: Joi.required(),
        otherwise: Joi.forbidden()
      }),
      options: Joi.object({
        expiresAt: Joi.date().iso().greater('now').allow(null),
        reason: Joi.string().max(200).allow('', null)
      }).default({})
    })).min(1).required()
  })
};

/**
 * 权限管理路由定义
 */

// === 权限管理 ===

// 获取权限列表
router.get('/', 
  permissionController.getPermissionList
);

// 获取权限模块信息
router.get('/modules', 
  permissionController.getPermissionModules
);

// 创建权限
router.post('/', 
  ValidationHelper.validateMiddleware(permissionSchemas.createPermission, 'body'),
  permissionController.createPermission
);

// 更新权限
router.put('/:id', 
  ValidationHelper.validateMiddleware(
    Joi.object({ id: Joi.number().integer().positive().required() }), 
    'params'
  ),
  permissionController.updatePermission
);

// 删除权限
router.delete('/:id', 
  ValidationHelper.validateMiddleware(
    Joi.object({ id: Joi.number().integer().positive().required() }), 
    'params'
  ),
  permissionController.deletePermission
);

// === 角色管理 ===

// 获取角色列表
router.get('/roles', 
  permissionController.getRoleList
);

// 创建角色
router.post('/roles', 
  ValidationHelper.validateMiddleware(permissionSchemas.createRole, 'body'),
  permissionController.createRole
);

// 更新角色
router.put('/roles/:id', 
  ValidationHelper.validateMiddleware(
    Joi.object({ id: Joi.number().integer().positive().required() }), 
    'params'
  ),
  permissionController.updateRole
);

// 删除角色
router.delete('/roles/:id', 
  ValidationHelper.validateMiddleware(
    Joi.object({ id: Joi.number().integer().positive().required() }), 
    'params'
  ),
  permissionController.deleteRole
);

// 设置角色权限
router.put('/roles/:id/permissions', 
  ValidationHelper.validateMiddleware(
    Joi.object({ id: Joi.number().integer().positive().required() }), 
    'params'
  ),
  ValidationHelper.validateMiddleware(permissionSchemas.setRolePermissions, 'body'),
  permissionController.setRolePermissions
);

// === 用户权限管理 ===

// 获取用户权限信息
router.get('/users/:id/permissions', 
  ValidationHelper.validateMiddleware(
    Joi.object({ id: Joi.number().integer().positive().required() }), 
    'params'
  ),
  permissionController.getUserPermissions
);

// 分配用户角色
router.post('/users/:userId/roles', 
  ValidationHelper.validateMiddleware(
    Joi.object({ userId: Joi.number().integer().positive().required() }), 
    'params'
  ),
  ValidationHelper.validateMiddleware(permissionSchemas.assignUserRole, 'body'),
  permissionController.assignUserRole
);

// 撤销用户角色
router.delete('/users/:userId/roles/:roleId', 
  ValidationHelper.validateMiddleware(
    Joi.object({ 
      userId: Joi.number().integer().positive().required(),
      roleId: Joi.number().integer().positive().required()
    }), 
    'params'
  ),
  ValidationHelper.validateMiddleware(
    Joi.object({ reason: Joi.string().max(200).allow('', null) }), 
    'body'
  ),
  permissionController.revokeUserRole
);

// 授予用户个人权限
router.post('/users/:userId/permissions', 
  ValidationHelper.validateMiddleware(
    Joi.object({ userId: Joi.number().integer().positive().required() }), 
    'params'
  ),
  ValidationHelper.validateMiddleware(permissionSchemas.grantUserPermission, 'body'),
  permissionController.grantUserPermission
);

// 撤销用户个人权限
router.delete('/users/:userId/permissions/:permissionId', 
  ValidationHelper.validateMiddleware(
    Joi.object({ 
      userId: Joi.number().integer().positive().required(),
      permissionId: Joi.number().integer().positive().required()
    }), 
    'params'
  ),
  ValidationHelper.validateMiddleware(
    Joi.object({ reason: Joi.string().max(200).allow('', null) }), 
    'body'
  ),
  permissionController.revokeUserPermission
);

// === 权限日志和统计 ===

// 获取权限变更日志
router.get('/logs', 
  ValidationHelper.validateMiddleware(
    Joi.object({
      targetUserId: Joi.number().integer().positive(),
      operatorId: Joi.number().integer().positive(),
      actionType: Joi.string().valid('GRANT_ROLE', 'REVOKE_ROLE', 'GRANT_PERMISSION', 'REVOKE_PERMISSION', 'UPDATE_ROLE_PERMISSIONS'),
      factoryId: Joi.number().integer().positive(),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')),
      limit: Joi.number().integer().min(1).max(1000).default(100),
      offset: Joi.number().integer().min(0).default(0)
    }).unknown(false), 
    'query'
  ),
  permissionController.getPermissionLogs
);

// 获取权限统计信息
router.get('/stats', 
  permissionController.getPermissionStats
);

// === 批量操作 ===

// 批量权限操作
router.post('/batch', 
  ValidationHelper.validateMiddleware(permissionSchemas.batchOperation, 'body'),
  permissionController.batchPermissionOperation
);

module.exports = router;