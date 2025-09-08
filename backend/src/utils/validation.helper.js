/**
 * 消防器材点检系统 - 验证辅助工具
 * 基于Joi的数据验证规则
 */

const Joi = require('joi');
const { ensureStandardErrors } = require('./validation-error.formatter');
const ResponseHelper = require('./response.helper');

class ValidationHelper {
  /**
   * 器材创建/更新验证规则
   */
  static equipmentSchema = {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required().messages({
        'string.min': '器材名称至少2个字符',
        'string.max': '器材名称不能超过100个字符',
        'any.required': '器材名称为必填项'
      }),
      typeId: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string().min(1).max(50)
      ).required().messages({
        'alternatives.match': '器材类型ID必须是正整数或器材类型名称',
        'any.required': '器材类型为必填项'
      }),
      location: Joi.string().min(2).max(200).required().messages({
        'string.min': '器材位置至少2个字符',
        'string.max': '器材位置不能超过200个字符',
        'any.required': '器材位置为必填项'
      }),
      specifications: Joi.string().max(500).allow('', null).messages({
        'string.max': '规格说明不能超过500个字符'
      }),
      productionDate: Joi.date().iso().max('now').required().messages({
        'date.base': '生产日期格式不正确',
        'date.max': '生产日期不能晚于当前日期',
        'any.required': '生产日期为必填项'
      }),
      expiryDate: Joi.date().iso().min(Joi.ref('productionDate')).required().messages({
        'date.base': '有效期格式不正确',
        'date.min': '有效期不能早于生产日期',
        'any.required': '有效期为必填项'
      }),
      factoryId: Joi.number().integer().positive().required().messages({
        'number.base': '厂区ID必须是数字',
        'number.positive': '厂区ID必须是正数',
        'any.required': '厂区为必填项'
      })
    }),

    update: Joi.object({
      name: Joi.string().min(2).max(100).messages({
        'string.min': '器材名称至少2个字符',
        'string.max': '器材名称不能超过100个字符'
      }),
      typeId: Joi.number().integer().positive().messages({
        'number.base': '器材类型ID必须是数字',
        'number.positive': '器材类型ID必须是正数'
      }),
      location: Joi.string().min(2).max(200).messages({
        'string.min': '器材位置至少2个字符',
        'string.max': '器材位置不能超过200个字符'
      }),
      specifications: Joi.string().max(500).allow('', null).messages({
        'string.max': '规格说明不能超过500个字符'
      }),
      productionDate: Joi.date().iso().max('now').messages({
        'date.base': '生产日期格式不正确',
        'date.max': '生产日期不能晚于当前日期'
      }),
      expiryDate: Joi.date().iso().messages({
        'date.base': '有效期格式不正确'
      }),
      status: Joi.string().valid('NORMAL', 'ABNORMAL', 'SCRAPPED').messages({
        'any.only': '器材状态只能是: NORMAL, ABNORMAL, SCRAPPED'
      })
    })
  };

  /**
   * 点检记录验证规则
   */
  static inspectionSchema = {
    create: Joi.object({
      equipmentId: Joi.number().integer().positive().required().messages({
        'number.base': '器材ID必须是数字',
        'number.positive': '器材ID必须是正数',
        'any.required': '器材ID为必填项'
      }),
      overallResult: Joi.string().valid('NORMAL', 'ABNORMAL').required().messages({
        'any.only': '点检结果只能是: NORMAL, ABNORMAL',
        'any.required': '点检结果为必填项'
      }),
      checklistResults: Joi.array().items(
        Joi.object({
          itemName: Joi.string().required().messages({
            'any.required': '检查项名称为必填项'
          }),
          result: Joi.string().valid('NORMAL', 'ABNORMAL').required().messages({
            'any.only': '检查项结果只能是: NORMAL, ABNORMAL',
            'any.required': '检查项结果为必填项'
          }),
          note: Joi.string().max(200).allow('', null).messages({
            'string.max': '备注不能超过200个字符'
          })
        })
      ).min(1).required().messages({
        'array.min': '至少需要一个检查项',
        'any.required': '检查项列表为必填项'
      }),
      // 新增：多图片字段（数组或JSON字符串）
      inspectionImageUrls: Joi.alternatives().try(
        Joi.array().items(
          Joi.string().min(3).messages({ 'string.min': '点检图片URL过短' })
        ).min(1).messages({ 'array.min': '至少需要1张点检图片' }),
        Joi.string().min(3).messages({ 'string.min': '点检图片URL过短' })
      ).optional(),
      // 修改：允许 /uploads/ 相对路径 或 完整 http(s) URL
      inspectionImageUrl: Joi.string().custom((value, helpers) => {
        if (!value) return helpers.error('any.required')
        if (value.startsWith('/uploads/')) return value
        if (/^https?:\/\//i.test(value)) return value
        return helpers.error('string.invalidImageUrl')
      }).required().messages({
        'string.invalidImageUrl': '点检图片URL格式不正确，必须是/uploads/开头相对路径或有效的http(s)地址',
        'any.required': '点检图片为必填项'
      }),
      issueDescription: Joi.when('overallResult', {
        is: 'ABNORMAL',
        then: Joi.string().min(2).max(500).required().messages({
          'string.min': '异常描述至少2个字符',
          'string.max': '异常描述不能超过500个字符',
          'any.required': '发现异常时必须填写异常描述'
        }),
        otherwise: Joi.string().max(500).allow('', null).messages({
          'string.max': '异常描述不能超过500个字符'
        })
      }),
      // 新增：异常多图片字段（仅 ABNORMAL 时允许）
      issueImageUrls: Joi.when('overallResult', {
        is: 'ABNORMAL',
        then: Joi.alternatives().try(
          Joi.array().items(
            Joi.string().min(3).messages({ 'string.min': '异常图片URL过短' })
          ).min(1).messages({ 'array.min': '至少需要1张异常图片' }),
          Joi.string().min(3).messages({ 'string.min': '异常图片URL过短' })
        ).optional(),
        otherwise: Joi.any().strip()
      }),
      issueImageUrl: Joi.when('overallResult', {
        is: 'ABNORMAL',
        then: Joi.string().custom((value, helpers) => {
          if (!value) return helpers.error('any.required')
          if (value.startsWith('/uploads/')) return value
          if (/^https?:\/\//i.test(value)) return value
          return helpers.error('string.invalidImageUrl')
        }).required().messages({
          'string.invalidImageUrl': '异常图片URL格式不正确，必须是/uploads/开头相对路径或有效的http(s)地址',
          'any.required': '发现异常时必须上传异常图片'
        }),
        otherwise: Joi.string().custom((value, helpers) => {
          if (value === '' || value === null || typeof value === 'undefined') return value
          if (value.startsWith('/uploads/')) return value
          if (/^https?:\/\//i.test(value)) return value
          return helpers.error('string.invalidImageUrl')
        }).allow('', null).messages({
          'string.invalidImageUrl': '异常图片URL格式不正确，必须是/uploads/开头相对路径或有效的http(s)地址'
        })
      })
    })
  };

  /**
   * 隐患处理验证规则
   */
  static issueSchema = {
    handle: Joi.object({
      solution: Joi.string().min(5).max(1000).required().messages({
        'string.min': '处理方案至少5个字符',
        'string.max': '处理方案不能超过1000个字符',
        'any.required': '处理方案为必填项'
      }),
      fixedImageUrl: Joi.string().custom((value, helpers) => {
        // 允许相对路径(以/开头)或完整URL
        if (value.startsWith('/uploads/') || 
            value.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)) {
          return value;
        }
        return helpers.error('string.invalidImageUrl');
      }).required().messages({
        'string.invalidImageUrl': '处理后图片URL格式不正确，必须是/uploads/开头的相对路径或有效的图片URL',
        'any.required': '处理后图片为必填项'
      })
    }),

    audit: Joi.object({
      approved: Joi.boolean().required().messages({
        'any.required': '审核结果为必填项'
      }),
      auditNote: Joi.string().max(500).allow('', null).messages({
        'string.max': '审核备注不能超过500个字符'
      })
    }),

    comment: Joi.object({
      comment: Joi.string().min(1).max(300).required().messages({
        'string.min': '备注内容不能为空',
        'string.max': '备注内容不能超过300个字符',
        'any.required': '备注内容为必填项'
      })
    }),

    // 隐患导出参数（请求体）
    export: Joi.object({
      format: Joi.string().valid('excel', 'csv').default('excel'),
      // 允许与列表相同的筛选字段
      status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'PENDING_AUDIT', 'CLOSED', 'REJECTED'),
      reporterId: Joi.number().integer().positive(),
      handlerId: Joi.number().integer().positive(),
      equipmentId: Joi.number().integer().positive(),
      equipmentTypeId: Joi.number().integer().positive(),
      factoryId: Joi.number().integer().positive(),
      factoryIds: Joi.array().items(Joi.number().integer().positive()).min(1),
      search: Joi.string().max(100).allow('', null),
      hasImage: Joi.boolean(),
      overdue: Joi.number().integer().min(1).max(365),
      severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().min(Joi.ref('startDate'))
    })
  };

  /**
   * 用户创建验证规则
   */
  static userSchema = {
    create: Joi.object({
      username: Joi.string().alphanum().min(3).max(30).required().messages({
        'string.alphanum': '用户名只能包含字母和数字',
        'string.min': '用户名至少3个字符',
        'string.max': '用户名不能超过30个字符',
        'any.required': '用户名为必填项'
      }),
      password: Joi.string().min(8).max(128).pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/
      ).required().messages({
        'string.min': '密码至少8个字符',
        'string.max': '密码不能超过128个字符',
        'string.pattern.base': '密码必须包含大小写字母、数字和特殊字符',
        'any.required': '密码为必填项'
      }),
      fullName: Joi.string().min(2).max(50).required().messages({
        'string.min': '姓名至少2个字符',
        'string.max': '姓名不能超过50个字符',
        'any.required': '姓名为必填项'
      }),
      role: Joi.string().valid('INSPECTOR', 'FACTORY_ADMIN', 'SUPER_ADMIN').required().messages({
        'any.only': '角色只能是: INSPECTOR, FACTORY_ADMIN, SUPER_ADMIN',
        'any.required': '角色为必填项'
      }),
      // 支持多厂区：至少提供一个厂区
      factoryIds: Joi.array().items(Joi.number().integer().positive()).min(1).messages({
        'array.min': '至少选择一个厂区'
      }),
      factoryId: Joi.number().integer().positive()
    }).custom((value, helpers) => {
      if ((!value.factoryIds || value.factoryIds.length === 0) && !value.factoryId) {
        return helpers.error('any.custom', { message: '至少选择一个厂区' });
      }
      return value;
    }, 'factory selection'),

    update: Joi.object({
      username: Joi.string().alphanum().min(3).max(30),
      fullName: Joi.string().min(2).max(50),
      role: Joi.string().valid('INSPECTOR', 'FACTORY_ADMIN', 'SUPER_ADMIN'),
      factoryId: Joi.number().integer().positive(),
      factoryIds: Joi.array().items(Joi.number().integer().positive()).min(1)
    })
  };

  /**
   * 查询参数验证规则
   */
  static querySchema = {
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1).messages({
        'number.base': '页码必须是数字',
        'number.min': '页码不能小于1'
      }),
      limit: Joi.number().integer().min(1).max(100).default(20).messages({
        'number.base': '每页数量必须是数字',
        'number.min': '每页数量不能小于1',
        'number.max': '每页数量不能超过100'
      }),
      sortBy: Joi.string().allow('', null),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }),

    equipmentFilter: Joi.object({
      factoryId: Joi.number().integer().positive(),
      typeId: Joi.number().integer().positive(),
      status: Joi.string().valid('NORMAL', 'ABNORMAL', 'SCRAPPED'),
      search: Joi.string().max(100).allow('', null),
      expiringDays: Joi.number().integer().min(0).max(365)
    }),

    dateRange: Joi.object({
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().min(Joi.ref('startDate'))
    }),

    issueFilter: Joi.object({
      status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'PENDING_AUDIT', 'CLOSED', 'REJECTED'),
      reporterId: Joi.number().integer().positive(),
      handlerId: Joi.number().integer().positive(),
      equipmentId: Joi.number().integer().positive(),
      equipmentTypeId: Joi.number().integer().positive(),
      factoryId: Joi.number().integer().positive(),
      // 多厂区可选
      factoryIds: Joi.array().items(Joi.number().integer().positive()).min(1),
      // 模糊搜索：描述/器材名称/位置/二维码/上报人
      search: Joi.string().max(100).allow('', null),
      // 是否带图片（问题或整改任一图片）
      hasImage: Joi.boolean(),
      // 超期天数（开放天数>overdue，仅统计非已关闭/已驳回）
      overdue: Joi.number().integer().min(1).max(365),
      // 近似严重程度（关键词 + 开放天数）
      severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    })
  };

  /**
   * HTML解码函数 - 处理传输过程中被HTML编码的数据
   */
  static decodeHtmlEntities(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/&#x2F;/g, '/')  // 解码斜杠
      .replace(/&#x3A;/g, ':')  // 解码冒号
      .replace(/&#x3F;/g, '?')  // 解码问号
      .replace(/&#x3D;/g, '=')  // 解码等号
      .replace(/&#x26;/g, '&')  // 解码&符号
      .replace(/&#x23;/g, '#')  // 解码井号
      .replace(/&lt;/g, '<')     // 解码小于号
      .replace(/&gt;/g, '>')     // 解码大于号
      .replace(/&quot;/g, '"')   // 解码双引号
      .replace(/&#x27;/g, "'")   // 解码单引号
      .replace(/&amp;/g, '&');   // 解码&符号（最后处理）
  }

  /**
   * 递归处理对象中的HTML编码字符串
   */
  static decodeObjectHtmlEntities(obj) {
    if (typeof obj === 'string') {
      return ValidationHelper.decodeHtmlEntities(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => ValidationHelper.decodeObjectHtmlEntities(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const decoded = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          decoded[key] = ValidationHelper.decodeObjectHtmlEntities(obj[key]);
        }
      }
      return decoded;
    }
    
    return obj;
  }

  /**
   * 验证数据
   * @param {Object} schema - Joi验证规则
   * @param {Object} data - 待验证数据
   * @returns {Object} 验证结果
   */
  static validate(schema, data) {
    // 步骤1: 先进行HTML解码处理
    const decodedData = ValidationHelper.decodeObjectHtmlEntities(data);
    
    console.log(`🔧 [HTML解码] 原始数据:`, JSON.stringify(data, null, 2));
    console.log(`🔧 [HTML解码] 解码后数据:`, JSON.stringify(decodedData, null, 2));
    
    // 检查URL字段是否被解码
    if (decodedData && typeof decodedData === 'object') {
      Object.keys(decodedData).forEach(key => {
        if (key.toLowerCase().includes('url')) {
          const original = data[key];
          const decoded = decodedData[key];
          if (original !== decoded) {
            console.log(`🔧 [HTML解码] ${key}字段被解码:`);
            console.log(`  - 原始: ${original}`);
            console.log(`  - 解码: ${decoded}`);
          }
        }
      });
    }

    // 步骤2: 使用解码后的数据进行Joi验证
    const { error, value } = schema.validate(decodedData, {
      abortEarly: false, // 返回所有验证错误
      stripUnknown: true, // 移除未知字段
      convert: true // 自动类型转换
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return {
        isValid: false,
        errors,
        data: null
      };
    }

    return {
      isValid: true,
      errors: null,
      data: value
    };
  }

  /**
   * 验证中间件生成器
   * @param {Object} schema - Joi验证规则
   * @param {string} source - 数据源 ('body' | 'query' | 'params')
   */
  static validateMiddleware(schema, source = 'body') {
    return (req, res, next) => {
      const data = req[source];
      
      console.log(`🟢 [验证调试] ===== 开始${source}验证 =====`);
      console.log(`🟢 [验证调试] 请求路径: ${req.method} ${req.path}`);
      console.log(`🟢 [验证调试] 用户ID: ${req.user?.id || '未知'}`);
      console.log(`🟢 [验证调试] 原始${source}数据:`, JSON.stringify(data, null, 2));
      
      // 特别关注URL字段的验证
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(key => {
          if (key.toLowerCase().includes('url') || key.toLowerCase().includes('image')) {
            console.log(`🟢 [验证调试] URL字段检查 - ${key}:`, data[key]);
            console.log(`🟢 [验证调试] URL字段类型:`, typeof data[key]);
            if (typeof data[key] === 'string') {
              console.log(`🟢 [验证调试] URL字段长度:`, data[key].length);
              console.log(`🟢 [验证调试] URL包含HTML编码字符:`, data[key].includes('&#x') ? '是' : '否');
              console.log(`🟢 [验证调试] URL字符编码检查:`, data[key].split('').map(char => `${char}(${char.charCodeAt(0)})`).join(' '));
            }
          }
        });
      }
      
      const result = ValidationHelper.validate(schema, data);
      
      console.log(`🟢 [验证调试] 验证结果:`, result.isValid ? '通过' : '失败');

      if (!result.isValid) {
        console.log(`🟢 [验证调试] 验证错误数量:`, result.errors.length);
        result.errors.forEach((error, index) => {
          console.log(`🟢 [验证调试] 错误 ${index + 1}:`);
          console.log(`  - 字段: ${error.field}`);
          console.log(`  - 消息: ${error.message}`);
          console.log(`  - 值: ${JSON.stringify(error.value)}`);
          console.log(`  - 值类型: ${typeof error.value}`);
          
          // 特别检查URL相关错误
          if (error.field.toLowerCase().includes('url')) {
            console.log(`🟢 [验证调试] URL验证失败详情:`);
            console.log(`    - 原始值: ${error.value}`);
            console.log(`    - 是否包含协议: ${String(error.value).includes('http') ? '是' : '否'}`);
            console.log(`    - 是否包含HTML编码: ${String(error.value).includes('&#x') ? '是' : '否'}`);
            
            // 尝试手动解码看看结果
            try {
              const decoded = String(error.value).replace(/&#x2F;/g, '/').replace(/&#x3A;/g, ':');
              console.log(`    - 手动解码后: ${decoded}`);
              console.log(`    - 解码后是否为有效URL: ${/^https?:\/\/.+/.test(decoded) ? '是' : '否'}`);
            } catch (e) {
              console.log(`    - 手动解码失败: ${e.message}`);
            }
          }
        });
        
        console.log(`🟢 [验证调试] ===== 验证失败，返回422错误 =====`);
        
        const formatted = ensureStandardErrors(result.errors || []);
        return ResponseHelper.validationError(res, formatted, '部分字段有误，请修改后再提交', req.traceId);
      }

      console.log(`🟢 [验证调试] 验证通过，清理后的数据:`, JSON.stringify(result.data, null, 2));
      console.log(`🟢 [验证调试] ===== 验证完成 =====`);
      
      // 将验证后的数据替换原数据
      req[source] = result.data;
      next();
    };
  }
}

module.exports = ValidationHelper;
