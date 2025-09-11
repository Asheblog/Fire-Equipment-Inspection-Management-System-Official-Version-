/**
 * 消防器材点检系统 - 器材管理服务
 * 处理器材相关的业务逻辑
 */

const { PrismaClient } = require('@prisma/client');
const QRCodeGenerator = require('../utils/qrcode.generator');

class EquipmentService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 获取器材列表（带分页和筛选）
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   * @param {number} userFactoryId - 用户厂区ID（数据隔离）
   * @returns {Promise<Object>} 器材列表和总数
   */
  async getEquipmentList(filters = {}, pagination = {}, userFactoryId = null) {
    try {
      const {
        factoryId,
        typeId,
        status,
        search,
        expiringDays
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'id',
        sortOrder = 'desc'
      } = pagination;

      // 构建查询条件
      const where = {};

      // 数据隔离：只能查看授权厂区的器材（支持多厂区）
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        where.factoryId = { in: userFactoryId };
      } else if (userFactoryId) {
        where.factoryId = userFactoryId;
      } else if (factoryId) {
        where.factoryId = factoryId;
      }

      // 器材类型筛选
      if (typeId) {
        where.typeId = typeId;
      }

      // 状态筛选
      if (status) {
        where.status = status;
      }

      // 关键词搜索（器材名称或位置）
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { location: { contains: search } }
        ];
      }

      // 即将到期筛选
      if (expiringDays !== undefined) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + expiringDays);
        
        where.expiryDate = {
          lte: futureDate,
          gt: new Date() // 还未过期
        };
      }

      // 计算偏移量
      const skip = (page - 1) * limit;

      // 排序处理
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // 并行执行查询和计数
      const [equipments, total] = await Promise.all([
        this.prisma.equipment.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            equipmentType: {
              select: { id: true, name: true }
            },
            factory: {
              select: { id: true, name: true }
            },
            _count: {
              select: {
                inspectionLogs: true,
                issues: {
                  where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
                }
              }
            }
          }
        }),
        this.prisma.equipment.count({ where })
      ]);

      // 计算总页数
      const pages = Math.ceil(total / limit);

      // 处理器材数据，添加状态信息
      const processedEquipments = await Promise.all(equipments.map(async equipment => ({
        ...equipment,
        type: equipment.equipmentType, // 将 equipmentType 映射为 type 字段
        isExpiring: this.isEquipmentExpiring(equipment.expiryDate, 30), // 30天内到期
        isExpired: equipment.expiryDate < new Date(),
        hasActiveIssues: equipment._count.issues > 0,
        inspectionCount: equipment._count.inspectionLogs,
        // 使用完整可访问 URL 生成二维码（兼容存量纯码）
        qrImageUrl: await QRCodeGenerator.generateQRBase64(
          (QRCodeGenerator.buildQRCodeURL && !equipment.qrCode.includes('/m/inspection/'))
            ? QRCodeGenerator.buildQRCodeURL(equipment.qrCode)
            : equipment.qrCode
        )
      })));

      return {
        equipments: processedEquipments,
        pagination: {
          total,
          page,
          limit,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('获取器材列表失败:', error);
      throw new Error('获取器材列表失败');
    }
  }

  /**
   * 根据ID获取器材详情
   * @param {number} id - 器材ID
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 器材详情
   */
  async getEquipmentById(id, userFactoryId = null) {
    try {
      const where = { id };
      
      // 数据隔离（支持多厂区）
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        where.factoryId = { in: userFactoryId };
      } else if (userFactoryId) {
        where.factoryId = userFactoryId;
      }

      const equipment = await this.prisma.equipment.findFirst({
        where,
        include: {
          equipmentType: {
            select: { id: true, name: true }
          },
          factory: {
            select: { id: true, name: true, address: true }
          },
          inspectionLogs: {
            take: 5, // 最近5次点检记录
            orderBy: { inspectionTime: 'desc' },
            include: {
              inspector: {
                select: { id: true, fullName: true }
              }
            }
          },
          issues: {
            where: { status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] } },
            orderBy: { createdAt: 'desc' },
            include: {
              reporter: {
                select: { id: true, fullName: true }
              }
            }
          }
        }
      });

      if (!equipment) {
        throw new Error('器材不存在');
      }

      // 添加状态信息
      const result = {
        ...equipment,
        isExpiring: this.isEquipmentExpiring(equipment.expiryDate, 30),
        isExpired: equipment.expiryDate < new Date(),
        hasActiveIssues: equipment.issues.length > 0,
        qrImageUrl: await QRCodeGenerator.generateQRBase64(
          (QRCodeGenerator.buildQRCodeURL && !equipment.qrCode.includes('/m/inspection/'))
            ? QRCodeGenerator.buildQRCodeURL(equipment.qrCode)
            : equipment.qrCode
        )
      };

      return result;
    } catch (error) {
      console.error('获取器材详情失败:', error);
      throw error;
    }
  }

  /**
   * 根据二维码获取器材信息
   * @param {string} qrCode - 二维码
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 器材信息
   */
  async getEquipmentByQR(qrCode, userFactoryId = null) {
    try {
      // 增强兼容：若传入是完整URL，先尝试提取真正的二维码片段
      try {
        const QRGen = require('../utils/qrcode.generator');
        if (typeof QRGen.extractQRCodeFromURL === 'function') {
          const extracted = QRGen.extractQRCodeFromURL(qrCode);
          if (extracted) qrCode = extracted;
        } else if (typeof QRGen.extractQRCodeString === 'function') {
          const extracted = QRGen.extractQRCodeString(qrCode);
            if (extracted) qrCode = extracted;
        }
      } catch (e) {
        // 忽略提取异常，继续原逻辑
      }
      // 验证二维码格式
      if (!QRCodeGenerator.validateQRCode(qrCode)) {
        throw new Error('二维码格式不正确');
      }

      // 厂区权限校验延后到查询出器材后基于 factoryId 判断（支持多厂区）

      // 获取所有可能的查询格式
      const queryFormats = QRCodeGenerator.getQRCodeQueryFormats(qrCode);
      console.log(`🔍 [getEquipmentByQR] 查询格式:`, {
        输入: qrCode,
        可能格式: queryFormats
      });

      let equipment = null;

      // 尝试使用不同格式查询
      for (const format of queryFormats) {
        equipment = await this.prisma.equipment.findUnique({
          where: { qrCode: format },
          include: {
            equipmentType: {
              select: { id: true, name: true }
            },
            factory: {
              select: { id: true, name: true }
            }
          }
        });

        if (equipment) {
          console.log(`✅ [getEquipmentByQR] 使用格式 "${format}" 找到器材:`, equipment.name);
          // 查询到器材后再校验厂区权限
          if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
            if (!userFactoryId.includes(equipment.factoryId)) {
              throw new Error('无权访问该器材');
            }
          } else if (userFactoryId && equipment.factoryId !== userFactoryId) {
            throw new Error('无权访问该器材');
          }
          break;
        } else {
          console.log(`❌ [getEquipmentByQR] 格式 "${format}" 未找到器材`);
        }
      }

      if (!equipment) {
        console.error(`❌ [getEquipmentByQR] 所有格式都未找到器材:`, {
          输入: qrCode,
          尝试的格式: queryFormats
        });
        throw new Error('器材不存在');
      }

      return {
        ...equipment,
        isExpiring: this.isEquipmentExpiring(equipment.expiryDate, 30),
        isExpired: equipment.expiryDate < new Date(),
        qrImageUrl: await QRCodeGenerator.generateQRBase64(
          (QRCodeGenerator.buildQRCodeURL && !equipment.qrCode.includes('/m/inspection/'))
            ? QRCodeGenerator.buildQRCodeURL(equipment.qrCode)
            : equipment.qrCode
        )
      };
    } catch (error) {
      console.error('根据二维码获取器材失败:', error);
      throw error;
    }
  }

  /**
   * 创建新器材
   * @param {Object} equipmentData - 器材数据
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 创建的器材
   */
  async createEquipment(equipmentData, userFactoryId = null) {
    try {
      const { name, typeId, location, specifications, productionDate, expiryDate, factoryId } = equipmentData;

      // 数据隔离：只能在自己厂区创建器材
      const finalFactoryId = userFactoryId || factoryId;

      // 处理器材类型：如果传入的是字符串，说明是器材类型名称，需要查找对应的ID
      let finalTypeId = typeId;
      if (typeof typeId === 'string') {
        const equipmentType = await this.prisma.equipmentType.findFirst({
          where: { name: typeId }
        });
        
        if (!equipmentType) {
          throw new Error(`器材类型 "${typeId}" 不存在`);
        }
        
        finalTypeId = equipmentType.id;
      }

      // 验证所有必要参数
      if (!name || !finalTypeId || !finalFactoryId || !location) {
        throw new Error(`创建器材缺少必要参数: name=${name}, typeId=${finalTypeId}, factoryId=${finalFactoryId}, location=${location}`);
      }

      // 生成纯码并存储（不保存完整URL）
      const qrCode = QRCodeGenerator.generateEquipmentCode({
        name,
        typeId: finalTypeId,
        factoryId: finalFactoryId,
        location
      });

      // 检查二维码纯码是否已存在（唯一约束逻辑）
      const existingEquipment = await this.prisma.equipment.findUnique({ where: { qrCode } });

      if (existingEquipment) {
        throw new Error('器材二维码冲突，请稍后重试');
      }

      // 验证器材类型和厂区是否存在
      const [equipmentType, factory] = await Promise.all([
        this.prisma.equipmentType.findUnique({ where: { id: finalTypeId } }),
        this.prisma.factory.findUnique({ where: { id: finalFactoryId } })
      ]);

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      if (!factory) {
        throw new Error('厂区不存在');
      }

      // 创建器材
      const equipment = await this.prisma.equipment.create({
        data: {
          qrCode,
          name,
          typeId: finalTypeId,
          factoryId: finalFactoryId,
          location,
          specifications,
          productionDate: new Date(productionDate),
          expiryDate: new Date(expiryDate),
          status: 'NORMAL'
        },
        include: {
          equipmentType: {
            select: { id: true, name: true }
          },
          factory: {
            select: { id: true, name: true }
          }
        }
      });

      return {
        ...equipment,
        qrImageUrl: await QRCodeGenerator.generateQRBase64(QRCodeGenerator.buildQRCodeURL ? QRCodeGenerator.buildQRCodeURL(equipment.qrCode) : equipment.qrCode)
      };
    } catch (error) {
      console.error('创建器材失败:', error);
      throw error;
    }
  }

  /**
   * 更新器材信息
   * @param {number} id - 器材ID
   * @param {Object} updateData - 更新数据
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 更新后的器材
   */
  async updateEquipment(id, updateData, userFactoryId = null) {
    try {
      const where = { id };
      
      // 数据隔离
      if (userFactoryId) {
        where.factoryId = userFactoryId;
      }

      // 检查器材是否存在
      const existingEquipment = await this.prisma.equipment.findFirst({ where });
      if (!existingEquipment) {
        throw new Error('器材不存在或无权修改');
      }

      // 更新器材
      const equipment = await this.prisma.equipment.update({
        where: { id },
        data: {
          ...updateData,
          // 如果有日期字段，确保转换为Date对象
          ...(updateData.productionDate && { productionDate: new Date(updateData.productionDate) }),
          ...(updateData.expiryDate && { expiryDate: new Date(updateData.expiryDate) })
        },
        include: {
          equipmentType: {
            select: { id: true, name: true }
          },
          factory: {
            select: { id: true, name: true }
          }
        }
      });

      return {
        ...equipment,
        qrImageUrl: await QRCodeGenerator.generateQRBase64(
          (QRCodeGenerator.buildQRCodeURL && !equipment.qrCode.includes('/m/inspection/'))
            ? QRCodeGenerator.buildQRCodeURL(equipment.qrCode)
            : equipment.qrCode
        )
      };
    } catch (error) {
      console.error('更新器材失败:', error);
      throw error;
    }
  }

  /**
   * 删除器材
   * @param {number} id - 器材ID
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteEquipment(id, userFactoryId = null) {
    try {
      const where = { id };
      
      // 数据隔离
      if (userFactoryId) {
        where.factoryId = userFactoryId;
      }

      // 检查器材是否存在
      const equipment = await this.prisma.equipment.findFirst({ where });
      if (!equipment) {
        throw new Error('器材不存在或无权删除');
      }

      // 检查是否有关联的点检记录或隐患
      const [inspectionCount, issueCount] = await Promise.all([
        this.prisma.inspectionLog.count({ where: { equipmentId: id } }),
        this.prisma.issue.count({ where: { equipmentId: id } })
      ]);

      if (inspectionCount > 0 || issueCount > 0) {
        throw new Error('存在关联的点检记录或隐患，无法删除');
      }

      // 删除器材
      await this.prisma.equipment.delete({ where: { id } });

      return true;
    } catch (error) {
      console.error('删除器材失败:', error);
      throw error;
    }
  }

  /**
   * 创建器材类型
   * @param {Object} typeData - 器材类型数据
   * @returns {Promise<Object>} 创建的器材类型
   */
  async createEquipmentType(typeData) {
    try {
      const { name } = typeData;

      // 检查类型名称是否已存在
      const existingType = await this.prisma.equipmentType.findFirst({
        where: { name }
      });

      if (existingType) {
        throw new Error('器材类型名称已存在');
      }

      // 创建器材类型
      const equipmentType = await this.prisma.equipmentType.create({
        data: { name },
        include: {
          checklistTemplates: {
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: { equipments: true }
          }
        }
      });

      return {
        ...equipmentType,
        equipmentCount: equipmentType._count.equipments
      };
    } catch (error) {
      console.error('创建器材类型失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取器材类型详情
   * @param {number} id - 器材类型ID
   * @returns {Promise<Object>} 器材类型详情
   */
  async getEquipmentTypeById(id) {
    try {
      const equipmentType = await this.prisma.equipmentType.findUnique({
        where: { id },
        include: {
          checklistTemplates: {
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: { equipments: true }
          }
        }
      });

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      return {
        ...equipmentType,
        equipmentCount: equipmentType._count.equipments
      };
    } catch (error) {
      console.error('获取器材类型详情失败:', error);
      throw error;
    }
  }

  /**
   * 更新器材类型
   * @param {number} id - 器材类型ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的器材类型
   */
  async updateEquipmentType(id, updateData) {
    try {
      const { name } = updateData;

      // 检查器材类型是否存在
      const existingType = await this.prisma.equipmentType.findUnique({
        where: { id }
      });

      if (!existingType) {
        throw new Error('器材类型不存在');
      }

      // 检查名称是否与其他类型冲突
      if (name && name !== existingType.name) {
        const nameConflict = await this.prisma.equipmentType.findFirst({
          where: { 
            name,
            id: { not: id }
          }
        });

        if (nameConflict) {
          throw new Error('器材类型名称已存在');
        }
      }

      // 更新器材类型
      const equipmentType = await this.prisma.equipmentType.update({
        where: { id },
        data: { name },
        include: {
          checklistTemplates: {
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: { equipments: true }
          }
        }
      });

      return {
        ...equipmentType,
        equipmentCount: equipmentType._count.equipments
      };
    } catch (error) {
      console.error('更新器材类型失败:', error);
      throw error;
    }
  }

  /**
   * 删除器材类型
   * @param {number} id - 器材类型ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteEquipmentType(id) {
    try {
      // 检查器材类型是否存在
      const equipmentType = await this.prisma.equipmentType.findUnique({
        where: { id },
        include: {
          _count: {
            select: { equipments: true }
          }
        }
      });

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      // 检查是否有关联的器材
      if (equipmentType._count.equipments > 0) {
        throw new Error('该器材类型下还有关联的器材，无法删除');
      }

      // 删除器材类型（会级联删除点检项模板）
      await this.prisma.equipmentType.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      console.error('删除器材类型失败:', error);
      throw error;
    }
  }

  /**
   * 获取器材类型的点检项模板
   * @param {number} typeId - 器材类型ID
   * @returns {Promise<Array>} 点检项模板列表
   */
  async getChecklistTemplates(typeId) {
    try {
      // 验证器材类型是否存在
      const equipmentType = await this.prisma.equipmentType.findUnique({
        where: { id: typeId }
      });

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      const templates = await this.prisma.checklistTemplate.findMany({
        where: { typeId },
        orderBy: { sortOrder: 'asc' }
      });

      return templates;
    } catch (error) {
      console.error('获取点检项模板失败:', error);
      throw error;
    }
  }

  /**
   * 创建点检项模板
   * @param {number} typeId - 器材类型ID
   * @param {Object} templateData - 模板数据
   * @returns {Promise<Object>} 创建的模板
   */
  async createChecklistTemplate(typeId, templateData) {
    try {
      const { itemName } = templateData;

      // 验证器材类型是否存在
      const equipmentType = await this.prisma.equipmentType.findUnique({
        where: { id: typeId }
      });

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      // 检查项目名称是否已存在
      const existingTemplate = await this.prisma.checklistTemplate.findFirst({
        where: { 
          typeId,
          itemName 
        }
      });

      if (existingTemplate) {
        throw new Error('该点检项目已存在');
      }

      // 获取当前最大排序号
      const maxSortOrder = await this.prisma.checklistTemplate.findFirst({
        where: { typeId },
        orderBy: { sortOrder: 'desc' }
      });

      const sortOrder = maxSortOrder ? maxSortOrder.sortOrder + 1 : 1;

      // 创建点检项模板
      const template = await this.prisma.checklistTemplate.create({
        data: {
          typeId,
          itemName,
          sortOrder
        }
      });

      return template;
    } catch (error) {
      console.error('创建点检项模板失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建点检项模板
   * @param {number} typeId - 器材类型ID
   * @param {Object} batchData - 批量数据
   * @returns {Promise<Object>} 创建结果
   */
  async createChecklistTemplatesBatch(typeId, batchData) {
    try {
      const { itemNames } = batchData;

      // 验证器材类型是否存在
      const equipmentType = await this.prisma.equipmentType.findUnique({
        where: { id: typeId }
      });

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      // 过滤和去重处理
      const validItemNames = [...new Set(
        itemNames
          .filter(name => name && name.trim()) // 过滤空字符串
          .map(name => name.trim()) // 去除前后空格
      )];

      if (validItemNames.length === 0) {
        throw new Error('没有有效的点检项目名称');
      }

      // 检查哪些项目名称已经存在
      const existingTemplates = await this.prisma.checklistTemplate.findMany({
        where: {
          typeId,
          itemName: { in: validItemNames }
        },
        select: { itemName: true }
      });

      const existingNames = existingTemplates.map(t => t.itemName);
      const newItemNames = validItemNames.filter(name => !existingNames.includes(name));

      if (newItemNames.length === 0) {
        throw new Error('所有点检项目都已存在');
      }

      // 获取当前最大排序号
      const maxSortOrder = await this.prisma.checklistTemplate.findFirst({
        where: { typeId },
        orderBy: { sortOrder: 'desc' }
      });

      const startSortOrder = maxSortOrder ? maxSortOrder.sortOrder + 1 : 1;

      // 使用事务批量创建
      const createdTemplates = await this.prisma.$transaction(async (tx) => {
        const templates = [];
        for (let i = 0; i < newItemNames.length; i++) {
          const template = await tx.checklistTemplate.create({
            data: {
              typeId,
              itemName: newItemNames[i],
              sortOrder: startSortOrder + i
            }
          });
          templates.push(template);
        }
        return templates;
      });

      return {
        success: true,
        created: createdTemplates,
        createdCount: createdTemplates.length,
        skippedCount: existingNames.length,
        skippedItems: existingNames,
        message: `成功创建 ${createdTemplates.length} 个点检项目${existingNames.length > 0 ? `，跳过 ${existingNames.length} 个已存在的项目` : ''}`
      };
    } catch (error) {
      console.error('批量创建点检项模板失败:', error);
      throw error;
    }
  }

  /**
   * 更新点检项模板
   * @param {number} typeId - 器材类型ID
   * @param {number} id - 模板ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的模板
   */
  async updateChecklistTemplate(typeId, id, updateData) {
    try {
      const { itemName } = updateData;

      // 检查模板是否存在
      const existingTemplate = await this.prisma.checklistTemplate.findFirst({
        where: { id, typeId }
      });

      if (!existingTemplate) {
        throw new Error('点检项模板不存在');
      }

      // 检查名称是否与其他模板冲突
      if (itemName && itemName !== existingTemplate.itemName) {
        const nameConflict = await this.prisma.checklistTemplate.findFirst({
          where: { 
            typeId,
            itemName,
            id: { not: id }
          }
        });

        if (nameConflict) {
          throw new Error('该点检项目已存在');
        }
      }

      // 更新模板
      const template = await this.prisma.checklistTemplate.update({
        where: { id },
        data: { itemName }
      });

      return template;
    } catch (error) {
      console.error('更新点检项模板失败:', error);
      throw error;
    }
  }

  /**
   * 删除点检项模板
   * @param {number} typeId - 器材类型ID
   * @param {number} id - 模板ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteChecklistTemplate(typeId, id) {
    try {
      // 检查模板是否存在
      const template = await this.prisma.checklistTemplate.findFirst({
        where: { id, typeId }
      });

      if (!template) {
        throw new Error('点检项模板不存在');
      }

      // 删除模板
      await this.prisma.checklistTemplate.delete({
        where: { id }
      });

      // 重新排序其他模板
      await this.reorderChecklistTemplatesAfterDelete(typeId, template.sortOrder);

      return true;
    } catch (error) {
      console.error('删除点检项模板失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新点检项排序
   * @param {number} typeId - 器材类型ID
   * @param {Array} templateIds - 模板ID数组（按新排序）
   * @returns {Promise<Array>} 更新后的模板列表
   */
  async reorderChecklistTemplates(typeId, templateIds) {
    try {
      // 验证器材类型是否存在
      const equipmentType = await this.prisma.equipmentType.findUnique({
        where: { id: typeId }
      });

      if (!equipmentType) {
        throw new Error('器材类型不存在');
      }

      // 验证所有模板ID是否属于该类型
      const templates = await this.prisma.checklistTemplate.findMany({
        where: { 
          typeId,
          id: { in: templateIds }
        }
      });

      if (templates.length !== templateIds.length) {
        throw new Error('存在无效的模板ID');
      }

      // 批量更新排序
      const updatePromises = templateIds.map((templateId, index) =>
        this.prisma.checklistTemplate.update({
          where: { id: templateId },
          data: { sortOrder: index + 1 }
        })
      );

      await Promise.all(updatePromises);

      // 返回更新后的模板列表
      const updatedTemplates = await this.prisma.checklistTemplate.findMany({
        where: { typeId },
        orderBy: { sortOrder: 'asc' }
      });

      return updatedTemplates;
    } catch (error) {
      console.error('重新排序点检项模板失败:', error);
      throw error;
    }
  }

  /**
   * 删除模板后重新排序其他模板
   * @param {number} typeId - 器材类型ID
   * @param {number} deletedSortOrder - 被删除模板的排序号
   * @returns {Promise<void>}
   */
  async reorderChecklistTemplatesAfterDelete(typeId, deletedSortOrder) {
    try {
      // 将排序号大于被删除模板的所有模板向前移动一位
      await this.prisma.checklistTemplate.updateMany({
        where: {
          typeId,
          sortOrder: { gt: deletedSortOrder }
        },
        data: {
          sortOrder: {
            decrement: 1
          }
        }
      });
    } catch (error) {
      console.error('重新排序模板失败:', error);
      throw error;
    }
  }
  async getEquipmentTypes() {
    try {
      const types = await this.prisma.equipmentType.findMany({
        orderBy: { name: 'asc' },
        include: {
          checklistTemplates: {
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: { equipments: true }
          }
        }
      });

      return types.map(type => ({
        ...type,
        equipmentCount: type._count.equipments
      }));
    } catch (error) {
      console.error('获取器材类型失败:', error);
      throw new Error('获取器材类型失败');
    }
  }

  /**
   * 获取器材统计信息
   * @param {number} factoryId - 厂区ID
   * @returns {Promise<Object>} 统计信息
   */
  async getEquipmentStats(factoryId = null) {
    try {
      const where = factoryId ? { factoryId } : {};

      const [
        totalCount,
        normalCount,
        abnormalCount,
        scrappedCount,
        expiringCount,
        expiredCount
      ] = await Promise.all([
        // 总数
        this.prisma.equipment.count({ where }),
        // 正常状态
        this.prisma.equipment.count({ where: { ...where, status: 'NORMAL' } }),
        // 异常状态
        this.prisma.equipment.count({ where: { ...where, status: 'ABNORMAL' } }),
        // 报废状态
        this.prisma.equipment.count({ where: { ...where, status: 'SCRAPPED' } }),
        // 即将到期（30天内）
        this.prisma.equipment.count({
          where: {
            ...where,
            expiryDate: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              gt: new Date()
            }
          }
        }),
        // 已过期
        this.prisma.equipment.count({
          where: {
            ...where,
            expiryDate: { lt: new Date() }
          }
        })
      ]);

      return {
        total: totalCount,
        byStatus: {
          normal: normalCount,
          abnormal: abnormalCount,
          scrapped: scrappedCount
        },
        byExpiry: {
          expiring: expiringCount,
          expired: expiredCount
        },
        healthRate: totalCount > 0 ? ((normalCount / totalCount) * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('获取器材统计失败:', error);
      throw new Error('获取器材统计失败');
    }
  }

  /**
   * 根据二维码获取同位置的所有器材和检查项模板
   * @param {string} qrCode - 扫描的器材二维码
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 位置信息和器材列表
   */
  async getEquipmentsByLocation(qrCode, userFactoryId = null) {
    try {
      // 1. 验证二维码格式
      if (!QRCodeGenerator.validateQRCode(qrCode)) {
        throw new Error('二维码格式不正确');
      }

      // 2. 厂区权限检查延后到查询出器材后判断（支持多厂区）

      // 3. 获取扫描的器材信息（支持多种格式）
      const queryFormats = QRCodeGenerator.getQRCodeQueryFormats(qrCode);
      console.log(`🔍 [getEquipmentsByLocation] 查询格式:`, {
        输入: qrCode,
        可能格式: queryFormats
      });

      let sourceEquipment = null;

      // 尝试使用不同格式查询
      for (const format of queryFormats) {
        sourceEquipment = await this.prisma.equipment.findUnique({
          where: { qrCode: format },
          include: {
            factory: {
              select: { id: true, name: true }
            }
          }
        });

        if (sourceEquipment) {
          console.log(`✅ [getEquipmentsByLocation] 使用格式 "${format}" 找到器材:`, sourceEquipment.name);
          break;
        } else {
          console.log(`❌ [getEquipmentsByLocation] 格式 "${format}" 未找到器材`);
        }
      }

      if (!sourceEquipment) {
        console.error(`❌ [getEquipmentsByLocation] 所有格式都未找到器材:`, {
          输入: qrCode,
          尝试的格式: queryFormats
        });
        throw new Error('器材不存在');
      }

      // 权限检查：确认扫描的器材所在厂区在授权范围内
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        if (!userFactoryId.includes(sourceEquipment.factoryId)) {
          throw new Error('无权访问该器材');
        }
      } else if (userFactoryId && sourceEquipment.factoryId !== userFactoryId) {
        throw new Error('无权访问该器材');
      }

      // 4. 查询相同位置的所有器材
      const equipments = await this.prisma.equipment.findMany({
        where: {
          location: sourceEquipment.location,
          factoryId: sourceEquipment.factoryId,
          status: { not: 'SCRAPPED' } // 排除已报废的器材
        },
        include: {
          equipmentType: {
            include: {
              checklistTemplates: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          },
          factory: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { equipmentType: { name: 'asc' } },
          { name: 'asc' }
        ]
      });

      // 5. 转换数据格式，为每个器材生成检查项模板
      const equipmentList = await Promise.all(equipments.map(async (equipment) => {
        const checklistTemplate = equipment.equipmentType.checklistTemplates.map(template => ({
          id: template.id,
          itemName: template.itemName,
          sortOrder: template.sortOrder,
          result: null, // 待填写
          note: ''     // 待填写
        }));

        return {
          ...equipment,
          checklistTemplate,
          isExpiring: this.isEquipmentExpiring(equipment.expiryDate, 30),
          isExpired: equipment.expiryDate < new Date(),
          qrImageUrl: await QRCodeGenerator.generateQRBase64(
            (QRCodeGenerator.buildQRCodeURL && !equipment.qrCode.includes('/m/inspection/'))
              ? QRCodeGenerator.buildQRCodeURL(equipment.qrCode)
              : equipment.qrCode
          )
        };
      }));

      return {
        location: sourceEquipment.location,
        factory: sourceEquipment.factory,
        equipmentCount: equipmentList.length,
        hasMultipleEquipments: equipmentList.length > 1,
        equipments: equipmentList,
        scannedEquipmentId: sourceEquipment.id
      };
    } catch (error) {
      console.error('根据位置获取器材列表失败:', error);
      throw error;
    }
  }

  /**
   * 判断器材是否即将到期
   * @param {Date} expiryDate - 到期日期
   * @param {number} days - 提前天数
   * @returns {boolean} 是否即将到期
   */
  isEquipmentExpiring(expiryDate, days = 30) {
    const now = new Date();
    const warningDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return expiryDate <= warningDate && expiryDate > now;
  }

  /**
   * 批量导入器材
   * @param {Array} equipmentList - 器材列表
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 导入结果
   */
  async batchImportEquipments(equipmentList, userFactoryId) {
    try {
      console.log('=== EquipmentService.batchImportEquipments 开始 ===');
      console.log('用户厂区ID:', userFactoryId);
      console.log('器材列表长度:', equipmentList.length);
      
      equipmentList.forEach((equipment, index) => {
        console.log(`Service层接收到器材 ${index + 1}:`, JSON.stringify(equipment, null, 2));
      });

      const results = {
        success: [],
        failed: [],
        total: equipmentList.length
      };

      for (let i = 0; i < equipmentList.length; i++) {
        console.log(`\n--- 处理器材 ${i + 1} ---`);
        console.log('原始数据:', JSON.stringify(equipmentList[i], null, 2));
        
        try {
          console.log('调用 createEquipment，参数:', {
            equipment: equipmentList[i],
            userFactoryId
          });
          
          const equipment = await this.createEquipment(equipmentList[i], userFactoryId);
          
          console.log(`✅ 器材 ${i + 1} 创建成功:`, {
            id: equipment.id,
            name: equipment.name,
            typeId: equipment.typeId
          });
          
          results.success.push({
            index: i,
            equipment
          });
        } catch (error) {
          console.error(`❌ 器材 ${i + 1} 创建失败:`, {
            error: error.message,
            stack: error.stack,
            data: equipmentList[i]
          });
          
          results.failed.push({
            index: i,
            data: equipmentList[i],
            error: error.message
          });
        }
      }

      console.log('=== 批量导入完成 ===');
      console.log('结果统计:', {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length
      });

      return results;
    } catch (error) {
      console.error('批量导入器材失败:', error);
      throw new Error('批量导入器材失败');
    }
  }

  /**
   * 按编号片段模糊搜索器材
   * @param {string} q - 搜索关键词（可为完整URL/纯码/片段）
   * @param {number} limit - 返回数量上限（1~50）
   * @param {number|number[]|null} userFactoryId - 厂区权限过滤
   * @returns {Promise<Array>} 搜索结果
   */
  async searchByCode(q, limit = 10, userFactoryId = null) {
    try {
      // 允许输入完整URL或路径，提取真实二维码片段
      let keyword = '';
      try {
        keyword = QRCodeGenerator.extractQRCodeFromURL(String(q || ''));
      } catch (_) {
        keyword = String(q || '');
      }
      keyword = keyword.trim();

      if (!keyword || keyword.length < 3) {
        throw new Error('搜索关键词过短');
      }

      // 厂区与状态过滤
      const whereBase = {
        status: { not: 'SCRAPPED' }
      };
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        whereBase.factoryId = { in: userFactoryId };
      } else if (userFactoryId) {
        whereBase.factoryId = userFactoryId;
      }

      // 组合 OR 条件：contains + 针对短片段的 endsWith（尾段校验码命中）
      const upper = keyword.toUpperCase();
      const or = [
        { qrCode: { contains: keyword } }
      ];
      if (upper !== keyword) {
        or.push({ qrCode: { contains: upper } });
      }
      if (upper.length <= 6) {
        or.push({ qrCode: { endsWith: upper } });
        if (upper !== keyword) {
          or.push({ qrCode: { endsWith: keyword } });
        }
      }

      const take = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

      const items = await this.prisma.equipment.findMany({
        where: { ...whereBase, OR: or },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          qrCode: true,
          location: true,
          createdAt: true,
          equipmentType: {
            select: { id: true, name: true }
          }
        }
      });

      return items;
    } catch (error) {
      console.error('搜索器材失败:', error);
      throw error;
    }
  }
}

module.exports = EquipmentService;
