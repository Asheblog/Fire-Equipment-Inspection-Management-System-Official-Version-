import * as XLSX from 'xlsx'
import type { Equipment } from '@/types'
import { createLogger } from '@/lib/logger'

// 器材数据导入工具
export class EquipmentImporter {
  /**
   * 支持的文件类型
   */
  static supportedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ]

  /**
   * 验证文件类型
   */
  static validateFileType(file: File): boolean {
    return this.supportedTypes.includes(file.type) || file.name.endsWith('.csv')
  }

  /**
   * 解析Excel/CSV文件
   */
  static async parseFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          
          // 读取第一个工作表
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          
          // 转换为JSON格式
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          resolve(jsonData)
        } catch (error) {
          reject(new Error('文件解析失败: ' + (error as Error).message))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * 标准化列名映射
   */
  static columnMapping: Record<string, string[]> = {
    name: ['器材名称', '名称', '设备名称', 'name', 'equipment_name'],
    location: ['安装位置', '位置', '地点', 'location', 'position'],
    specifications: ['规格型号', '规格', '型号', '参数', 'specifications', 'spec', 'model', 'description', 'remarks', 'note'],
    typeId: ['器材类型ID', '类型ID', 'type_id', 'equipment_type_id'], // 只匹配明确的ID字段
    typeName: ['器材类型', '类型', '设备类型', 'type', 'equipment_type', 'type_name'],
    factoryId: ['厂区ID', 'factory_id'], // 只匹配明确的ID字段
    factoryName: ['厂区', '厂区名称', 'factory', 'factory_name'],
    productionDate: ['生产日期', '制造日期', '出厂日期', 'production_date', 'manufacture_date', 'made_date'],
    expiryDate: ['到期日期', '有效期', '失效日期', '过期日期', 'expiry_date', 'expire_date', 'valid_until', 'deadline']
  }

  /**
   * 检测列名映射
   */
  static detectColumnMapping(headers: string[]): Record<string, number> {
    const log = createLogger('ImportMap')
    log.info('开始检测列映射', { headerCount: headers.length })
    const mapping: Record<string, number> = {}
    const usedColumns = new Set<number>()
    const nameFields = ['typeName', 'factoryName']
    for (const field of nameFields) {
      const aliases = this.columnMapping[field]
      log.debug('名称字段候选', { field, aliases })
      for (let i = 0; i < headers.length; i++) {
        if (usedColumns.has(i)) continue
        const header = headers[i]?.toString().trim()
        if (!header) continue
        log.debug('检查表头', { header, index: i })
        const exactMatch = aliases.some(alias => {
          const isMatch = header.toLowerCase() === alias.toLowerCase()
          if (isMatch) log.debug('完全匹配', { header, alias })
          return isMatch
        })
        if (exactMatch) {
          mapping[field] = i
          usedColumns.add(i)
          log.debug('名称字段映射', { field, index: i })
          break
        }
      }
    }
    const otherFields = Object.keys(this.columnMapping).filter(f => !nameFields.includes(f))
    for (const field of otherFields) {
      const aliases = this.columnMapping[field]
      log.debug('检测字段', { field, aliases })
      for (let i = 0; i < headers.length; i++) {
        if (usedColumns.has(i)) { log.debug('跳过已占用索引', { index: i }); continue }
        const header = headers[i]?.toString().trim()
        if (!header) continue
        log.debug('检查表头', { header, index: i })
        const exactMatch = aliases.some(alias => {
          const isMatch = header.toLowerCase() === alias.toLowerCase()
          if (isMatch) log.debug('完全匹配', { header, alias })
          return isMatch
        })
        if (exactMatch) { mapping[field] = i; usedColumns.add(i); log.debug('字段映射完全匹配', { field, index: i }); continue }
        const partialMatch = aliases.some(alias => {
          const isMatch = header.toLowerCase().includes(alias.toLowerCase()) || alias.toLowerCase().includes(header.toLowerCase())
          if (isMatch) log.debug('包含匹配', { header, alias })
          return isMatch
        })
        if (partialMatch) { mapping[field] = i; usedColumns.add(i); log.debug('字段映射包含匹配', { field, index: i }); continue }
      }
    }
    log.info('列映射完成', { mapping })
    return mapping
  }

  /**
   * 验证必填字段
   */
  static validateRequiredFields(mapping: Record<string, number>): string[] {
    const errors: string[] = []
    const required = ['name', 'location', 'productionDate', 'expiryDate']
    
    for (const field of required) {
      if (mapping[field] === undefined) {
        const aliases = this.columnMapping[field]
        errors.push(`缺少必填列: ${aliases[0]} (可接受的列名: ${aliases.join(', ')})`)
      }
    }
    
    // 检查器材类型字段（ID或名称二选一）
    if (mapping.typeId === undefined && mapping.typeName === undefined) {
      const typeIdAliases = this.columnMapping.typeId
      const typeNameAliases = this.columnMapping.typeName
      errors.push(`缺少器材类型字段: 需要 ${typeIdAliases[0]} 或 ${typeNameAliases[0]} 之一 (可接受的列名: ${[...typeIdAliases, ...typeNameAliases].join(', ')})`)
    }
    
    return errors
  }

  /**
   * 解析和验证日期
   */
  static parseDate(value: any, fieldName: string): { date: string | null, error: string | null } {
    if (!value) {
      return { date: null, error: `${fieldName}不能为空` }
    }

    const dateStr = value.toString().trim()
    if (!dateStr) {
      return { date: null, error: `${fieldName}不能为空` }
    }

    // 尝试多种日期格式
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{4}\/\d{1,2}\/\d{1,2}$/,     // YYYY/M/D or YYYY/MM/DD
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,     // M/D/YYYY or MM/DD/YYYY
      /^\d{4}\.\d{1,2}\.\d{1,2}$/,     // YYYY.M.D or YYYY.MM.DD
      /^\d{1,2}-\d{1,2}-\d{4}$/,       // M-D-YYYY or MM-DD-YYYY
    ]

    let parsedDate: Date | null = null

    // 先检查是否为Excel日期数字格式
    if (/^\d{5}$/.test(dateStr)) {
      // Excel日期序列号转换
      const excelDate = parseInt(dateStr)
      const baseDate = new Date(1900, 0, 1)
      parsedDate = new Date(baseDate.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000)
    } else {
      // 尝试标准格式解析
      for (const format of dateFormats) {
        if (format.test(dateStr)) {
          parsedDate = new Date(dateStr)
          break
        }
      }
      
      // 如果还没解析成功，尝试直接用Date构造函数
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        parsedDate = new Date(dateStr)
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return { 
        date: null, 
        error: `${fieldName}格式不正确，支持格式：YYYY-MM-DD, YYYY/MM/DD 等` 
      }
    }

    // 验证日期合理性（不能是未来的日期对于生产日期）
    if (fieldName === '生产日期' && parsedDate > new Date()) {
      return { 
        date: null, 
        error: '生产日期不能晚于当前日期' 
      }
    }

    return { 
      date: parsedDate.toISOString().split('T')[0], // 返回YYYY-MM-DD格式
      error: null 
    }
  }

  /**
   * 解析器材数据
   */
  static parseEquipmentData(
    rawData: any[][],
    mapping: Record<string, number>,
    equipmentTypes: Array<{ id: number, name: string }> = [],
    factories: Array<{ id: number, name: string }> = []
  ): { success: Partial<Equipment>[]; errors: Array<{ row: number; errors: string[] }> } {
    const log = createLogger('ImportParse')
    log.info('开始解析数据', { rows: rawData.length })
    log.debug('解析上下文', { mapping, typeCount: equipmentTypes.length, factoryCount: factories.length })
    const success: Partial<Equipment>[] = []
    const errors: Array<{ row: number; errors: string[] }> = []
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      const rowErrors: string[] = []
      if (!row || row.every(cell => !cell)) { if (i < 10) log.debug('跳过空行', { rowIndex: i + 1 }); continue }
      if (i < 5) log.debug('处理行', { rowIndex: i + 1, rowSample: row })
      try {
        const equipment: Partial<Equipment> = {}
        if (mapping.name !== undefined) {
          const name = row[mapping.name]?.toString().trim()
          if (!name) rowErrors.push('器材名称不能为空')
          else if (name.length > 100) rowErrors.push('器材名称不能超过100个字符')
          else { equipment.name = name; if (i < 5) log.debug('器材名称', { value: name }) }
        }
        if (mapping.location !== undefined) {
          const location = row[mapping.location]?.toString().trim()
          if (!location) rowErrors.push('安装位置不能为空')
          else if (location.length > 200) rowErrors.push('安装位置不能超过200个字符')
          else { equipment.location = location; if (i < 5) log.debug('安装位置', { value: location }) }
        }
        if (mapping.specifications !== undefined) {
          const specifications = row[mapping.specifications]?.toString().trim()
          if (specifications) {
            if (specifications.length > 500) rowErrors.push('规格型号不能超过500个字符')
            else { equipment.specifications = specifications; if (i < 5) log.debug('规格型号', { value: specifications }) }
          }
        }
        if (mapping.productionDate !== undefined) {
          const productionDateValue = row[mapping.productionDate]
          if (i < 3) log.debug('生产日期原始值', { raw: productionDateValue })
          const { date: productionDate, error: prodError } = this.parseDate(productionDateValue, '生产日期')
          if (prodError) rowErrors.push(prodError)
          else if (productionDate) { equipment.productionDate = productionDate + 'T00:00:00.000Z'; if (i < 3) log.debug('生产日期解析', { parsed: equipment.productionDate }) }
        }
        if (mapping.expiryDate !== undefined) {
          const expiryDateValue = row[mapping.expiryDate]
          if (i < 3) log.debug('到期日期原始值', { raw: expiryDateValue })
          const { date: expiryDate, error: expError } = this.parseDate(expiryDateValue, '到期日期')
          if (expError) rowErrors.push(expError)
          else if (expiryDate && equipment.productionDate) {
            const prodDate = new Date(equipment.productionDate)
            const expDate = new Date(expiryDate)
            if (expDate <= prodDate) rowErrors.push('到期日期不能早于或等于生产日期')
            else { equipment.expiryDate = expiryDate + 'T23:59:59.999Z'; if (i < 3) log.debug('到期日期解析', { parsed: equipment.expiryDate }) }
          } else if (expiryDate) { equipment.expiryDate = expiryDate + 'T23:59:59.999Z'; if (i < 3) log.debug('到期日期解析', { parsed: equipment.expiryDate }) }
        }
        if (i === 1) log.debug('器材类型处理配置', { hasTypeId: mapping.typeId !== undefined, hasTypeName: mapping.typeName !== undefined })
        if (mapping.typeId !== undefined) {
          const typeIdValue = row[mapping.typeId]
          const typeId = parseInt(typeIdValue)
          if (!isNaN(typeId) && typeId > 0) {
            if (equipmentTypes.length > 0) {
              const foundType = equipmentTypes.find(t => t.id === typeId)
              if (foundType) { equipment.typeId = typeId; if (i < 5) log.debug('类型ID验证通过', { id: typeId }) }
              else rowErrors.push(`器材类型ID ${typeId} 不存在`)
            } else equipment.typeId = typeId
          } else rowErrors.push('器材类型ID必须是正整数')
        } else if (mapping.typeName !== undefined) {
          const typeName = row[mapping.typeName]?.toString().trim()
          if (typeName) {
            if (equipmentTypes.length > 0) {
              const foundType = equipmentTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase())
              if (foundType) { equipment.typeId = typeName; if (i < 5) log.debug('类型名称验证通过', { name: typeName, mappedId: foundType.id }) }
              else { rowErrors.push(`未找到器材类型: ${typeName}`); if (i < 5) log.warn('未找到器材类型', { input: typeName }) }
            } else { equipment.typeId = typeName; if (i < 5) log.debug('类型名称待后端验证', { name: typeName }) }
          } else rowErrors.push('器材类型不能为空')
        }
        if (i === 1) log.debug('厂区处理配置', { hasFactoryId: mapping.factoryId !== undefined, hasFactoryName: mapping.factoryName !== undefined })
        if (mapping.factoryId !== undefined) {
          const factoryIdValue = row[mapping.factoryId]
          const factoryId = parseInt(factoryIdValue)
          if (!isNaN(factoryId) && factoryId > 0) {
            if (factories.length > 0) {
              const foundFactory = factories.find(f => f.id === factoryId)
              if (foundFactory) { equipment.factoryId = factoryId; if (i < 5) log.debug('厂区ID验证通过', { id: factoryId }) }
              else rowErrors.push(`厂区ID ${factoryId} 不存在`)
            } else equipment.factoryId = factoryId
          }
        } else if (mapping.factoryName !== undefined) {
          const factoryName = row[mapping.factoryName]?.toString().trim()
          if (factoryName && factories.length > 0) {
            const foundFactory = factories.find(f => f.name.toLowerCase() === factoryName.toLowerCase())
            if (foundFactory) { equipment.factoryId = foundFactory.id; if (i < 5) log.debug('厂区名称验证通过', { name: factoryName, id: foundFactory.id }) }
            else { rowErrors.push(`未找到厂区: ${factoryName}`); if (i < 5) log.warn('未找到厂区', { input: factoryName }) }
          }
        }
        if (!equipment.name) rowErrors.push('器材名称不能为空')
        if (!equipment.location) rowErrors.push('安装位置不能为空')
        if (!equipment.typeId) rowErrors.push('器材类型不能为空')
        if (!equipment.productionDate) rowErrors.push('生产日期不能为空')
        if (!equipment.expiryDate) rowErrors.push('到期日期不能为空')
        if (i < 5) log.debug('字段验证结果', { errors: rowErrors.length })
        if (rowErrors.length === 0) { success.push(equipment); if (i < 20) log.debug('行解析成功', { row: i + 1 }) }
        else { errors.push({ row: i + 1, errors: rowErrors }); if (i < 20) log.debug('行解析失败', { row: i + 1, errors: rowErrors }) }
      } catch (err) {
        const errorMsg = `数据解析错误: ${(err as Error).message}`
        errors.push({ row: i + 1, errors: [errorMsg] })
        if (i < 20) log.error('行解析异常', { row: i + 1, error: err })
      }
    }
    log.info('解析完成', { successCount: success.length, errorCount: errors.length })
    return { success, errors }
  }

  /**
   * 生成导入模板
   */
  static generateTemplate(equipmentTypes: Array<{id: number, name: string}> = [], factories: Array<{id: number, name: string}> = []): Blob {
    // 使用真实的器材类型和厂区数据生成示例
    const defaultEquipmentType = equipmentTypes.length > 0 ? equipmentTypes[0].name : '手提式干粉灭火器'
    const secondEquipmentType = equipmentTypes.length > 1 ? equipmentTypes.find(t => t.name.includes('消火栓'))?.name || equipmentTypes[1].name : '室内消火栓'
    const thirdEquipmentType = equipmentTypes.length > 2 ? equipmentTypes[2].name : '泡沫灭火器'
    
    const defaultFactory = factories.length > 0 ? factories[0].name : '主厂区'
    
    const templateData = [
      ['器材名称', '器材类型', '安装位置', '生产日期', '到期日期', '规格型号', '厂区', '说明'],
      ['灭火器001', defaultEquipmentType, 'A栋1楼走廊', '2023-01-15', '2026-01-15', 'MFZ/ABC4', defaultFactory, '新安装设备，定期检查'],
      ['消火栓002', secondEquipmentType, 'B栋2楼楼梯间', '2023-02-20', '2028-02-20', 'SN65', defaultFactory, '室内消火栓，水压正常'],
      ['灭火器003', thirdEquipmentType, 'C栋办公室', '2023-03-10', '2025-03-10', 'JTY-GD-930', defaultFactory, '定期维护检查']
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(templateData)
    
    // 设置列宽
    worksheet['!cols'] = [
      { wch: 15 }, // 器材名称
      { wch: 15 }, // 器材类型
      { wch: 20 }, // 安装位置
      { wch: 12 }, // 生产日期
      { wch: 12 }, // 到期日期
      { wch: 15 }, // 规格型号
      { wch: 12 }, // 厂区
      { wch: 25 }  // 说明
    ]

    // 添加数据验证提示（注释行）
    const headerRow = 0
    
    // 为必填字段添加样式标记（通过单元格注释实现）
    const requiredFields = ['器材名称', '器材类型', '安装位置', '生产日期', '到期日期']
    templateData[0].forEach((header, colIndex) => {
      if (requiredFields.includes(header)) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: colIndex })
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].c = [{
            a: 'System',
            t: `必填字段：${header}`,
            r: `<text>${header}为必填字段，不能为空</text>`
          }]
        }
      }
    })

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '器材导入模板')
    
    // 添加说明页
    const instructionsData = [
      ['消防器材批量导入说明'],
      [''],
      ['必填字段：'],
      ['• 器材名称：不能为空，最多100个字符'],
      ['• 器材类型：必须是系统中已存在的类型名称'],
      ['• 安装位置：不能为空，最多200个字符'],
      ['• 生产日期：格式 YYYY-MM-DD，不能晚于当前日期'],
      ['• 到期日期：格式 YYYY-MM-DD，不能早于生产日期'],
      [''],
      ['可选字段：'],
      ['• 规格型号：最多500个字符'],
      ['• 厂区：如不填写，将使用当前用户所属厂区'],
      ['• 说明：设备相关说明信息'],
      [''],
      ['注意事项：'],
      ['• 第一行为列标题，不要修改'],
      ['• 日期格式支持：2023-01-15, 2023/1/15, 15/1/2023 等'],
      ['• 器材类型必须与系统中的类型名称完全匹配'],
      ['• 单次最多导入100条记录'],
      ['• 建议先导入少量数据进行测试'],
      ['']
    ]

    // 添加可用器材类型列表
    if (equipmentTypes.length > 0) {
      instructionsData.push(
        ['可用器材类型列表：'],
        ...equipmentTypes.map((type, index) => [`${index + 1}. ${type.name}`]),
        ['']
      )
    }

    // 添加可用厂区列表
    if (factories.length > 0) {
      instructionsData.push(
        ['可用厂区列表：'],
        ...factories.map((factory, index) => [`${index + 1}. ${factory.name}`])
      )
    }

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData)
    instructionsSheet['!cols'] = [{ wch: 60 }]
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, '导入说明')
    
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    })
    
    return new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
  }

  /**
   * 获取导入统计信息
   */
  static getImportStats(
    success: Partial<Equipment>[], 
    errors: Array<{ row: number, errors: string[] }>
  ) {
    return {
      total: success.length + errors.length,
      success: success.length,
      failed: errors.length,
      successRate: success.length + errors.length > 0 
        ? Math.round((success.length / (success.length + errors.length)) * 100) 
        : 0
    }
  }
}
