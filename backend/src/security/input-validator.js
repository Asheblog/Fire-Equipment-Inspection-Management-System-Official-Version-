const Joi = require('joi');
const { formatJoiErrors } = require('../utils/validation-error.formatter');
const ResponseHelper = require('../utils/response.helper');

/**
 * 消防器材点检系统 - 输入验证配置
 * 
 * 提供全面的输入验证规则，包括：
 * - 用户认证数据验证
 * - 设备数据验证
 * - 点检记录验证
 * - 文件上传验证
 */

class InputValidator {
  constructor() {
    this.setupValidationSchemas();
  }

  /**
   * 初始化验证模式
   */
  setupValidationSchemas() {
    // 用户登录验证
    this.loginSchema = Joi.object({
      username: Joi.string()
        .pattern(/^[a-zA-Z0-9_]+$/)
        .min(3)
        .max(30)
        .required()
        .messages({
          'string.pattern.base': '用户名只能包含字母、数字和下划线',
          'string.min': '用户名长度不能少于3位',
          'string.max': '用户名长度不能超过30位',
          'any.required': '用户名是必填项'
        }),
      password: Joi.string()
        .min(8)
        .max(128)
        .required()
        .messages({
          'string.min': '密码长度不能少于8位',
          'string.max': '密码长度不能超过128位',
          'any.required': '密码是必填项'
        })
    });

    // 用户注册验证
    this.registerSchema = Joi.object({
      username: Joi.string()
        .pattern(/^[a-zA-Z0-9_]+$/)
        .min(3)
        .max(30)
        .required()
        .messages({
          'string.pattern.base': '用户名只能包含字母、数字和下划线',
          'string.min': '用户名长度不能少于3位',
          'string.max': '用户名长度不能超过30位',
          'any.required': '用户名是必填项'
        }),
      password: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/)
        .required()
        .messages({
          'string.pattern.base': '密码必须包含大小写字母、数字和特殊字符'
        }),
      fullName: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
          'string.min': '姓名长度不能少于2位',
          'string.max': '姓名长度不能超过50位'
        }),
      role: Joi.string()
        .valid('INSPECTOR', 'FACTORY_ADMIN', 'SUPER_ADMIN')
        .required()
        .messages({
          'any.only': '角色必须是：点检员、厂区管理员或超级管理员'
        }),
      factoryId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
          'number.positive': '厂区ID必须是正整数'
        })
    });

    // 密码修改验证
    this.changePasswordSchema = Joi.object({
      oldPassword: Joi.string()
        .required()
        .messages({
          'any.required': '原密码是必填项'
        }),
      newPassword: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/)
        .required()
        .messages({
          'string.pattern.base': '新密码必须包含大小写字母、数字和特殊字符'
        }),
      confirmPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
          'any.only': '确认密码必须与新密码一致'
        })
    });

    // 器材创建验证
    this.equipmentSchema = Joi.object({
      qrCode: Joi.string()
        .max(100)
        .required()
        .messages({
          'string.max': '二维码长度不能超过100位',
          'any.required': '二维码是必填项'
        }),
      name: Joi.string()
        .max(100)
        .required()
        .messages({
          'string.max': '器材名称长度不能超过100位',
          'any.required': '器材名称是必填项'
        }),
      typeId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
          'number.positive': '器材类型ID必须是正整数',
          'any.required': '器材类型是必填项'
        }),
      factoryId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
          'number.positive': '厂区ID必须是正整数',
          'any.required': '厂区是必填项'
        }),
      location: Joi.string()
        .max(200)
        .required()
        .messages({
          'string.max': '位置信息长度不能超过200位',
          'any.required': '位置信息是必填项'
        }),
      specifications: Joi.string()
        .max(100)
        .optional()
        .allow('')
        .messages({
          'string.max': '规格信息长度不能超过100位'
        }),
      productionDate: Joi.date()
        .iso()
        .max('now')
        .required()
        .messages({
          'date.max': '生产日期不能晚于当前日期',
          'any.required': '生产日期是必填项'
        }),
      expiryDate: Joi.date()
        .iso()
        .min(Joi.ref('productionDate'))
        .required()
        .messages({
          'date.min': '过期日期不能早于生产日期',
          'any.required': '过期日期是必填项'
        })
    });

    // 点检记录验证
    this.inspectionSchema = Joi.object({
      equipmentId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
          'number.positive': '器材ID必须是正整数',
          'any.required': '器材ID是必填项'
        }),
      checklistResults: Joi.array()
        .items(
          Joi.object({
            itemName: Joi.string()
              .max(200)
              .required()
              .messages({
                'string.max': '检查项名称长度不能超过200位',
                'any.required': '检查项名称是必填项'
              }),
            result: Joi.string()
              .valid('normal', 'abnormal')
              .required()
              .messages({
                'any.only': '检查结果必须是正常或异常',
                'any.required': '检查结果是必填项'
              }),
            note: Joi.string()
              .max(500)
              .when('result', {
                is: 'abnormal',
                then: Joi.required(),
                otherwise: Joi.optional().allow('')
              })
              .messages({
                'string.max': '备注长度不能超过500位',
                'any.required': '异常时必须填写备注'
              })
          })
        )
        .min(1)
        .required()
        .messages({
          'array.min': '至少需要一个检查项',
          'any.required': '检查项列表是必填项'
        }),
      // 修改：允许 /uploads/ 相对路径 或 完整 http(s) URL
      inspectionImageUrl: Joi.string().custom((value, helpers) => {
          if (!value) return helpers.error('any.required')
          if (value.startsWith('/uploads/')) return value
          if (/^https?:\/\//i.test(value)) return value
          return helpers.error('string.invalidImageUrl')
        }).required().messages({
          'string.invalidImageUrl': '检查图片URL格式不正确，须为/uploads/开头或有效http(s)地址',
          'any.required': '检查图片是必填项'
        })
    });

    // 隐患上报验证
    this.issueSchema = Joi.object({
      equipmentId: Joi.number()
        .integer()
        .positive()
        .required(),
      description: Joi.string()
        .min(10)
        .max(1000)
        .required()
        .messages({
          'string.min': '问题描述不能少于10个字符',
          'string.max': '问题描述不能超过1000个字符',
          'any.required': '问题描述是必填项'
        }),
      issueImageUrl: Joi.string()
        .uri()
        .required()
        .messages({
          'string.uri': '问题图片URL格式不正确',
          'any.required': '问题图片是必填项'
        })
    });

    // 隐患处理验证
    this.issueHandleSchema = Joi.object({
      solution: Joi.string()
        .min(10)
        .max(1000)
        .required()
        .messages({
          'string.min': '解决方案不能少于10个字符',
          'string.max': '解决方案不能超过1000个字符',
          'any.required': '解决方案是必填项'
        }),
      fixedImageUrl: Joi.string()
        .uri()
        .optional()
        .messages({
          'string.uri': '修复图片URL格式不正确'
        })
    });

    // 文件上传验证
    this.fileUploadSchema = Joi.object({
      fieldname: Joi.string().valid('inspectionImage', 'issueImage', 'fixedImage').required(),
      originalname: Joi.string().required(),
      mimetype: Joi.string().valid(
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp'
      ).required().messages({
        'any.only': '只支持 JPEG、PNG、WebP 格式的图片'
      }),
      size: Joi.number().max(5 * 1024 * 1024).required().messages({
        'number.max': '文件大小不能超过5MB'
      })
    });

    // 查询参数验证
    this.querySchema = Joi.object({
      page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
          'number.min': '页码不能小于1'
        }),
      limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20)
        .messages({
          'number.min': '每页数量不能小于1',
          'number.max': '每页数量不能超过100'
        }),
      sort: Joi.string()
        .valid('asc', 'desc')
        .default('desc'),
      search: Joi.string()
        .max(100)
        .optional()
        .allow('')
        .messages({
          'string.max': '搜索关键词长度不能超过100位'
        })
    });

    // 日期范围查询验证
    this.dateRangeSchema = Joi.object({
      startDate: Joi.date()
        .iso()
        .optional()
        .messages({
          'date.format': '开始日期格式不正确'
        }),
      endDate: Joi.date()
        .iso()
        .min(Joi.ref('startDate'))
        .optional()
        .messages({
          'date.min': '结束日期不能早于开始日期'
        })
    }).and('startDate', 'endDate'); // 如果提供了其中一个，必须提供另一个
  }

  /**
   * 创建验证中间件
   * @param {string} schemaName - 验证模式名称
   * @param {string} source - 数据源 ('body' | 'query' | 'params' | 'file')
   * @returns {Function} Express中间件函数
   */
  validate = (schemaName, source = 'body') => {
    return (req, res, next) => {
      const schema = this[schemaName];
      if (!schema) {
        return res.status(500).json({
          error: 'VALIDATION_SCHEMA_NOT_FOUND',
          message: '验证规则未找到'
        });
      }

      let dataToValidate;
      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'file':
          dataToValidate = req.file;
          break;
        default:
          dataToValidate = req.body;
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const formatted = formatJoiErrors(error.details);
        return ResponseHelper.validationError(res, formatted, '部分字段有误，请修改后再提交', req.traceId);
      }

      // 将验证后的数据重新赋值
      switch (source) {
        case 'body':
          req.validatedBody = value;
          break;
        case 'query':
          req.validatedQuery = value;
          break;
        case 'params':
          req.validatedParams = value;
          break;
        case 'file':
          req.validatedFile = value;
          break;
      }

      next();
    };
  };

  /**
   * XSS防护 - 清理HTML内容
   * @param {string} input - 输入字符串
   * @returns {string} 清理后的字符串
   */
  sanitizeHtml(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  }

  /**
   * SQL注入防护中间件
   * 检查输入中是否包含SQL关键词
   */
  preventSqlInjection = () => {
    return (req, res, next) => {
      const sqlKeywords = [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'UNION', '1=1', '1 = 1', 'EXEC', 'EXECUTE',
        '--', '/*', '*/', 'xp_', 'sp_', 'SCRIPT', 'JAVASCRIPT'
      ];

      // 更严格的SQL关键词检测，使用单词边界
      const strictSqlPatterns = [
        /\bSELECT\b/i, /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i,
        /\bDROP\b/i, /\bCREATE\b/i, /\bALTER\b/i, /\bUNION\b/i,
        /\bEXEC\b/i, /\bEXECUTE\b/i, /1\s*=\s*1/i, /--/, /\/\*/, /\*\//,
        /\bxp_/i, /\bsp_/i, /<script/i, /javascript:/i
      ];

      const checkForSqlInjection = (obj, path = '') => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];

            if (typeof value === 'string') {
              // 使用正则表达式进行更精确的检测
              for (const pattern of strictSqlPatterns) {
                if (pattern.test(value)) {
                  return {
                    detected: true,
                    field: currentPath,
                    keyword: pattern.toString(),
                    value
                  };
                }
              }
            } else if (typeof value === 'object' && value !== null) {
              const result = checkForSqlInjection(value, currentPath);
              if (result.detected) {
                return result;
              }
            }
          }
        }
        return { detected: false };
      };

      // 检查请求体、查询参数和路径参数
      const sources = [
        { data: req.body, name: 'body' },
        { data: req.query, name: 'query' },
        { data: req.params, name: 'params' }
      ];

      for (const source of sources) {
        if (source.data && typeof source.data === 'object') {
          const result = checkForSqlInjection(source.data);
          if (result.detected) {
            console.warn(`SQL注入尝试检测到 - Source: ${source.name}, Field: ${result.field}, Keyword: ${result.keyword}, IP: ${req.ip}`);
            return res.status(400).json({
              error: 'POTENTIAL_SQL_INJECTION',
              message: '检测到潜在的SQL注入攻击'
            });
          }
        }
      }

      next();
    };
  };

  /**
   * XSS防护中间件
   */
  preventXss = () => {
    return (req, res, next) => {
      const sanitizeObject = (obj) => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === 'string') {
              obj[key] = this.sanitizeHtml(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              sanitizeObject(obj[key]);
            }
          }
        }
      };

      // 清理请求体和查询参数中的HTML
      if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
      }
      
      if (req.query && typeof req.query === 'object') {
        sanitizeObject(req.query);
      }

      next();
    };
  };

  /**
   * 组合验证中间件
   * @param {string} schemaName - 验证模式名称
   * @param {string} source - 数据源
   * @returns {Array<Function>} 中间件数组
   */
  validateAndSanitize(schemaName, source = 'body') {
    return [
      this.preventSqlInjection(),
      this.preventXss(),
      this.validate(schemaName, source)
    ];
  }

  /**
   * 自定义验证器
   * @param {Object} schema - Joi验证模式
   * @returns {Function} Express中间件函数
   */
  customValidate(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const formatted = formatJoiErrors(error.details);
        return ResponseHelper.validationError(res, formatted, '部分字段有误，请修改后再提交', req.traceId);
      }

      req.validatedBody = value;
      next();
    };
  }
}

module.exports = InputValidator;
