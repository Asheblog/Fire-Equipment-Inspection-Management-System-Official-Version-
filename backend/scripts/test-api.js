/**
 * 消防器材点检系统 - API测试脚本
 * 测试主要API端点的功能
 */

const axios = require('axios');

class APITester {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = null;
    this.refreshToken = null;
    this.userId = null;
  }

  /**
   * 执行API测试
   */
  async runTests() {
    console.log('🚀 开始API功能测试...\n');

    try {
      // 1. 测试系统状态
      await this.testSystemHealth();
      
      // 2. 测试用户认证
      await this.testAuthentication();
      
      // 3. 测试器材管理
      await this.testEquipmentManagement();
      
      // 4. 测试点检功能
      await this.testInspectionManagement();
      
      // 5. 测试隐患管理
      await this.testIssueManagement();
      
      // 6. 测试报表功能
      await this.testReportingSystem();
      
      console.log('✅ 所有API测试完成！');
      
    } catch (error) {
      console.error('❌ API测试失败:', error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', error.response.data);
      }
    }
  }

  /**
   * 测试系统健康状态
   */
  async testSystemHealth() {
    console.log('📊 测试系统健康状态...');
    
    const response = await axios.get(`${this.baseURL}/api/health`);
    console.log('✅ 系统健康检查通过');
    console.log('响应:', response.data);
    console.log();
  }

  /**
   * 测试用户认证
   */
  async testAuthentication() {
    console.log('🔐 测试用户认证...');
    
    try {
      // 尝试登录默认测试账户
      const loginResponse = await axios.post(`${this.baseURL}/api/auth/login`, {
        username: 'admin',
        password: 'Test123!@#'
      });
      
      this.token = loginResponse.data.accessToken;
      this.refreshToken = loginResponse.data.refreshToken;
      this.userId = loginResponse.data.user.id;
      
      console.log('✅ 登录成功');
      console.log('用户信息:', loginResponse.data.user);
      
      // 测试获取用户信息
      const profileResponse = await this.authenticatedRequest('GET', '/api/auth/profile');
      console.log('✅ 获取用户信息成功');
      console.log('用户详情:', profileResponse.data);
      
    } catch (error) {
      console.log('⚠️  默认账户不存在，跳过认证测试');
      console.log('请确保已运行数据库种子文件创建测试账户');
    }
    
    console.log();
  }

  /**
   * 测试器材管理
   */
  async testEquipmentManagement() {
    console.log('🔧 测试器材管理...');
    
    if (!this.token) {
      console.log('⚠️  未登录，跳过器材管理测试');
      console.log();
      return;
    }
    
    try {
      // 获取器材类型
      const typesResponse = await this.authenticatedRequest('GET', '/api/equipments/types');
      console.log('✅ 获取器材类型成功');
      console.log('器材类型数量:', typesResponse.data.length);
      
      // 获取器材列表
      const equipmentsResponse = await this.authenticatedRequest('GET', '/api/equipments?page=1&limit=5');
      console.log('✅ 获取器材列表成功');
      console.log('器材数量:', equipmentsResponse.meta?.pagination?.total || 0);
      
      // 获取器材统计
      const statsResponse = await this.authenticatedRequest('GET', '/api/equipments/stats');
      console.log('✅ 获取器材统计成功');
      console.log('器材统计:', statsResponse.data);
      
    } catch (error) {
      console.log('❌ 器材管理测试失败:', error.response?.data?.message || error.message);
    }
    
    console.log();
  }

  /**
   * 测试点检管理
   */
  async testInspectionManagement() {
    console.log('📋 测试点检管理...');
    
    if (!this.token) {
      console.log('⚠️  未登录，跳过点检管理测试');
      console.log();
      return;
    }
    
    try {
      // 获取点检记录列表
      const inspectionsResponse = await this.authenticatedRequest('GET', '/api/inspections?page=1&limit=5');
      console.log('✅ 获取点检记录成功');
      console.log('点检记录数量:', inspectionsResponse.meta?.pagination?.total || 0);
      
      // 获取点检统计
      const statsResponse = await this.authenticatedRequest('GET', '/api/inspections/stats');
      console.log('✅ 获取点检统计成功');
      console.log('点检统计:', statsResponse.data);
      
      // 获取待点检器材
      const pendingResponse = await this.authenticatedRequest('GET', '/api/inspections/pending');
      console.log('✅ 获取待点检器材成功');
      console.log('待点检器材数量:', pendingResponse.data?.length || 0);
      
    } catch (error) {
      console.log('❌ 点检管理测试失败:', error.response?.data?.message || error.message);
    }
    
    console.log();
  }

  /**
   * 测试隐患管理
   */
  async testIssueManagement() {
    console.log('⚠️  测试隐患管理...');
    
    if (!this.token) {
      console.log('⚠️  未登录，跳过隐患管理测试');
      console.log();
      return;
    }
    
    try {
      // 获取隐患列表
      const issuesResponse = await this.authenticatedRequest('GET', '/api/issues?page=1&limit=5');
      console.log('✅ 获取隐患列表成功');
      console.log('隐患数量:', issuesResponse.meta?.pagination?.total || 0);
      
      // 获取隐患统计
      const statsResponse = await this.authenticatedRequest('GET', '/api/issues/stats');
      console.log('✅ 获取隐患统计成功');
      console.log('隐患统计:', statsResponse.data);
      
    } catch (error) {
      console.log('❌ 隐患管理测试失败:', error.response?.data?.message || error.message);
    }
    
    console.log();
  }

  /**
   * 测试报表系统
   */
  async testReportingSystem() {
    console.log('📊 测试报表系统...');
    
    if (!this.token) {
      console.log('⚠️  未登录，跳过报表系统测试');
      console.log();
      return;
    }
    
    try {
      // 获取数据看板
      const dashboardResponse = await this.authenticatedRequest('GET', '/api/reports/dashboard');
      console.log('✅ 获取数据看板成功');
      console.log('看板数据结构:', Object.keys(dashboardResponse.data));
      
      // 获取月度报表
      const currentDate = new Date();
      const monthlyResponse = await this.authenticatedRequest('GET', 
        `/api/reports/monthly?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
      console.log('✅ 获取月度报表成功');
      console.log('报表数据结构:', Object.keys(monthlyResponse.data));
      
      // 获取最近活动
      const activityResponse = await this.authenticatedRequest('GET', '/api/reports/recent-activity?limit=5');
      console.log('✅ 获取最近活动成功');
      console.log('活动记录数量:', activityResponse.data?.length || 0);
      
    } catch (error) {
      console.log('❌ 报表系统测试失败:', error.response?.data?.message || error.message);
    }
    
    console.log();
  }

  /**
   * 发送认证请求
   */
  async authenticatedRequest(method, url, data = null) {
    const config = {
      method,
      url: `${this.baseURL}${url}`,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  }
}

// 执行测试
if (require.main === module) {
  const tester = new APITester();
  tester.runTests().catch(console.error);
}

module.exports = APITester;