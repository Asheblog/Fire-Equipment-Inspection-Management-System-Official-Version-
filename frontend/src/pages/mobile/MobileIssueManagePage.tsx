import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLogger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth';
import { issueApi } from '@/api';
import type { Issue } from '@/types';

import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle,
  MapPin,
  Search
} from 'lucide-react';

const statusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return <Badge variant="outline" className="text-orange-600 border-orange-300">待处理</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="outline" className="text-blue-600 border-blue-300">处理中</Badge>;
    case 'PENDING_AUDIT':
      return <Badge variant="outline" className="text-purple-600 border-purple-300">待审核</Badge>;
    case 'CLOSED':
      return <Badge variant="outline" className="text-green-600 border-green-300">已关闭</Badge>;
    case 'REJECTED':
      return <Badge variant="outline" className="text-red-600 border-red-300">已拒绝</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const MobileIssueManagePage: React.FC = () => {
  const log = createLogger('MobileIssueManage');
  const navigate = useNavigate();
  const { factories, factory } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const factoryIdParams = useMemo(() => {
    // 优先使用多厂区ID集合
    const ids = (factories || []).map((f: any) => f.id).filter(Boolean);
    if (ids.length > 0) return ids;
    if (factory?.id) return [factory.id];
    return undefined;
  }, [factories, factory]);

  const canHandle = (status: string) => {
    // 现在允许 INSPECTOR 整改，只要是待处理即可
    return status === 'PENDING';
  };

  const load = async (pageNo = 1, keyword = '') => {
    setLoading(true);
    try {
      const params: any = {
        page: pageNo,
        limit: 20,
        status: 'PENDING', // 仅列出“待处理”隐患用于整改
      };
      if (factoryIdParams) params.factoryIds = factoryIdParams;
      if (keyword && keyword.trim().length > 0) params.search = keyword.trim();

      log.debug('加载隐患(移动端-管理)：', params);
      const res = await issueApi.getList(params);
      if ((res as any)?.data?.items) {
        setIssues(res.data.items as Issue[]);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setIssues([]);
        setPage(1);
        setTotalPages(1);
      }
    } catch (e) {
      log.error('加载隐患失败', e);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(factoryIdParams)]);

  const handleSearch = () => {
    load(1, search);
  };

  const handleRectify = (issue: Issue) => {
    navigate(`/m/issues/${issue.id}/handle`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/m/dashboard')}
            title="返回"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-3 text-lg font-semibold">隐患管理（查看与整改）</h1>
        </div>
      </header>

      <PageContainer variant="mobile" className="space-y-4">
        {/* 搜索栏 */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索隐患描述、器材名称、位置或二维码..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch}>搜索</Button>
        </div>

        {/* 列表 */}
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="mt-2 text-gray-600 text-sm">加载中...</p>
            </CardContent>
          </Card>
        ) : issues.length === 0 ? (
          <Card className="text-center">
            <CardContent className="p-8">
              <AlertTriangle className="mx-auto h-10 w-10 text-gray-400" />
              <div className="mt-2 text-sm text-gray-600">暂无“待处理”的隐患</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <Card key={issue.id} className="border-l-4 border-l-orange-400">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-base font-medium">#{issue.id} {issue.equipment?.name || ''}</span>
                      {statusBadge(issue.status)}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-gray-700 line-clamp-2">
                    {issue.description}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{issue.equipment?.location || '未知位置'}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!canHandle(issue.status)}
                      onClick={() => handleRectify(issue)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      去整改
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 分页（简单型） */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 py-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => load(page - 1, search)}
            >
              上一页
            </Button>
            <span className="text-sm text-gray-600">第 {page} / {totalPages} 页</span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => load(page + 1, search)}
            >
              下一页
            </Button>
          </div>
        )}
      </PageContainer>
    </div>
  );
};

export default MobileIssueManagePage;
