/**
 * 消防器材点检系统 - 响应辅助工具
 * 统一API响应格式和错误处理
 */

class ResponseHelper {
  /**
   * 成功响应格式
   * @param {Object} res - Express响应对象
   * @param {*} data - 响应数据
   * @param {string} message - 响应消息
   * @param {Object} meta - 元数据（分页信息等）
   */
  static success(res, data = null, message = '操作成功', meta = null) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    if (meta) {
      response.meta = meta;
    }

    return res.status(200).json(response);
  }

  /**
   * 创建成功响应 (201)
   */
  static created(res, data = null, message = '创建成功') {
    return res.status(201).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 无内容响应 (204)
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * 错误响应格式
   * @param {Object} res - Express响应对象
   * @param {number} statusCode - HTTP状态码
   * @param {string} message - 错误消息
   * @param {Array} errors - 详细错误信息
   * @param {string} code - 错误代码
   */
  static error(res, statusCode = 500, message = '服务器内部错误', errors = null, code = null, traceId = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    if (code) {
      response.code = code;
    }

    if (traceId) {
      response.traceId = traceId;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * 客户端错误响应 (400)
   */
  static badRequest(res, message = '请求参数错误', errors = null) {
    return this.error(res, 400, message, errors, 'BAD_REQUEST');
  }

  /**
   * 未授权响应 (401)
   */
  static unauthorized(res, message = '未授权访问') {
    return this.error(res, 401, message, null, 'UNAUTHORIZED');
  }

  /**
   * 禁止访问响应 (403)
   */
  static forbidden(res, message = '禁止访问') {
    return this.error(res, 403, message, null, 'FORBIDDEN');
  }

  /**
   * 资源不存在响应 (404)
   */
  static notFound(res, message = '资源不存在') {
    return this.error(res, 404, message, null, 'NOT_FOUND');
  }

  /**
   * 冲突响应 (409)
   */
  static conflict(res, message = '资源冲突') {
    return this.error(res, 409, message, null, 'CONFLICT');
  }

  /**
   * 验证错误响应 (422)
   */
  static validationError(res, errors, message = '数据验证失败', traceId = null) {
    return this.error(res, 422, message, errors, 'VALIDATION_ERROR', traceId);
  }

  /**
   * 服务器错误响应 (500)
   */
  static internalError(res, message = '服务器内部错误') {
    return this.error(res, 500, message, null, 'INTERNAL_ERROR');
  }

  /**
   * 分页元数据生成器
   * @param {number} total - 总记录数
   * @param {number} page - 当前页码
   * @param {number} limit - 每页记录数
   * @param {number} pages - 总页数
   */
  static createPaginationMeta(total, page, limit, pages) {
    return {
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 列表响应格式（带分页）
   */
  static list(res, items, total, page, limit, message = '查询成功') {
    const totalPages = Math.ceil(total / limit);
    
    const response = {
      success: true,
      message,
      data: {
        items,
        total,
        page,
        pageSize: limit,
        totalPages
      },
      timestamp: new Date().toISOString()
    };
    
    return res.status(200).json(response);
  }

  /**
   * 业务逻辑错误响应
   */
  static businessError(res, message, code = 'BUSINESS_ERROR') {
    return this.error(res, 400, message, null, code);
  }
}

module.exports = ResponseHelper;
