/**
 * 消防器材点检系统 - 邮件服务
 * 负责发送各种类型的邮件通知
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  /**
   * 设置邮件传输器
   */
  setupTransporter() {
    try {
      // 邮件配置 - 可通过环境变量配置
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.qq.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || '', // 发送方邮箱
          pass: process.env.SMTP_PASS || '', // 邮箱密码或应用专用密码
        },
        tls: {
          rejectUnauthorized: false // 开发环境可设为false
        }
      };

      // 如果没有配置邮件信息，创建测试账户
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        console.warn('邮件服务未配置，将使用模拟模式');
        this.transporter = nodemailer.createTransporter({
          streamTransport: true,
          newline: 'unix',
          buffer: true
        });
        return;
      }

      this.transporter = nodemailer.createTransporter(emailConfig);

      // 验证邮件配置
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('邮件服务配置错误:', error);
        } else {
          console.log('邮件服务配置成功');
        }
      });
    } catch (error) {
      console.error('邮件服务初始化失败:', error);
    }
  }

  /**
   * 发送邮件的通用方法
   * @param {Object} mailOptions - 邮件选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendEmail(mailOptions) {
    try {
      if (!this.transporter) {
        throw new Error('邮件服务未初始化');
      }

      const defaultOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER || '"消防器材点检系统" <system@fire-safety.com>',
      };

      const finalOptions = { ...defaultOptions, ...mailOptions };

      const result = await this.transporter.sendMail(finalOptions);
      
      console.log('邮件发送成功:', {
        messageId: result.messageId,
        to: finalOptions.to,
        subject: finalOptions.subject
      });

      return {
        success: true,
        messageId: result.messageId,
        message: '邮件发送成功'
      };
    } catch (error) {
      console.error('邮件发送失败:', error);
      return {
        success: false,
        error: error.message,
        message: '邮件发送失败'
      };
    }
  }

  /**
   * 发送安全告警邮件
   * @param {Object} securityEvent - 安全事件
   * @param {Array} recipients - 收件人列表
   */
  async sendSecurityAlert(securityEvent, recipients = []) {
    try {
      if (!recipients.length) {
        recipients = this.getDefaultAlertRecipients();
      }

      const { eventType, severity, description, userId, userRole, ipAddress, userAgent, timestamp } = securityEvent;

      const severityMap = {
        LOW: { color: '#28a745', text: '低风险' },
        MEDIUM: { color: '#ffc107', text: '中风险' },
        HIGH: { color: '#fd7e14', text: '高风险' },
        CRITICAL: { color: '#dc3545', text: '严重' }
      };

      const severityInfo = severityMap[severity] || severityMap.MEDIUM;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>安全告警通知</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${severityInfo.color}; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .alert-info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .severity { font-weight: bold; color: ${severityInfo.color}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚨 消防器材点检系统 - 安全告警</h2>
            </div>
            <div class="content">
              <div class="alert-info">
                <h3>安全事件详情</h3>
                <p><strong>事件类型:</strong> ${eventType}</p>
                <p><strong>严重程度:</strong> <span class="severity">${severityInfo.text}</span></p>
                <p><strong>事件描述:</strong> ${description}</p>
                <p><strong>发生时间:</strong> ${new Date(timestamp).toLocaleString('zh-CN')}</p>
              </div>
              
              ${userId ? `
              <div class="alert-info">
                <h3>用户信息</h3>
                <p><strong>用户ID:</strong> ${userId}</p>
                <p><strong>用户角色:</strong> ${userRole || '未知'}</p>
              </div>
              ` : ''}
              
              <div class="alert-info">
                <h3>网络信息</h3>
                <p><strong>IP地址:</strong> ${ipAddress || '未知'}</p>
                <p><strong>User-Agent:</strong> ${userAgent || '未知'}</p>
              </div>
              
              <div class="alert-info" style="background: #fff3cd; border: 1px solid #ffeaa7;">
                <h3>⚠️ 处理建议</h3>
                <ul>
                  <li>请立即检查相关用户账户状态</li>
                  <li>检查是否存在异常登录行为</li>
                  <li>必要时暂时禁用相关账户</li>
                  <li>检查系统日志以获取更多信息</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <p>此邮件由消防器材点检系统自动发送，请勿回复</p>
              <p>系统时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
        消防器材点检系统 - 安全告警
        
        事件类型: ${eventType}
        严重程度: ${severityInfo.text}
        事件描述: ${description}
        发生时间: ${new Date(timestamp).toLocaleString('zh-CN')}
        
        ${userId ? `用户ID: ${userId}\n用户角色: ${userRole || '未知'}\n` : ''}
        IP地址: ${ipAddress || '未知'}
        User-Agent: ${userAgent || '未知'}
        
        请立即处理此安全事件。
        
        此邮件由系统自动发送，请勿回复。
      `;

      const mailOptions = {
        to: recipients.join(', '),
        subject: `🚨 安全告警 - ${eventType} (${severityInfo.text})`,
        text: textContent,
        html: htmlContent,
        priority: severity === 'CRITICAL' ? 'high' : 'normal'
      };

      return await this.sendEmail(mailOptions);
    } catch (error) {
      console.error('发送安全告警邮件失败:', error);
      return {
        success: false,
        error: error.message,
        message: '发送安全告警邮件失败'
      };
    }
  }

  /**
   * 发送系统错误告警邮件
   * @param {Object} errorEvent - 错误事件
   * @param {Array} recipients - 收件人列表
   */
  async sendErrorAlert(errorEvent, recipients = []) {
    try {
      if (!recipients.length) {
        recipients = this.getDefaultAlertRecipients();
      }

      const { errorType, severity, message, endpoint, method, stackTrace, timestamp } = errorEvent;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>系统错误告警</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .error-info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .stack-trace { background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px; overflow-x: auto; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>❌ 消防器材点检系统 - 系统错误告警</h2>
            </div>
            <div class="content">
              <div class="error-info">
                <h3>错误详情</h3>
                <p><strong>错误类型:</strong> ${errorType}</p>
                <p><strong>严重程度:</strong> ${severity}</p>
                <p><strong>错误消息:</strong> ${message}</p>
                <p><strong>发生时间:</strong> ${new Date(timestamp).toLocaleString('zh-CN')}</p>
              </div>
              
              ${endpoint ? `
              <div class="error-info">
                <h3>请求信息</h3>
                <p><strong>端点:</strong> ${method} ${endpoint}</p>
              </div>
              ` : ''}
              
              ${stackTrace ? `
              <div class="error-info">
                <h3>堆栈跟踪</h3>
                <div class="stack-trace">${stackTrace.replace(/\n/g, '<br>')}</div>
              </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>此邮件由消防器材点检系统自动发送，请勿回复</p>
              <p>系统时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        to: recipients.join(', '),
        subject: `❌ 系统错误告警 - ${errorType}`,
        html: htmlContent,
        priority: severity === 'FATAL' ? 'high' : 'normal'
      };

      return await this.sendEmail(mailOptions);
    } catch (error) {
      console.error('发送系统错误告警邮件失败:', error);
      return {
        success: false,
        error: error.message,
        message: '发送系统错误告警邮件失败'
      };
    }
  }

  /**
   * 发送隐患处理通知邮件
   * @param {Object} issueEvent - 隐患事件
   * @param {Array} recipients - 收件人列表
   */
  async sendIssueNotification(issueEvent, recipients = []) {
    try {
      const { issue, action, user } = issueEvent;

      const actionTexts = {
        'CREATED': '发现新隐患',
        'HANDLED': '隐患已处理',
        'AUDITED': '隐患已审核',
        'CLOSED': '隐患已关闭'
      };

      const actionText = actionTexts[action] || '隐患状态更新';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>隐患处理通知</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #17a2b8; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .issue-info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔧 消防器材点检系统 - ${actionText}</h2>
            </div>
            <div class="content">
              <div class="issue-info">
                <h3>隐患信息</h3>
                <p><strong>隐患ID:</strong> ${issue.id}</p>
                <p><strong>设备名称:</strong> ${issue.equipment?.name || '未知'}</p>
                <p><strong>隐患描述:</strong> ${issue.description}</p>
                <p><strong>当前状态:</strong> ${issue.status}</p>
                <p><strong>更新时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
              </div>
              
              <div class="issue-info">
                <h3>操作信息</h3>
                <p><strong>操作类型:</strong> ${actionText}</p>
                <p><strong>操作人员:</strong> ${user.fullName} (${user.username})</p>
              </div>
            </div>
            
            <div class="footer">
              <p>此邮件由消防器材点检系统自动发送，请勿回复</p>
              <p>系统时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        to: recipients.join(', '),
        subject: `🔧 ${actionText} - 设备: ${issue.equipment?.name || '未知'}`,
        html: htmlContent
      };

      return await this.sendEmail(mailOptions);
    } catch (error) {
      console.error('发送隐患通知邮件失败:', error);
      return {
        success: false,
        error: error.message,
        message: '发送隐患通知邮件失败'
      };
    }
  }

  /**
   * 获取默认告警收件人
   * @returns {Array} 收件人邮箱列表
   */
  getDefaultAlertRecipients() {
    const defaultRecipients = process.env.ALERT_RECIPIENTS || '';
    if (defaultRecipients) {
      return defaultRecipients.split(',').map(email => email.trim());
    }
    
    // 如果没有配置，返回空数组（实际部署时应该配置）
    console.warn('未配置默认告警邮箱，请设置 ALERT_RECIPIENTS 环境变量');
    return [];
  }

  /**
   * 测试邮件发送
   * @param {string} testEmail - 测试邮箱
   */
  async sendTestEmail(testEmail) {
    try {
      const mailOptions = {
        to: testEmail,
        subject: '消防器材点检系统 - 邮件服务测试',
        text: '这是一封测试邮件，如果您收到此邮件，说明邮件服务配置正确。',
        html: `
          <h2>消防器材点检系统</h2>
          <p>这是一封测试邮件，如果您收到此邮件，说明邮件服务配置正确。</p>
          <p><strong>测试时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
        `
      };

      return await this.sendEmail(mailOptions);
    } catch (error) {
      console.error('发送测试邮件失败:', error);
      return {
        success: false,
        error: error.message,
        message: '发送测试邮件失败'
      };
    }
  }
}

module.exports = EmailService;