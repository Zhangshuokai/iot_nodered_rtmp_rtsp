import { PrismaClient } from '@prisma/client';

/**
 * 定义全局变量类型，用于存储Prisma客户端实例
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * PrismaClientSingleton类
 * 实现Prisma客户端的单例模式，确保应用中只有一个Prisma实例
 */
class PrismaClientSingleton {
  private static instance: PrismaClient;

  /**
   * 获取Prisma客户端实例
   * 如果实例不存在则创建新实例
   * @returns PrismaClient实例
   */
  public static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      // 创建新的Prisma客户端实例
      PrismaClientSingleton.instance = new PrismaClient({
        // 配置日志级别，可根据环境变量调整
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'error', 'warn'] 
          : ['error'],
      });

      // 添加中间件用于日志记录和性能监控
      if (process.env.NODE_ENV === 'development') {
        PrismaClientSingleton.instance.$use(async (params: any, next: any) => {
          const before = Date.now();
          const result = await next(params);
          const after = Date.now();
          console.log(`查询 ${params.model}.${params.action} 耗时: ${after - before}ms`);
          return result;
        });
      }

      // 连接数据库并处理连接错误
      PrismaClientSingleton.instance.$connect()
        .then(() => {
          console.log('数据库连接成功');
        })
        .catch((error: Error) => {
          console.error('数据库连接失败:', error);
          process.exit(1); // 连接失败时终止应用
        });
    }
    return PrismaClientSingleton.instance;
  }

  /**
   * 关闭Prisma客户端连接
   * 通常在应用关闭时调用
   */
  public static async disconnect(): Promise<void> {
    if (PrismaClientSingleton.instance) {
      await PrismaClientSingleton.instance.$disconnect();
      console.log('数据库连接已关闭');
    }
  }
}

/**
 * 导出prisma客户端实例
 * 在开发环境中使用全局变量以防止热重载创建多个连接
 * 在生产环境中直接使用单例实例
 */
const prisma = globalThis.prisma || (globalThis.prisma = PrismaClientSingleton.getInstance());

/**
 * 导出用于应用关闭时断开数据库连接的函数
 */
export const disconnectPrisma = PrismaClientSingleton.disconnect;

export default prisma; 