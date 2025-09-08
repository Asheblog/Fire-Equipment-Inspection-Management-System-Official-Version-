/**
 * 消防器材点检系统 - 报表导出服务
 * 处理Excel、PDF报表生成和文件管理
 */

const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

class ReportExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../../exports');
    this.ensureExportDir();
  }

  /**
   * 确保导出目录存在
   */
  async ensureExportDir() {
    try {
      await fs.access(this.exportDir);
    } catch (error) {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  /**
   * 生成Excel格式的月度报表
   * @param {Object} reportData - 报表数据
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @returns {Promise<string>} 文件路径
   */
  async generateMonthlyExcelReport(reportData, year, month) {
    const workbook = new ExcelJS.Workbook();
    const filename = `月度报表_${year}-${month.toString().padStart(2, '0')}_${Date.now()}.xlsx`;
    const filepath = path.join(this.exportDir, filename);

    // 设置工作簿属性
    workbook.creator = '消防器材点检系统';
    workbook.lastModifiedBy = '系统自动生成';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. 创建概览工作表
    const summarySheet = workbook.addWorksheet('数据概览');
    await this.createSummarySheet(summarySheet, reportData, year, month);

    // 2. 创建器材统计工作表
    const equipmentSheet = workbook.addWorksheet('器材统计');
    await this.createEquipmentSheet(equipmentSheet, reportData.summary.equipment);

    // 3. 创建点检统计工作表
    const inspectionSheet = workbook.addWorksheet('点检统计');
    await this.createInspectionSheet(inspectionSheet, reportData.summary.inspection, reportData.trends.dailyInspections);

    // 4. 创建隐患统计工作表
    const issueSheet = workbook.addWorksheet('隐患统计');
    await this.createIssueSheet(issueSheet, reportData.summary.issue);

    // 5. 创建排行榜工作表
    const rankingSheet = workbook.addWorksheet('绩效排行');
    await this.createRankingSheet(rankingSheet, reportData.rankings);

    // 保存文件
    await workbook.xlsx.writeFile(filepath);
    
    return {
      filepath,
      filename,
      downloadUrl: `/api/reports/download/${encodeURIComponent(filename)}`
    };
  }

  /**
   * 创建概览工作表
   */
  async createSummarySheet(sheet, reportData, year, month) {
    // 设置标题
    sheet.mergeCells('A1:F2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `消防器材点检系统 - ${year}年${month}月报表`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 报表信息
    sheet.getCell('A4').value = '报表信息';
    sheet.getCell('A4').font = { bold: true, size: 12 };
    sheet.getCell('A5').value = '报表时间:';
    sheet.getCell('B5').value = `${year}年${month}月`;
    sheet.getCell('A6').value = '生成时间:';
    sheet.getCell('B6').value = new Date(reportData.generatedAt).toLocaleString();

    // 核心指标
    let row = 8;
    sheet.getCell(`A${row}`).value = '核心指标统计';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    const metrics = [
      ['器材总数', reportData.summary.equipment.total],
      ['正常器材', reportData.summary.equipment.normal],
      ['异常器材', reportData.summary.equipment.abnormal],
      ['器材健康率', `${reportData.summary.equipment.healthRate}%`],
      ['本月点检', reportData.summary.inspection.total],
      ['点检合格率', `${reportData.summary.inspection.passRate}%`],
      ['隐患总数', reportData.summary.issue.total],
      ['已处理隐患', reportData.summary.issue.closed],
      ['待处理隐患', reportData.summary.issue.pending],
      ['隐患处理率', `${reportData.summary.issue.resolveRate}%`]
    ];

    metrics.forEach(([label, value]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      row++;
    });

    // 设置列宽
    sheet.columns = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    // 添加边框
    this.addBorders(sheet, `A4:B${row - 1}`);
  }

  /**
   * 创建器材统计工作表
   */
  async createEquipmentSheet(sheet, equipmentData) {
    // 标题
    sheet.getCell('A1').value = '器材状态统计';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    // 表头
    const headers = ['状态', '数量', '占比'];
    headers.forEach((header, index) => {
      const cell = sheet.getCell(2, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    });

    // 数据
    const statusData = [
      ['正常', equipmentData.normal, `${((equipmentData.normal / equipmentData.total) * 100).toFixed(1)}%`],
      ['异常', equipmentData.abnormal, `${((equipmentData.abnormal / equipmentData.total) * 100).toFixed(1)}%`],
      ['报废', equipmentData.scrapped || 0, `${(((equipmentData.scrapped || 0) / equipmentData.total) * 100).toFixed(1)}%`],
      ['即将过期', equipmentData.expiring || 0, `${(((equipmentData.expiring || 0) / equipmentData.total) * 100).toFixed(1)}%`],
      ['已过期', equipmentData.expired || 0, `${(((equipmentData.expired || 0) / equipmentData.total) * 100).toFixed(1)}%`]
    ];

    statusData.forEach((row, index) => {
      row.forEach((value, colIndex) => {
        sheet.getCell(index + 3, colIndex + 1).value = value;
      });
    });

    // 总计行
    sheet.getCell(statusData.length + 3, 1).value = '总计';
    sheet.getCell(statusData.length + 3, 2).value = equipmentData.total;
    sheet.getCell(statusData.length + 3, 3).value = '100%';
    sheet.getCell(statusData.length + 3, 1).font = { bold: true };

    // 设置列宽
    sheet.columns = [
      { width: 15 },
      { width: 10 },
      { width: 10 }
    ];

    // 添加边框
    this.addBorders(sheet, `A2:C${statusData.length + 3}`);
  }

  /**
   * 创建点检统计工作表
   */
  async createInspectionSheet(sheet, inspectionData, dailyTrends) {
    // 点检统计概览
    sheet.getCell('A1').value = '点检统计概览';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const summaryData = [
      ['总点检数', inspectionData.total],
      ['正常点检', inspectionData.normal],
      ['异常点检', inspectionData.abnormal],
      ['合格率', `${inspectionData.passRate}%`]
    ];

    summaryData.forEach((row, index) => {
      sheet.getCell(index + 3, 1).value = row[0];
      sheet.getCell(index + 3, 2).value = row[1];
    });

    // 每日点检趋势
    let startRow = summaryData.length + 5;
    sheet.getCell(`A${startRow}`).value = '每日点检趋势';
    sheet.getCell(`A${startRow}`).font = { bold: true, size: 12 };
    
    startRow++;
    const trendHeaders = ['日期', '总计', '正常', '异常'];
    trendHeaders.forEach((header, index) => {
      const cell = sheet.getCell(startRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    });

    dailyTrends.forEach((trend, index) => {
      const row = startRow + index + 1;
      sheet.getCell(row, 1).value = trend.date;
      sheet.getCell(row, 2).value = trend.total;
      sheet.getCell(row, 3).value = trend.normal;
      sheet.getCell(row, 4).value = trend.abnormal;
    });

    // 设置列宽
    sheet.columns = [
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 10 }
    ];

    // 添加边框
    this.addBorders(sheet, `A3:B${summaryData.length + 2}`);
    this.addBorders(sheet, `A${startRow}:D${startRow + dailyTrends.length}`);
  }

  /**
   * 创建隐患统计工作表
   */
  async createIssueSheet(sheet, issueData) {
    sheet.getCell('A1').value = '隐患处理统计';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const issueStats = [
      ['隐患总数', issueData.total],
      ['已处理', issueData.closed],
      ['待处理', issueData.pending],
      ['处理率', `${issueData.resolveRate}%`]
    ];

    issueStats.forEach((row, index) => {
      sheet.getCell(index + 3, 1).value = row[0];
      sheet.getCell(index + 3, 2).value = row[1];
    });

    // 设置列宽
    sheet.columns = [
      { width: 15 },
      { width: 10 }
    ];

    this.addBorders(sheet, `A3:B${issueStats.length + 2}`);
  }

  /**
   * 创建排行榜工作表
   */
  async createRankingSheet(sheet, rankings) {
    // 器材类型排行
    sheet.getCell('A1').value = '器材类型点检排行';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const typeHeaders = ['排名', '器材类型', '器材数量', '点检次数'];
    typeHeaders.forEach((header, index) => {
      const cell = sheet.getCell(3, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    });

    rankings.equipmentTypes.forEach((type, index) => {
      const row = index + 4;
      sheet.getCell(row, 1).value = index + 1;
      sheet.getCell(row, 2).value = type.name;
      sheet.getCell(row, 3).value = type.equipmentCount;
      sheet.getCell(row, 4).value = type.inspectionCount;
    });

    // 点检员绩效排行
    const inspectorStartRow = rankings.equipmentTypes.length + 6;
    sheet.getCell(`A${inspectorStartRow}`).value = '点检员绩效排行';
    sheet.getCell(`A${inspectorStartRow}`).font = { bold: true, size: 14 };

    const inspectorHeaders = ['排名', '点检员', '总点检数', '正常点检', '异常点检'];
    inspectorHeaders.forEach((header, index) => {
      const cell = sheet.getCell(inspectorStartRow + 2, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    });

    rankings.inspectors.forEach((inspector, index) => {
      const row = inspectorStartRow + 3 + index;
      sheet.getCell(row, 1).value = index + 1;
      sheet.getCell(row, 2).value = inspector.name;
      sheet.getCell(row, 3).value = inspector.totalInspections;
      sheet.getCell(row, 4).value = inspector.normalInspections;
      sheet.getCell(row, 5).value = inspector.abnormalInspections;
    });

    // 设置列宽
    sheet.columns = [
      { width: 8 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 }
    ];

    // 添加边框
    this.addBorders(sheet, `A3:D${rankings.equipmentTypes.length + 3}`);
    this.addBorders(sheet, `A${inspectorStartRow + 2}:E${inspectorStartRow + 2 + rankings.inspectors.length}`);
  }

  /**
   * 添加边框
   */
  addBorders(sheet, range) {
    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // ExcelJS 没有 getRange，手动解析范围并逐个单元格设置边框
    const parseCell = (addr) => {
      const m = /^([A-Za-z]+)(\d+)$/.exec(addr.trim());
      if (!m) throw new Error(`无效的范围地址: ${addr}`);
      const colLetters = m[1].toUpperCase();
      const row = parseInt(m[2], 10);
      // 将列字母转换为数字（A -> 1, Z -> 26, AA -> 27 ...）
      let col = 0;
      for (let i = 0; i < colLetters.length; i++) {
        col = col * 26 + (colLetters.charCodeAt(i) - 64);
      }
      return { row, col };
    };

    const parts = range.split(":");
    if (parts.length !== 2) {
      // 若仅传入单个单元格，兼容处理
      const { row, col } = parseCell(range);
      sheet.getCell(row, col).border = borderStyle;
      return;
    }

    const start = parseCell(parts[0]);
    const end = parseCell(parts[1]);
    const r1 = Math.min(start.row, end.row);
    const r2 = Math.max(start.row, end.row);
    const c1 = Math.min(start.col, end.col);
    const c2 = Math.max(start.col, end.col);

    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        sheet.getCell(r, c).border = borderStyle;
      }
    }
  }

  /**
   * 生成Excel格式的隐患列表（按筛选导出）
   * @param {Array} issues - 隐患数组（已包含 equipment/reporters 等关联信息与计算字段）
   */
  async generateIssueListExcel(issues) {
    const workbook = new ExcelJS.Workbook();
    const filename = `隐患列表_${new Date().toISOString().slice(0,10)}_${Date.now()}.xlsx`;
    const filepath = path.join(this.exportDir, filename);

    const sheet = workbook.addWorksheet('隐患列表');

    // 表头
    const headers = [
      'ID','状态','严重程度','设备名称','位置','厂区','二维码','上报人','上报时间','处理人','处理时间','处理方案','审核意见','问题图数','整改图数'
    ];
    sheet.addRow(headers);
    headers.forEach((_, idx) => {
      const cell = sheet.getCell(1, idx + 1);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });

    // 数据行
    issues.forEach(issue => {
      const issueImages = (issue.issueImages && Array.isArray(issue.issueImages)) ? issue.issueImages : [];
      const fixedImages = (issue.fixedImages && Array.isArray(issue.fixedImages)) ? issue.fixedImages : [];
      sheet.addRow([
        issue.id,
        issue.status,
        issue.severity || '',
        issue.equipment?.name || '',
        issue.equipment?.location || '',
        issue.equipment?.factory?.name || '',
        issue.equipment?.qrCode || '',
        issue.reporter?.fullName || '',
        issue.createdAt ? new Date(issue.createdAt).toLocaleString() : '',
        issue.handler?.fullName || '',
        issue.handledAt ? new Date(issue.handledAt).toLocaleString() : '',
        issue.solution || '',
        issue.auditNote || '',
        issueImages.length,
        fixedImages.length
      ]);
    });

    // 列宽
    const widths = [8,10,10,20,20,14,18,12,20,12,20,30,30,10,10];
    sheet.columns = widths.map(w => ({ width: w }));

    // 边框
    this.addBorders(sheet, `A1:O${issues.length + 1}`);

    await workbook.xlsx.writeFile(filepath);
    return { filepath, filename, downloadUrl: `/api/reports/download/${encodeURIComponent(filename)}` };
  }

  /**
   * 生成CSV格式的隐患列表
   */
  async generateIssueListCSV(issues) {
    const filename = `隐患列表_${new Date().toISOString().slice(0,10)}_${Date.now()}.csv`;
    const filepath = path.join(this.exportDir, filename);
    const headers = ['ID','状态','严重程度','设备名称','位置','厂区','二维码','上报人','上报时间','处理人','处理时间','处理方案','审核意见','问题图数','整改图数'];
    const lines = [headers.join(',')];
    issues.forEach(issue => {
      const issueImages = (issue.issueImages && Array.isArray(issue.issueImages)) ? issue.issueImages : [];
      const fixedImages = (issue.fixedImages && Array.isArray(issue.fixedImages)) ? issue.fixedImages : [];
      const row = [
        issue.id,
        issue.status,
        issue.severity || '',
        (issue.equipment?.name || '').replace(/,/g,' '),
        (issue.equipment?.location || '').replace(/,/g,' '),
        (issue.equipment?.factory?.name || '').replace(/,/g,' '),
        issue.equipment?.qrCode || '',
        (issue.reporter?.fullName || '').replace(/,/g,' '),
        issue.createdAt ? new Date(issue.createdAt).toLocaleString() : '',
        (issue.handler?.fullName || '').replace(/,/g,' '),
        issue.handledAt ? new Date(issue.handledAt).toLocaleString() : '',
        (issue.solution || '').replace(/\r?\n/g,' ').replace(/,/g,' '),
        (issue.auditNote || '').replace(/\r?\n/g,' ').replace(/,/g,' '),
        issueImages.length,
        fixedImages.length
      ];
      lines.push(row.join(','));
    });
    await fs.writeFile(filepath, lines.join('\n'), 'utf8');
    return { filepath, filename, downloadUrl: `/api/reports/download/${encodeURIComponent(filename)}` };
  }

  /**
   * 生成PDF报表（从HTML模板渲染为PDF）
   */
  async generateMonthlyPDFReport(reportData, year, month) {
    const filename = `月度报表_${year}-${month.toString().padStart(2, '0')}_${Date.now()}.pdf`;
    const filepath = path.join(this.exportDir, filename);

    // 生成HTML模板
    const htmlContent = this.generateHTMLTemplate(reportData, year, month);

    try {
      // 使用 html-pdf-node 将 HTML 渲染为 PDF
      // 该库内部基于 Puppeteer 渲染，适合较复杂样式
      const pdf = require('html-pdf-node');
      const options = {
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '20mm', right: '12mm', bottom: '20mm', left: '12mm' }
      };
      const file = { content: htmlContent };
      const buffer = await pdf.generatePdf(file, options);
      await fs.writeFile(filepath, buffer);

      return {
        filepath,
        filename,
        downloadUrl: `/api/reports/download/${encodeURIComponent(filename)}`
      };
    } catch (e) {
      // 若PDF生成失败，降级返回HTML以避免整个流程失败
      console.error('PDF生成失败，回退到HTML导出:', e?.message || e);
      return this.generateMonthlyHTMLReport(reportData, year, month);
    }
  }

  /**
   * 仅生成HTML报表（用于预览）
   */
  async generateMonthlyHTMLReport(reportData, year, month) {
    const htmlFilename = `月度报表_${year}-${month.toString().padStart(2, '0')}_${Date.now()}.html`;
    const htmlFilepath = path.join(this.exportDir, htmlFilename);
    const htmlContent = this.generateHTMLTemplate(reportData, year, month);
    await fs.writeFile(htmlFilepath, htmlContent, 'utf8');
    return {
      filepath: htmlFilepath,
      filename: htmlFilename,
      downloadUrl: `/api/reports/download/${encodeURIComponent(htmlFilename)}`
    };
  }

  /**
   * 生成HTML报表模板
   */
  generateHTMLTemplate(reportData, year, month) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>消防器材点检系统 - ${year}年${month}月报表</title>
    <style>
        body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2563eb; margin-bottom: 10px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
        .stat-label { color: #64748b; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background-color: #f1f5f9; font-weight: 600; }
        .footer { text-align: center; margin-top: 40px; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>消防器材点检系统</h1>
        <h2>${year}年${month}月度报表</h2>
        <p>生成时间: ${new Date(reportData.generatedAt).toLocaleString()}</p>
    </div>

    <div class="section">
        <h2>数据概览</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.equipment.total}</div>
                <div class="stat-label">器材总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.equipment.healthRate}%</div>
                <div class="stat-label">器材健康率</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.inspection.total}</div>
                <div class="stat-label">本月点检</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.inspection.passRate}%</div>
                <div class="stat-label">点检合格率</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.issue.pending}</div>
                <div class="stat-label">待处理隐患</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.issue.resolveRate}%</div>
                <div class="stat-label">隐患处理率</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>器材状态统计</h2>
        <table>
            <thead>
                <tr><th>状态</th><th>数量</th><th>占比</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>正常</td>
                    <td>${reportData.summary.equipment.normal}</td>
                    <td>${((reportData.summary.equipment.normal / reportData.summary.equipment.total) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td>异常</td>
                    <td>${reportData.summary.equipment.abnormal}</td>
                    <td>${((reportData.summary.equipment.abnormal / reportData.summary.equipment.total) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td>即将过期</td>
                    <td>${reportData.summary.equipment.expiring || 0}</td>
                    <td>${(((reportData.summary.equipment.expiring || 0) / reportData.summary.equipment.total) * 100).toFixed(1)}%</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>器材类型点检排行</h2>
        <table>
            <thead>
                <tr><th>排名</th><th>器材类型</th><th>器材数量</th><th>点检次数</th></tr>
            </thead>
            <tbody>
                ${reportData.rankings.equipmentTypes.map((type, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${type.name}</td>
                    <td>${type.equipmentCount}</td>
                    <td>${type.inspectionCount}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>点检员绩效排行</h2>
        <table>
            <thead>
                <tr><th>排名</th><th>点检员</th><th>总点检数</th><th>正常点检</th><th>异常点检</th></tr>
            </thead>
            <tbody>
                ${reportData.rankings.inspectors.map((inspector, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${inspector.name}</td>
                    <td>${inspector.totalInspections}</td>
                    <td>${inspector.normalInspections}</td>
                    <td>${inspector.abnormalInspections}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>此报表由消防器材点检管理系统自动生成</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles() {
    try {
      const files = await fs.readdir(this.exportDir);
      const now = Date.now();
      const expireTime = 24 * 60 * 60 * 1000; // 24小时

      for (const file of files) {
        const filepath = path.join(this.exportDir, file);
        const stat = await fs.stat(filepath);
        
        if (now - stat.mtime.getTime() > expireTime) {
          await fs.unlink(filepath);
          console.log(`清理过期文件: ${file}`);
        }
      }
    } catch (error) {
      console.error('清理过期文件失败:', error);
    }
  }

  /**
   * 获取文件下载信息
   */
  getFileInfo(filename) {
    const filepath = path.join(this.exportDir, filename);
    return {
      filepath,
      downloadUrl: `/api/reports/download/${encodeURIComponent(filename)}`
    };
  }
}

module.exports = ReportExportService;
