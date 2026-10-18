/**
 * 文件读写的最小抽象。Editor 只依赖这个接口，所以测试可以换成内存实现，不碰真实磁盘。
 * 实现应在失败时抛出 FileReadError / FileWriteError。
 */
export interface FileSystem {
  readText(path: string): string;
  writeText(path: string, content: string): void;
}
