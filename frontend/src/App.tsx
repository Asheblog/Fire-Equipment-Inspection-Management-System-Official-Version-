import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute'
import { MobileRedirectRoute } from '@/components/MobileRedirectRoute'
import { AppLayout } from '@/components/layout'
import { LoginPage } from '@/pages/LoginPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { DebugPage } from '@/pages/DebugPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { EquipmentsPage } from '@/pages/EquipmentsPage'
import { EquipmentTypesPage } from '@/pages/EquipmentTypesPage'
import { IssuePage } from '@/pages/IssuePage'
import { InspectionRecordsPage } from '@/pages/InspectionRecordsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UserManagementPage } from '@/pages/UserManagementPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SystemSettingsPage } from '@/pages/SystemSettingsPage'
import MyIssuesPage from '@/pages/MyIssuesPage'
import { MobileDashboard } from '@/pages/mobile/MobileDashboard'
import { MobileInspectionPage } from '@/pages/mobile/MobileInspectionPage'
import { MobileInspectionSuccessPage } from '@/pages/mobile/MobileInspectionSuccessPage'
import { MobileInspectionRecordsPage } from '@/pages/mobile/MobileInspectionRecordsPage'
import { UserRole } from '@/types'

function App() {
  return (
    <Router>
      <Routes>
        {/* 公开路由 */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        
        {/* Debug路由 */}
        <Route path="/debug" element={<DebugPage />} />

        {/* 移动端路由 - 不使用AppLayout */}
        <Route 
          path="/m/dashboard" 
          element={
            <ProtectedRoute>
              <MobileDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/m/inspection/:qrCode" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.INSPECTOR, UserRole.FACTORY_ADMIN, UserRole.SUPER_ADMIN]}>
              <MobileInspectionPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/m/inspection-success" 
          element={
            <ProtectedRoute>
              <MobileInspectionSuccessPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/m/inspections" 
          element={
            <ProtectedRoute>
              <MobileInspectionRecordsPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/m/issues" 
          element={
            <ProtectedRoute>
              <MyIssuesPage />
            </ProtectedRoute>
          } 
        />

        {/* PC管理端路由 - 使用AppLayout */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.FACTORY_ADMIN, UserRole.SUPER_ADMIN]}>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/equipments" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.FACTORY_ADMIN, UserRole.SUPER_ADMIN]}>
              <AppLayout>
                <EquipmentsPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/equipment-types" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.FACTORY_ADMIN, UserRole.SUPER_ADMIN]}>
              <AppLayout>
                <EquipmentTypesPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/inspections" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <InspectionRecordsPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/issues" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <IssuePage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/users" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
              <AppLayout>
                <UserManagementPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/reports" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.FACTORY_ADMIN, UserRole.SUPER_ADMIN]}>
              <AppLayout>
                <ReportsPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        {/* 个人资料页面 */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProfilePage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        {/* 系统设置页面 - 仅超级管理员可访问 */}
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
              <AppLayout>
                <SystemSettingsPage />
              </AppLayout>
            </ProtectedRoute>
          } 
        />

        {/* 默认重定向 - 智能设备检测 */}
        <Route 
          path="/" 
          element={<MobileRedirectRoute />} 
        />
        
        {/* 404处理 */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">页面未找到</h1>
                <p className="text-muted-foreground">您访问的页面不存在</p>
              </div>
            </div>
          } 
        />
      </Routes>
    </Router>
  )
}

export default App
