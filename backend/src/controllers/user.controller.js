/**
 * 消防器材点检系统 - 用户管理控制器
 * 处理用户和厂区管理相关的HTTP请求
 */

const UserService = require('../services/user.service');
const ResponseHelper = require('../utils/response.helper');
const ValidationHelper = require('../utils/validation.helper');

class UserController {
  constructor() {
    this.userService = new UserService();
  }

  /**
   * 获取用户列表
   * GET /api/users
   */
  async getUserList(req, res) {
    try {
      const { user, dataFilter } = req;
      
      // 查询参数已在路由层通过 validateMiddleware 验证并写回 req.query
      const { page, limit, sortBy, sortOrder, ...filters } = req.query;
      
      const pagination = { page, limit, sortBy, sortOrder };
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;

      const result = await this.userService.getUserList(
        filters,
        pagination,
        userFactoryId,
        user.role
      );

      return ResponseHelper.list(
        res,
        result.users,
        result.pagination.total,
        result.pagination.page,
        result.pagination.limit,
        '用户列表获取成功'
      );
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取用户详情
   * GET /api/users/:id
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '用户ID格式不正确');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const userData = await this.userService.getUserById(
        parseInt(id),
        userFactoryId,
        user.role
      );

      return ResponseHelper.success(res, userData, '用户详情获取成功');
    } catch (error) {
      console.error('获取用户详情失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建用户
   * POST /api/users
   */
  async createUser(req, res) {
    try {
      const { user, dataFilter } = req;
      
      // 请求体已在路由层 validateMiddleware 验证，直接使用 req.body
      const validatedData = req.body;
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const result = await this.userService.createUser(
        validatedData,
        userFactoryId,
        user.role
      );

      return ResponseHelper.created(res, result.user, '用户创建成功');
    } catch (error) {
      console.error('创建用户失败:', error);
      
      if (error.message.includes('已存在') || error.message.includes('冲突')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      if (error.message.includes('无权') || error.message.includes('不能')) {
        return ResponseHelper.forbidden(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 更新用户信息
   * PUT /api/users/:id
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '用户ID格式不正确');
      }

      // 路由层已通过 validateMiddleware 验证并清洗 req.body，避免重复验证
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const userData = await this.userService.updateUser(
        parseInt(id),
        req.body,
        userFactoryId,
        user.role
      );

      return ResponseHelper.success(res, userData, '用户更新成功');
    } catch (error) {
      console.error('更新用户失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权修改')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('已存在')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 停用/启用用户
   * PUT /api/users/:id/status
   */
  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '用户ID格式不正确');
      }

      if (typeof isActive !== 'boolean') {
        return ResponseHelper.badRequest(res, '状态参数格式不正确');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const userData = await this.userService.toggleUserStatus(
        parseInt(id),
        isActive,
        userFactoryId,
        user.role
      );

      return ResponseHelper.success(res, userData, '用户状态修改成功');
    } catch (error) {
      console.error('修改用户状态失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 更新当前用户信息（个人资料）
   * PUT /api/users/profile/me
   */
  async updateOwnProfile(req, res) {
    try {
      const { user } = req;
      
      // 已在路由层验证，按需挑选允许字段
      const { fullName, username } = req.body;
      const allowedFields = { fullName, username };

      const userData = await this.userService.updateOwnProfile(
        user.id,
        allowedFields
      );

      return ResponseHelper.success(res, userData, '个人资料更新成功');
    } catch (error) {
      console.error('更新个人资料失败:', error);
      
      if (error.message.includes('用户名已存在')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      if (error.message.includes('不存在')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 重置用户密码
   * PUT /api/users/:id/password
   */
  async resetUserPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '用户ID格式不正确');
      }

      if (!newPassword || typeof newPassword !== 'string') {
        return ResponseHelper.badRequest(res, '新密码不能为空');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const result = await this.userService.resetUserPassword(
        parseInt(id),
        newPassword,
        userFactoryId,
        user.role
      );

      return ResponseHelper.success(res, result, '密码重置成功');
    } catch (error) {
      console.error('重置密码失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('密码不符合')) {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取厂区列表
   * GET /api/factories
   */
  async getFactoryList(req, res) {
    try {
      const factories = await this.userService.getFactoryList();
      return ResponseHelper.success(res, factories, '厂区列表获取成功');
    } catch (error) {
      console.error('获取厂区列表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建厂区
   * POST /api/factories
   */
  async createFactory(req, res) {
    try {
      const { user } = req;
      const { name, address } = req.body;

      // 权限检查：只有超级管理员可以创建厂区
      if (user.role !== 'SUPER_ADMIN') {
        return ResponseHelper.forbidden(res, '只有超级管理员可以创建厂区');
      }

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return ResponseHelper.badRequest(res, '厂区名称不能为空');
      }

      const factory = await this.userService.createFactory({ name: name.trim(), address });
      return ResponseHelper.created(res, factory, '厂区创建成功');
    } catch (error) {
      console.error('创建厂区失败:', error);
      
      if (error.message.includes('已存在')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取厂区详情
   * GET /api/factories/:id
   */
  async getFactoryById(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      // 权限检查：只有超级管理员可以查看厂区详情
      if (user.role !== 'SUPER_ADMIN') {
        return ResponseHelper.forbidden(res, '只有超级管理员可以查看厂区详情');
      }

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '厂区ID格式不正确');
      }

      const factory = await this.userService.getFactoryById(parseInt(id));
      return ResponseHelper.success(res, factory, '厂区详情获取成功');
    } catch (error) {
      console.error('获取厂区详情失败:', error);
      
      if (error.message.includes('不存在')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 更新厂区信息
   * PUT /api/factories/:id
   */
  async updateFactory(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { name, address } = req.body;

      // 权限检查：只有超级管理员可以更新厂区
      if (user.role !== 'SUPER_ADMIN') {
        return ResponseHelper.forbidden(res, '只有超级管理员可以更新厂区');
      }

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '厂区ID格式不正确');
      }

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return ResponseHelper.badRequest(res, '厂区名称不能为空');
      }

      const factory = await this.userService.updateFactory(parseInt(id), { 
        name: name.trim(), 
        address: address || null 
      });
      return ResponseHelper.success(res, factory, '厂区更新成功');
    } catch (error) {
      console.error('更新厂区失败:', error);
      
      if (error.message.includes('不存在')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('已存在')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 删除厂区
   * DELETE /api/factories/:id
   */
  async deleteFactory(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      // 权限检查：只有超级管理员可以删除厂区
      if (user.role !== 'SUPER_ADMIN') {
        return ResponseHelper.forbidden(res, '只有超级管理员可以删除厂区');
      }

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '厂区ID格式不正确');
      }

      await this.userService.deleteFactory(parseInt(id));
      return ResponseHelper.success(res, null, '厂区删除成功');
    } catch (error) {
      console.error('删除厂区失败:', error);
      
      if (error.message.includes('不存在')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('存在关联数据')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 删除用户
   * DELETE /api/users/:id
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '用户ID格式不正确');
      }

      // 权限检查：只有超级管理员可以删除用户
      if (user.role !== 'SUPER_ADMIN') {
        return ResponseHelper.forbidden(res, '只有超级管理员可以删除用户');
      }

      // 不能删除自己
      if (parseInt(id) === user.id) {
        return ResponseHelper.badRequest(res, '不能删除自己的账户');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const result = await this.userService.deleteUser(
        parseInt(id),
        userFactoryId,
        user.role
      );

      return ResponseHelper.success(res, result, '用户删除成功');
    } catch (error) {
      console.error('删除用户失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('存在关联数据') || error.message.includes('不能删除')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取用户统计信息
   * GET /api/users/stats
   */
  async getUserStats(req, res) {
    try {
      const { dataFilter } = req;
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      
      const stats = await this.userService.getUserStats(factoryId);
      return ResponseHelper.success(res, stats, '用户统计获取成功');
    } catch (error) {
      console.error('获取用户统计失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }
}

// 导出控制器实例的方法，确保正确绑定this
const userController = new UserController();

module.exports = {
  getUserList: userController.getUserList.bind(userController),
  getUserById: userController.getUserById.bind(userController),
  createUser: userController.createUser.bind(userController),
  updateUser: userController.updateUser.bind(userController),
  updateOwnProfile: userController.updateOwnProfile.bind(userController),
  toggleUserStatus: userController.toggleUserStatus.bind(userController),
  resetUserPassword: userController.resetUserPassword.bind(userController),
  deleteUser: userController.deleteUser.bind(userController),
  getFactoryList: userController.getFactoryList.bind(userController),
  createFactory: userController.createFactory.bind(userController),
  getFactoryById: userController.getFactoryById.bind(userController),
  updateFactory: userController.updateFactory.bind(userController),
  deleteFactory: userController.deleteFactory.bind(userController),
  getUserStats: userController.getUserStats.bind(userController)
};
