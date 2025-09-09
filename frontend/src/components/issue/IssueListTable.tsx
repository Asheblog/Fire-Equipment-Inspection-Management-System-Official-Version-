import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import type { Issue } from '@/types'
import { formatQrCodeDisplay } from '@/utils/qrCode'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { useImagePreview } from '@/components/image-preview/ImagePreviewContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export interface IssueListTableProps {
  issues: Issue[]
  userRole?: string
  onView: (issue: Issue) => void
  onHandle: (issue: Issue) => void
  onAudit: (issue: Issue) => void
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">待处理</Badge>
    case 'PENDING_AUDIT':
      return <Badge variant="secondary">待审核</Badge>
    case 'CLOSED':
      return <Badge variant="success">已关闭</Badge>
    case 'REJECTED':
      return <Badge variant="destructive">已驳回</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="outline">处理中</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export const IssueListTable: React.FC<IssueListTableProps> = ({ issues, userRole, onView, onHandle, onAudit }) => {
  const { open: openPreview } = useImagePreview()

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px] text-center whitespace-nowrap">状态</TableHead>
            <TableHead className="text-center">器材</TableHead>
            <TableHead className="text-center">位置</TableHead>
            <TableHead className="text-center w-[80px]">隐患图</TableHead>
            <TableHead className="text-center w-[80px]">整改图</TableHead>
            <TableHead className="text-center">描述</TableHead>
            <TableHead className="text-center">上报</TableHead>
            <TableHead className="text-center">处理</TableHead>
            <TableHead className="w-[84px] text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => {
            const canHandle = (userRole !== 'INSPECTOR') && issue.status === 'PENDING'
            const canAudit = (userRole === 'SUPER_ADMIN') && issue.status === 'PENDING_AUDIT'
            const allIssueImgs = (issue.issueImages && issue.issueImages.length ? issue.issueImages : (issue.issueImageUrl ? [issue.issueImageUrl] : [])).filter(Boolean)
            const allFixedImgs = (issue.fixedImages && issue.fixedImages.length ? issue.fixedImages : (issue.fixedImageUrl ? [issue.fixedImageUrl] : [])).filter(Boolean)
            const issueThumbs = allIssueImgs.slice(0, 1)
            const fixedThumbs = allFixedImgs.slice(0, 1)
            return (
              <TableRow key={issue.id}>
                <TableCell className="text-center align-middle whitespace-nowrap">
                  <StatusBadge status={issue.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-center align-middle">
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight">{issue.equipment?.name || '-'}</span>
                    <span className="text-xs text-muted-foreground">编号: {formatQrCodeDisplay(issue.equipment?.qrCode)}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-center align-middle">
                  <span title={issue.equipment?.location}>{issue.equipment?.location || '-'}</span>
                </TableCell>
                <TableCell className="text-center align-middle">
                  {issueThumbs && issueThumbs.length ? (
                    <div className="flex items-center justify-center gap-2">
                      {issueThumbs.map((img, idx) => (
                        <AuthenticatedImage
                          key={idx}
                          src={img}
                          alt={`隐患图${idx + 1}`}
                          className="w-14 h-14 object-cover rounded border cursor-pointer"
                          enableZoom={true}
                          priority={idx === 0}
                          onOpenPreview={() => openPreview(allIssueImgs.length ? allIssueImgs : issueThumbs, 0)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded border bg-muted/40 inline-flex items-center justify-center text-xs text-muted-foreground">无</div>
                  )}
                </TableCell>
                <TableCell className="text-center align-middle">
                  {fixedThumbs && fixedThumbs.length ? (
                    <div className="flex items-center justify-center gap-2">
                      {fixedThumbs.map((img, idx) => (
                        <AuthenticatedImage
                          key={idx}
                          src={img}
                          alt={`整改图${idx + 1}`}
                          className="w-14 h-14 object-cover rounded border cursor-pointer"
                          enableZoom={true}
                          priority={idx === 0}
                          onOpenPreview={() => openPreview(allFixedImgs.length ? allFixedImgs : fixedThumbs, 0)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded border bg-muted/40 inline-flex items-center justify-center text-xs text-muted-foreground">无</div>
                  )}
                </TableCell>
                <TableCell className="max-w-[360px] text-center align-middle">
                  <p className="text-sm text-muted-foreground line-clamp-1" title={issue.description}>{issue.description}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-center align-middle">
                  <div className="flex flex-col">
                    <span className="text-sm">{issue.reporter?.fullName || '-'}</span>
                    <span className="text-xs text-muted-foreground">{new Date(issue.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-center align-middle">
                  {issue.handler ? (
                    <div className="flex flex-col">
                      <span className="text-sm">{issue.handler.fullName}</span>
                      <span className="text-xs text-muted-foreground">{issue.handledAt ? new Date(issue.handledAt).toLocaleString('zh-CN') : '-'}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">未处理</span>
                  )}
                </TableCell>
                <TableCell className="text-center align-middle">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="px-2">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(issue)}>
                        查看
                      </DropdownMenuItem>
                      {canHandle && (
                        <DropdownMenuItem onClick={() => onHandle(issue)}>
                          处理
                        </DropdownMenuItem>
                      )}
                      {canAudit && (
                        <DropdownMenuItem onClick={() => onAudit(issue)}>
                          审核
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
          {issues.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">暂无隐患记录</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 悬停放大已移除，点击走全局预览组件 */}
    </div>
  )
}

export default IssueListTable
