import * as XLSX from 'xlsx'
import type { Equipment } from '@/types'

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
    console.log('=== 开始检测列映射 ===')
    console.log('输入表头:', headers)
    
    const mapping: Record<string, number> = {}
    const usedColumns = new Set<number>()
    
    // 第一轮：优先处理名称字段（typeName, factoryName）
    const nameFields = ['typeName', 'factoryName']
    for (const field of nameFields) {
      const aliases = this.columnMapping[field]
      console.log(`优先检测名称字段 "${field}", 别名:`, aliases)
      
      for (let i = 0; i < headers.length; i++) {
        if (usedColumns.has(i)) continue
        
        const header = headers[i]?.toString().trim()
        if (header) {
          console.log(`  检查表头 "${header}" (索引 ${i})`)
          
          // 检查完全匹配（忽略大小写）
          const exactMatch = aliases.some(alias => {
            const isMatch = header.toLowerCase() === alias.toLowerCase()
            if (isMatch) console.log(`    ✅ 完全匹配: "${header}" === "${alias}"`)
            return isMatch
          })
          
          if (exactMatch) {
            mapping[field] = i
            usedColumns.add(i)
            console.log(`  🎯 名称字段 "${field}" 映射到索引 ${i} (完全匹配)`)
            break
          }
        }
      }
    }
    
    // 第二轮：处理其他字段，但跳过已经被名称字段占用的列
    const otherFields = Object.keys(this.columnMapping).filter(field => !nameFields.includes(field))
    for (const field of otherFields) {
      const aliases = this.columnMapping[field]
      console.log(`检测其他字段 "${field}", 别名:`, aliases)
      
      for (let i = 0; i < headers.length; i++) {
        if (usedColumns.has(i)) {
          console.log(`  跳过已占用的索引 ${i}`)
          continue
        }
        
        const header = headers[i]?.toString().trim()
        if (header) {
          console.log(`  检查表头 "${header}" (索引 ${i})`)
          
          // 首先检查完全匹配（忽略大小写）
          const exactMatch = aliases.some(alias => {
            const isMatch = header.toLowerCase() === alias.toLowerCase()
            if (isMatch) console.log(`    ✅ 完全匹配: "${header}" === "${alias}"`)
            return isMatch
          })
          
          if (exactMatch) {
            mapping[field] = i
            usedColumns.add(i)
            console.log(`  🎯 字段 "${field}" 映射到索引 ${i} (完全匹配)`)
            break
          }
          
          // 如果没有完全匹配，再检查包含关系
          const containsMatch = aliases.some(alias => {
            const isMatch = header.toLowerCase().includes(alias.toLowerCase()) ||
                           alias.toLowerCase().includes(header.toLowerCase())
            if (isMatch) console.log(`    ⚠️ 包含匹配: "${header}" ~= "${alias}"`)
            return isMatch
          })
          
          if (containsMatch) {
            mapping[field] = i
            usedColumns.add(i)
            console.log(`  🎯 字段 "${field}" 映射到索引 ${i} (包含匹配)`)
            break
          }
        }
      }
    }
    
    console.log('最终列映射结果:', mapping)
    console.log('已使用的列索引:', Array.from(usedColumns))
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
  ): { 
    success: Partial<Equipment>[], 
    errors: Array<{ row: number, errors: string[] }> 
  } {
    console.log('=== 开始解析器材数据 ===')
    console.log('原始数据行数:', rawData.length)
    console.log('列映射:', mapping)
    console.log('器材类型列表:', equipmentTypes)
    console.log('厂区列表:', factories)
    
    const success: Partial<Equipment>[] = []
    const errors: Array<{ row: number, errors: string[] }> = []

    // 跳过表头，从第二行开始处理
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      const rowErrors: string[] = []
      
      console.log(`\n--- 处理第 ${i + 1} 行 ---`)
      console.log('原始行数据:', row)
      
      if (!row || row.every(cell => !cell)) {
        console.log(`跳过空行: ${i + 1}`)
        continue // 跳过空行
      }

      try {
        const equipment: Partial<Equipment> = {}

        // 器材名称（必填）
        if (mapping.name !== undefined) {
          const name = row[mapping.name]?.toString().trim()
          console.log(`器材名称 (索引 ${mapping.name}):`, { raw: row[mapping.name], processed: name })
          if (!name) {
            rowErrors.push('器材名称不能为空')
          } else if (name.length > 100) {
            rowErrors.push('器材名称不能超过100个字符')
          } else {
            equipment.name = name
          }
        }

        // 安装位置（必填）
        if (mapping.location !== undefined) {
          const location = row[mapping.location]?.toString().trim()
          console.log(`安装位置 (索引 ${mapping.location}):`, { raw: row[mapping.location], processed: location })
          if (!location) {
            rowErrors.push('安装位置不能为空')
          } else if (location.length > 200) {
            rowErrors.push('安装位置不能超过200个字符')
          } else {
            equipment.location = location
          }
        }

        // 规格型号（可选）
        if (mapping.specifications !== undefined) {
          const specifications = row[mapping.specifications]?.toString().trim()
          console.log(`规格型号 (索引 ${mapping.specifications}):`, { raw: row[mapping.specifications], processed: specifications })
          if (specifications) {
            if (specifications.length > 500) {
              rowErrors.push('规格型号不能超过500个字符')
            } else {
              equipment.specifications = specifications
            }
          }
        }

        // 生产日期（必填）
        if (mapping.productionDate !== undefined) {
          const productionDateValue = row[mapping.productionDate]
          console.log(`生产日期 (索引 ${mapping.productionDate}):`, { raw: productionDateValue })
          const { date: productionDate, error: prodError } = this.parseDate(productionDateValue, '生产日期')
          if (prodError) {
            rowErrors.push(prodError)
          } else if (productionDate) {
            equipment.productionDate = productionDate + 'T00:00:00.000Z'
            console.log(`生产日期解析结果:`, equipment.productionDate)
          }
        }

        // 到期日期（必填）
        if (mapping.expiryDate !== undefined) {
          const expiryDateValue = row[mapping.expiryDate]
          console.log(`到期日期 (索引 ${mapping.expiryDate}):`, { raw: expiryDateValue })
          const { date: expiryDate, error: expError } = this.parseDate(expiryDateValue, '到期日期')
          if (expError) {
            rowErrors.push(expError)
          } else if (expiryDate && equipment.productionDate) {
            // 验证到期日期不能早于生产日期
            const prodDate = new Date(equipment.productionDate)
            const expDate = new Date(expiryDate)
            if (expDate <= prodDate) {
              rowErrors.push('到期日期不能早于或等于生产日期')
            } else {
              equipment.expiryDate = expiryDate + 'T23:59:59.999Z'
              console.log(`到期日期解析结果:`, equipment.expiryDate)
            }
          } else if (expiryDate) {
            equipment.expiryDate = expiryDate + 'T23:59:59.999Z'
            console.log(`到期日期解析结果:`, equipment.expiryDate)
          }
        }

        // 器材类型处理（通过ID或名称）
        console.log('器材类型处理:', {
          hasTypeId: mapping.typeId !== undefined,
          hasTypeName: mapping.typeName !== undefined,
          typeIdIndex: mapping.typeId,
          typeNameIndex: mapping.typeName
        })
        
        if (mapping.typeId !== undefined) {
          const typeIdValue = row[mapping.typeId]
          console.log(`器材类型ID (索引 ${mapping.typeId}):`, { raw: typeIdValue })
          const typeId = parseInt(typeIdValue)
          if (!isNaN(typeId) && typeId > 0) {
            // 验证类型ID是否存在
            if (equipmentTypes.length > 0) {
              const foundType = equipmentTypes.find(t => t.id === typeId)
              if (foundType) {
                equipment.typeId = typeId
                console.log(`✅ 器材类型ID验证通过:`, foundType)
              } else {
                rowErrors.push(`器材类型ID ${typeId} 不存在`)
              }
            } else {
              equipment.typeId = typeId
            }
          } else {
            rowErrors.push('器材类型ID必须是正整数')
          }
        } else if (mapping.typeName !== undefined) {
          const typeName = row[mapping.typeName]?.toString().trim()
          console.log(`器材类型名称 (索引 ${mapping.typeName}):`, { raw: row[mapping.typeName], processed: typeName })
          if (typeName) {
            if (equipmentTypes.length > 0) {
              const foundType = equipmentTypes.find(t => 
                t.name.toLowerCase() === typeName.toLowerCase()
              )
              if (foundType) {
                // 传递器材类型名称给后端，让后端处理转换
                equipment.typeId = typeName
                console.log(`✅ 器材类型名称验证通过:`, foundType, `传递给后端: ${typeName}`)
              } else {
                rowErrors.push(`未找到器材类型: ${typeName}`)
                console.log(`❌ 未找到器材类型: ${typeName}，可用类型:`, equipmentTypes.map(t => t.name))
              }
            } else {
              // 没有类型列表时，直接传递类型名称给后端验证
              equipment.typeId = typeName
              console.log(`传递器材类型名称给后端验证: ${typeName}`)
            }
          } else {
            rowErrors.push('器材类型不能为空')
          }
        }

        // 厂区处理（通过ID或名称，可选，通常由当前用户权限决定）
        console.log('厂区处理:', {
          hasFactoryId: mapping.factoryId !== undefined,
          hasFactoryName: mapping.factoryName !== undefined,
          factoryIdIndex: mapping.factoryId,
          factoryNameIndex: mapping.factoryName
        })
        
        if (mapping.factoryId !== undefined) {
          const factoryIdValue = row[mapping.factoryId]
          console.log(`厂区ID (索引 ${mapping.factoryId}):`, { raw: factoryIdValue })
          const factoryId = parseInt(factoryIdValue)
          if (!isNaN(factoryId) && factoryId > 0) {
            if (factories.length > 0) {
              const foundFactory = factories.find(f => f.id === factoryId)
              if (foundFactory) {
                equipment.factoryId = factoryId
                console.log(`✅ 厂区ID验证通过:`, foundFactory)
              } else {
                rowErrors.push(`厂区ID ${factoryId} 不存在`)
              }
            } else {
              equipment.factoryId = factoryId
            }
          }
        } else if (mapping.factoryName !== undefined) {
          const factoryName = row[mapping.factoryName]?.toString().trim()
          console.log(`厂区名称 (索引 ${mapping.factoryName}):`, { raw: row[mapping.factoryName], processed: factoryName })
          if (factoryName && factories.length > 0) {
            const foundFactory = factories.find(f => 
              f.name.toLowerCase() === factoryName.toLowerCase()
            )
            if (foundFactory) {
              equipment.factoryId = foundFactory.id
              console.log(`✅ 厂区名称验证通过:`, foundFactory)
            } else {
              rowErrors.push(`未找到厂区: ${factoryName}`)
              console.log(`❌ 未找到厂区: ${factoryName}，可用厂区:`, factories.map(f => f.name))
            }
          }
        }
        // 注意：如果没有提供厂区信息，不设置factoryId，让后端根据用户权限自动分配

        console.log('解析后的器材对象:', equipment)

        // 检查是否有必填字段缺失
        if (!equipment.name) rowErrors.push('器材名称不能为空')
        if (!equipment.location) rowErrors.push('安装位置不能为空')
        if (!equipment.typeId) rowErrors.push('器材类型不能为空')
        if (!equipment.productionDate) rowErrors.push('生产日期不能为空')
        if (!equipment.expiryDate) rowErrors.push('到期日期不能为空')

        console.log('字段验证结果:', {
          hasName: !!equipment.name,
          hasLocation: !!equipment.location,
          hasTypeId: !!equipment.typeId,
          hasProductionDate: !!equipment.productionDate,
          hasExpiryDate: !!equipment.expiryDate,
          errors: rowErrors
        })

        if (rowErrors.length === 0) {
          success.push(equipment)
          console.log(`✅ 第 ${i + 1} 行解析成功`)
        } else {
          errors.push({ row: i + 1, errors: rowErrors })
          console.log(`❌ 第 ${i + 1} 行解析失败:`, rowErrors)
        }
      } catch (error) {
        const errorMsg = `数据解析错误: ${(error as Error).message}`
        errors.push({ 
          row: i + 1, 
          errors: [errorMsg] 
        })
        console.error(`❌ 第 ${i + 1} 行解析异常:`, error)
      }
    }

    console.log('=== 器材数据解析完成 ===')
    console.log('解析结果:', {
      successCount: success.length,
      errorCount: errors.length,
      successData: success,
      errorData: errors
    })

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