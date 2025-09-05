/**
 * 消防器材点检系统 - 用户管理路由
 * 定义用户和厂区管理相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const userController = require('../controllers/user.controller');

// 导入中间件
const ValidationHelper = require('../utils/validation.helper');

/**
 * 用户管理路由定义
 */

// 获取用户统计信息
router.get('/stats', userController.getUserStats);

// 获取用户列表 (带分页和筛选)
router.get('/', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.querySchema.pagination, 
    'query'
  ),
  userController.getUserList
);

// 创建新用户
router.post('/', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.userSchema.create, 
    'body'
  ),
  userController.createUser
);

// 获取用户详情
router.get('/:id', userController.getUserById);

// 更新用户信息
router.put('/:id', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.userSchema.update || ValidationHelper.userSchema.create.fork(['password', 'role', 'factoryId'], (schema) => schema.optional()),
    'body'
  ),
  userController.updateUser
);

// 更新当前用户信息（个人资料）
router.put('/profile/me', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.userSchema.updateProfile || ValidationHelper.userSchema.create.fork(['password', 'role', 'factoryId'], (schema) => schema.optional()), 
    'body'
  ),
  userController.updateOwnProfile
);

// 停用/启用用户
router.put('/:id/status', userController.toggleUserStatus);

// 重置用户密码
router.put('/:id/password', userController.resetUserPassword);

// 删除用户
router.delete('/:id', userController.deleteUser);

module.exports = router;
