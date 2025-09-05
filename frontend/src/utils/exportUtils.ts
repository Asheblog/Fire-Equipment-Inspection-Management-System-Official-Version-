import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import type { Equipment } from '@/types'

// 器材数据导出工具
export class EquipmentExporter {
  /**
   * 将器材数据转换为导出格式
   */
  static formatEquipmentData(equipments: Equipment[]) {
    return equipments.map((equipment, index) => ({
      '序号': index + 1,
      '器材名称': equipment.name,
      '器材类型': equipment.equipmentType?.name || equipment.type?.name || '未知',
      '二维码': equipment.qrCode,
      '安装位置': equipment.location,
      '状态': equipment.status === 'NORMAL' ? '正常' : equipment.status === 'ABNORMAL' ? '异常' : '维修中',
      '厂区': equipment.factory?.name || '未知',
      '最后检查时间': equipment.lastInspectedAt 
        ? new Date(equipment.lastInspectedAt).toLocaleDateString('zh-CN')
        : '未检查',
      '创建时间': equipment.createdAt ? new Date(equipment.createdAt).toLocaleDateString('zh-CN') : '',
      '备注': equipment.description || ''
    }))
  }

  /**
   * 导出为Excel文件
   */
  static exportToExcel(equipments: Equipment[], filename?: string) {
    try {
      const data = this.formatEquipmentData(equipments)
      
      // 创建工作簿
      const workbook = XLSX.utils.book_new()
      
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(data)
      
      // 设置列宽
      const columnWidths = [
        { wch: 6 },   // 序号
        { wch: 20 },  // 器材名称
        { wch: 15 },  // 器材类型
        { wch: 25 },  // 二维码
        { wch: 20 },  // 安装位置
        { wch: 10 },  // 状态
        { wch: 15 },  // 厂区
        { wch: 15 },  // 最后检查时间
        { wch: 15 },  // 创建时间
        { wch: 30 }   // 备注
      ]
      worksheet['!cols'] = columnWidths
      
      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, '器材清单')
      
      // 生成Excel文件
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'array' 
      })
      
      // 下载文件
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      
      const defaultFilename = `消防器材清单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`
      saveAs(blob, filename || defaultFilename)
      
      return true
    } catch (error) {
      console.error('导出Excel失败:', error)
      throw new Error('导出Excel文件失败')
    }
  }

  /**
   * 导出为CSV文件
   */
  static exportToCSV(equipments: Equipment[], filename?: string) {
    try {
      const data = this.formatEquipmentData(equipments)
      
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(data)
      
      // 转换为CSV
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      
      // 添加BOM以支持中文
      const bom = '\uFEFF'
      const csvWithBom = bom + csv
      
      // 下载文件
      const blob = new Blob([csvWithBom], { 
        type: 'text/csv;charset=utf-8' 
      })
      
      const defaultFilename = `消防器材清单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`
      saveAs(blob, filename || defaultFilename)
      
      return true
    } catch (error) {
      console.error('导出CSV失败:', error)
      throw new Error('导出CSV文件失败')
    }
  }

  /**
   * 导出为JSON文件（可选）
   */
  static exportToJSON(equipments: Equipment[], filename?: string) {
    try {
      const jsonData = JSON.stringify(equipments, null, 2)
      
      const blob = new Blob([jsonData], { 
        type: 'application/json;charset=utf-8' 
      })
      
      const defaultFilename = `消防器材数据_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
      saveAs(blob, filename || defaultFilename)
      
      return true
    } catch (error) {
      console.error('导出JSON失败:', error)
      throw new Error('导出JSON文件失败')
    }
  }

  /**
   * 根据文件类型导出
   */
  static exportByType(
    equipments: Equipment[], 
    type: 'excel' | 'csv' | 'json',
    filename?: string
  ) {
    switch (type) {
      case 'excel':
        return this.exportToExcel(equipments, filename)
      case 'csv':
        return this.exportToCSV(equipments, filename)
      case 'json':
        return this.exportToJSON(equipments, filename)
      default:
        throw new Error('不支持的导出格式')
    }
  }

  /**
   * 获取导出数据统计信息
   */
  static getExportStats(equipments: Equipment[]) {
    const stats = {
      total: equipments.length,
      normal: equipments.filter(e => e.status === 'NORMAL').length,
      abnormal: equipments.filter(e => e.status === 'ABNORMAL').length,
      maintenance: equipments.filter(e => e.status === 'MAINTENANCE').length,
      byType: {} as Record<string, number>,
      byFactory: {} as Record<string, number>
    }

    // 按类型统计
    equipments.forEach(equipment => {
      const typeName = equipment.equipmentType?.name || '未知'
      stats.byType[typeName] = (stats.byType[typeName] || 0) + 1
    })

    // 按厂区统计
    equipments.forEach(equipment => {
      const factoryName = equipment.factory?.name || '未知'
      stats.byFactory[factoryName] = (stats.byFactory[factoryName] || 0) + 1
    })

    return stats
  }
}
