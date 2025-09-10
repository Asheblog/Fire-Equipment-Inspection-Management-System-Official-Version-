import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createLogger } from '@/lib/logger';
import { issueApi } from '@/api';
import { useUploadPhoto } from '@/hooks/useUploadPhoto';
import MultiCameraCapture from '@/components/MultiCameraCapture';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { 
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Info,
  MapPin,
  Calendar
} from 'lucide-react';
import type { Issue } from '@/types';

const MIN_SOLUTION_LEN = 5;

const MobileIssueHandlePage: React.FC = () => {
  const log = createLogger('MobileIssueHandle');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const [issue, setIssue] = useState<Issue | null>(null);
  const [solution, setSolution] = useState('');
  const [fixedImages, setFixedImages] = useState<string[]>([]);
  const { upload } = useUploadPhoto();

  const canSubmit = useMemo(() => {
    return (
      !submitting &&
      solution.trim().length >= MIN_SOLUTION_LEN &&
      fixedImages.length > 0 &&
      issue?.status === 'PENDING'
    );
  }, [solution, fixedImages, submitting, issue?.status]);

  const load = async () => {
    if (!id) {
      setError('参数错误：缺少隐患ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await issueApi.getById(Number(id));
      if (res.success) {
        setIssue(res.data as any);
      } else {
        setError(res.message || '加载隐患详情失败');
      }
    } catch (e: any) {
      log.error('加载隐患详情失败', e);
      setError(e?.response?.data?.message || '加载隐患详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async () => {
    if (!issue) return;
    try {
      setSubmitting(true);
      setError('');
      // 同时传多图与首图，兼容后端新旧字段校验与存储
      const payload: any = {
        solution: solution.trim(),
        fixedImageUrls: fixedImages,
        fixedImageUrl: fixedImages[0] || ''
      };
      const res = await issueApi.handle(issue.id, payload);
      if (res.success) {
        // 成功后返回管理列表
        navigate('/m/issue-manage', { replace: true });
      } else {
        setError(res.message || '整改提交失败');
      }
    } catch (e: any) {
      log.error('整改提交失败', e);
      setError(e?.response?.data?.message || '整改提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer variant="mobile">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="mt-2 text-muted-foreground text-sm">加载中...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error && !issue) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/m/issue-manage')}
              title="返回"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-3 text-lg font-semibold">隐患整改</h1>
          </div>
        </header>

        <PageContainer variant="mobile">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">{error}</div>
              <Button className="mt-4" onClick={() => navigate('/m/issue-manage')}>返回列表</Button>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/m/issue-manage')}
            title="返回"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-3 text-lg font-semibold">
            隐患整改 {issue?.status && <Badge variant="secondary" className="ml-2">{issue.status}</Badge>}
          </h1>
        </div>
      </header>

      <PageContainer variant="mobile" className="space-y-4">
        {/* 隐患概要 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              隐患信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">#{issue?.id} {issue?.equipment?.name || ''}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{issue?.equipment?.location || '未知位置'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{issue ? new Date(issue.createdAt).toLocaleString('zh-CN') : ''}</span>
              </div>
            </div>
            <div className="text-sm text-gray-800">
              {issue?.description}
            </div>
            {issue?.issueImageUrl && (
              <div className="mt-2">
                <AuthenticatedImage
                  src={issue.issueImageUrl}
                  alt="隐患图片"
                  className="w-24 h-24 object-cover rounded border"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 整改表单 */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              整改提交
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                整改内容 <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder={`请填写整改说明（不少于${MIN_SOLUTION_LEN}个字符）`}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="bg-white min-h-[80px]"
              />
              {solution.trim().length > 0 && solution.trim().length < MIN_SOLUTION_LEN && (
                <div className="mt-1 text-xs text-red-600">
                  整改内容至少 {MIN_SOLUTION_LEN} 个字符
                </div>
              )}
            </div>

            <div>
              <MultiCameraCapture
                title="整改照片(拍照)"
                max={9}
                initial={fixedImages}
                upload={async (file) => {
                  const res: any = await upload(file);
                  return { fileUrl: res?.data?.fileUrl || res?.fileUrl, fileName: res?.data?.fileName };
                }}
                onChange={setFixedImages}
                description="请拍摄整改完成后的现场照片，至少1张"
                required
              />
              {fixedImages.length === 0 && (
                <div className="mt-1 text-xs text-red-600">
                  请至少上传一张整改照片
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 提交 */}
        <div className="pb-4">
          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? '提交中...' : '提交整改'}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              请填写不少于 {MIN_SOLUTION_LEN} 个字符的整改内容，并至少上传一张整改照片
            </p>
          )}
        </div>
      </PageContainer>
    </div>
  );
};

export default MobileIssueHandlePage;
