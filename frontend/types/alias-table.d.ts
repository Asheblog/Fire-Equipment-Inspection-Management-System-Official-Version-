// 兜底类型声明：解决 tsc -b 下偶发无法解析 '@/components/ui/table'
// 将其直接 re-export 为真实实现文件中的所有导出。
declare module "@/components/ui/table" {
  export * from "../src/components/ui/table";
}

