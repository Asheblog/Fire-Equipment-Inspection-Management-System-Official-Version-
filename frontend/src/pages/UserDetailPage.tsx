import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createLogger } from '@/lib/logger'
import { userApi, factoryApi } from '@/api'
import type { User, Factory, UserRole } from '@/types'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// 角色标签若有需要再引入

export default function UserDetailPage() {
  const log = createLogger('UserDetail')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [factories, setFactories] = useState<Factory[]>([])

  // editable form
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('INSPECTOR')
  const [factoryIds, setFactoryIds] = useState<number[]>([])

  const load = async () => {
    try {
      setLoading(true)
      const [uRes, fRes] = await Promise.all([
        userApi.getById(Number(id)),
        factoryApi.getList()
      ])
      if (uRes.success && uRes.data) {
        setUser(uRes.data)
        setFullName(uRes.data.fullName)
        setRole(uRes.data.role)
        const list = (uRes.data.factoryIds && uRes.data.factoryIds.length > 0)
          ? uRes.data.factoryIds
          : (uRes.data.factoryId ? [uRes.data.factoryId] : [])
        setFactoryIds(list)
      }
      setFactories(fRes.data || [])
    } catch (e) {
      log.error('加载用户详情失败', e)
      toast.error('加载用户详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const toggleFactory = (fid: number, checked: boolean) => {
    setFactoryIds(prev => {
      const set = new Set(prev)
      if (checked) set.add(fid); else set.delete(fid)
      return Array.from(set)
    })
  }

  const save = async () => {
    if (!user) return
    if (!fullName || factoryIds.length === 0) {
      toast.error('请填写姓名并至少选择一个厂区')
      return
    }
    try {
      setSaving(true)
      await userApi.update(user.id, {
        fullName,
        role,
        factoryIds,
        factoryId: factoryIds[0]
      })
      toast.success('保存成功')
      await load()
    } catch (e: any) {
      log.error('保存失败', e)
      toast.error(e?.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="用户详情" description="查看与编辑用户的基础信息与厂区归属">
        <Button variant="outline" onClick={() => navigate('/users')}>返回</Button>
      </PageHeader>

      <ContentSection>
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !user ? (
              <div className="text-muted-foreground">加载中...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">用户名</div>
                  <div className="font-medium">{user.username}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">姓名</div>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="姓名" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">角色</div>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSPECTOR">点检员</SelectItem>
                      <SelectItem value="FACTORY_ADMIN">厂区管理员</SelectItem>
                      <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">状态</div>
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>{user.isActive ? '启用' : '禁用'}</Badge>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground mb-2">所属厂区（多选）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded">
                    {factories.map(f => (
                      <label key={f.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={factoryIds.includes(f.id)}
                          onChange={(e) => toggleFactory(f.id, e.target.checked)}
                        />
                        {f.name}
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">主厂区：{factoryIds.length > 0 ? factories.find(f => f.id === factoryIds[0])?.name || '—' : '—'}（默认取所选第一项）</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">当前归属</div>
                  <div className="flex flex-wrap gap-2">
                    {(user.factories && user.factories.length > 0 ? user.factories : (user.factory ? [user.factory] : [])).map(f => (
                      <Badge key={f.id} variant="secondary">{f.name}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex justify-end mt-4">
          <Button onClick={save} disabled={saving || loading}>{saving ? '保存中...' : '保存更改'}</Button>
        </div>
      </ContentSection>
    </PageContainer>
  )
}
