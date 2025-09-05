import { useAuthStore } from '@/stores/auth'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'

export function DebugPage() {
  const authState = useAuthStore()
  
  return (
    <PageContainer>
      <PageHeader title="Debug页面" />
      
      <ContentSection>
        <div>
          <h2 className="text-lg font-semibold">认证状态</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify({
              isAuthenticated: authState.isAuthenticated,
              user: authState.user,
              factory: authState.factory,
              hasToken: !!authState.token
            }, null, 2)}
          </pre>
        </div>
        
        <button 
          onClick={() => {
            // 模拟登录
            const user = {
              id: 35,
              username: 'admin',
              fullName: '系统管理员',
              role: 'SUPER_ADMIN' as any,
              factoryId: 18,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            const factory = {
              id: 18,
              name: 'A厂区',
              address: '测试地址',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjM1LCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiZmFjdG9yeUlkIjoxOCwicGVybWlzc2lvbnMiOlsiKjoqIiwiZmFjdG9yeToqIiwidXNlcjoqIiwic3lzdGVtOmNvbmZpZyIsImF1ZGl0OnJlYWQiLCJyZXBvcnQ6cmVhZDpnbG9iYWwiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc1NjI2NTkyNiwianRpIjoiNDA0YTkwYzJjY2QwNmE0OGYyNTNiNzYwMjZlZjEyNGQiLCJleHAiOjE3NTYzNTIzMjYsImF1ZCI6ImZpcmUtc2FmZXR5LWNsaWVudCIsImlzcyI6ImZpcmUtc2FmZXR5LXN5c3RlbSJ9.t_fIbAwmCSBGqWHcai0GLYchxa_Qy_xN-nViUEjIQaQ'
            
            authState.login(user, factory, token, 'refresh-token')
            console.log('手动登录完成')
            window.location.href = '/inspections'
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          模拟登录
        </button>
        
        <button 
          onClick={() => {
            authState.logout()
            console.log('已登出')
          }}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ml-2"
        >
          登出
        </button>
      </ContentSection>
    </PageContainer>
  )
}