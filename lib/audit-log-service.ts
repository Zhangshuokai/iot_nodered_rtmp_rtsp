/**
 * 安全审计日志服务 - 记录系统中的安全事件
 * 
 * 该服务实现了以下功能：
 * 1. 用户认证事件记录
 * 2. 敏感操作审计
 * 3. 数据访问日志
 * 4. 系统配置变更记录
 * 5. 安全事件告警
 */

import prisma from './db-prisma';
import { User } from '@prisma/client';

/**
 * 审计事件类型
 */
export enum AuditEventType {
  // 认证事件
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  
  // 用户管理事件
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  USER_LOCK = 'user_lock',
  USER_UNLOCK = 'user_unlock',
  
  // 角色和权限事件
  ROLE_CREATE = 'role_create',
  ROLE_UPDATE = 'role_update',
  ROLE_DELETE = 'role_delete',
  PERMISSION_CHANGE = 'permission_change',
  
  // 组织事件
  ORG_CREATE = 'org_create',
  ORG_UPDATE = 'org_update',
  ORG_DELETE = 'org_delete',
  
  // 设备事件
  DEVICE_CREATE = 'device_create',
  DEVICE_UPDATE = 'device_update',
  DEVICE_DELETE = 'device_delete',
  DEVICE_ONLINE = 'device_online',
  DEVICE_OFFLINE = 'device_offline',
  
  // 数据访问事件
  DATA_READ = 'data_read',
  DATA_CREATE = 'data_create',
  DATA_UPDATE = 'data_update',
  DATA_DELETE = 'data_delete',
  DATA_EXPORT = 'data_export',
  
  // 系统配置事件
  CONFIG_CHANGE = 'config_change',
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  
  // 安全事件
  SECURITY_ALERT = 'security_alert',
  ACCESS_DENIED = 'access_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

/**
 * 审计日志级别
 */
export enum AuditLogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  userId?: string;
  username?: string;
  eventType: AuditEventType;
  level: AuditLogLevel;
  resourceType?: string;
  resourceId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

/**
 * 安全审计日志服务类
 */
export class AuditLogService {
  private static instance: AuditLogService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  /**
   * 记录审计日志
   * @param entry 审计日志条目
   */
  public async log(entry: AuditLogEntry): Promise<void> {
    try {
      // 设置默认时间戳
      if (!entry.timestamp) {
        entry.timestamp = new Date();
      }

      // 记录到数据库
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          username: entry.username,
          eventType: entry.eventType,
          level: entry.level,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          description: entry.description,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          details: entry.details ? JSON.stringify(entry.details) : undefined,
          timestamp: entry.timestamp
        }
      });

      // 对于关键安全事件，可以添加实时告警
      if (entry.level === AuditLogLevel.CRITICAL) {
        await this.triggerAlert(entry);
      }
    } catch (error) {
      console.error('Failed to log audit event:', error);
      
      // 如果数据库记录失败，至少保留控制台日志
      console.log('Audit Log Fallback:', {
        timestamp: entry.timestamp?.toISOString(),
        eventType: entry.eventType,
        level: entry.level,
        userId: entry.userId,
        description: entry.description,
        details: entry.details
      });
    }
  }

  /**
   * 记录认证事件
   * @param eventType 事件类型
   * @param user 用户对象
   * @param success 是否成功
   * @param ipAddress IP地址
   * @param userAgent 用户代理
   * @param details 详细信息
   */
  public async logAuthEvent(
    eventType: AuditEventType,
    user: User | null,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const level = success ? AuditLogLevel.INFO : AuditLogLevel.WARNING;
    const description = success 
      ? `认证成功: ${eventType}`
      : `认证失败: ${eventType}`;

    await this.log({
      userId: user?.id,
      username: user?.username,
      eventType,
      level,
      resourceType: 'auth',
      description,
      ipAddress,
      userAgent,
      details
    });
  }

  /**
   * 记录数据访问事件
   * @param eventType 事件类型
   * @param user 用户对象
   * @param resourceType 资源类型
   * @param resourceId 资源ID
   * @param description 描述
   * @param ipAddress IP地址
   * @param details 详细信息
   */
  public async logDataAccessEvent(
    eventType: AuditEventType,
    user: User,
    resourceType: string,
    resourceId: string,
    description: string,
    ipAddress?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId: user.id,
      username: user.username,
      eventType,
      level: AuditLogLevel.INFO,
      resourceType,
      resourceId,
      description,
      ipAddress,
      details
    });
  }

  /**
   * 记录系统配置变更事件
   * @param user 用户对象
   * @param configName 配置名称
   * @param oldValue 旧值
   * @param newValue 新值
   * @param ipAddress IP地址
   */
  public async logConfigChange(
    user: User,
    configName: string,
    oldValue: any,
    newValue: any,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId: user.id,
      username: user.username,
      eventType: AuditEventType.CONFIG_CHANGE,
      level: AuditLogLevel.INFO,
      resourceType: 'system_config',
      resourceId: configName,
      description: `系统配置变更: ${configName}`,
      ipAddress,
      details: {
        oldValue,
        newValue
      }
    });
  }

  /**
   * 记录安全事件
   * @param eventType 事件类型
   * @param level 日志级别
   * @param description 描述
   * @param userId 用户ID
   * @param ipAddress IP地址
   * @param details 详细信息
   */
  public async logSecurityEvent(
    eventType: AuditEventType,
    level: AuditLogLevel,
    description: string,
    userId?: string,
    ipAddress?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      eventType,
      level,
      resourceType: 'security',
      description,
      ipAddress,
      details
    });

    // 对于严重安全事件，触发告警
    if (level === AuditLogLevel.CRITICAL || level === AuditLogLevel.ERROR) {
      await this.triggerAlert({
        userId,
        eventType,
        level,
        description,
        ipAddress,
        details
      });
    }
  }

  /**
   * 查询审计日志
   * @param filters 过滤条件
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 审计日志列表和总数
   */
  public async queryLogs(
    filters: {
      userId?: string;
      eventType?: AuditEventType;
      level?: AuditLogLevel;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ logs: any[]; total: number }> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.level) where.level = filters.level;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);

    // 解析JSON字段
    const parsedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details as string) : undefined
    }));

    return {
      logs: parsedLogs,
      total
    };
  }

  /**
   * 获取安全统计数据
   * @param days 天数
   * @returns 安全统计数据
   */
  public async getSecurityStats(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取认证失败次数
    const authFailures = await prisma.auditLog.count({
      where: {
        eventType: AuditEventType.LOGIN_FAILURE,
        timestamp: {
          gte: startDate
        }
      }
    });

    // 获取访问拒绝次数
    const accessDenied = await prisma.auditLog.count({
      where: {
        eventType: AuditEventType.ACCESS_DENIED,
        timestamp: {
          gte: startDate
        }
      }
    });

    // 获取可疑活动次数
    const suspiciousActivities = await prisma.auditLog.count({
      where: {
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        timestamp: {
          gte: startDate
        }
      }
    });

    // 获取关键安全事件
    const criticalEvents = await prisma.auditLog.count({
      where: {
        level: AuditLogLevel.CRITICAL,
        timestamp: {
          gte: startDate
        }
      }
    });

    return {
      authFailures,
      accessDenied,
      suspiciousActivities,
      criticalEvents,
      period: days
    };
  }

  /**
   * 触发安全告警
   * @param entry 审计日志条目
   */
  private async triggerAlert(entry: AuditLogEntry): Promise<void> {
    // 实际实现中，可以发送邮件、短信或推送通知
    console.warn('SECURITY ALERT:', {
      timestamp: entry.timestamp?.toISOString(),
      eventType: entry.eventType,
      level: entry.level,
      userId: entry.userId,
      description: entry.description,
      ipAddress: entry.ipAddress,
      details: entry.details
    });

    // 如果有告警服务，可以调用告警服务
    // await alertService.sendAlert({
    //   title: `安全告警: ${entry.eventType}`,
    //   message: entry.description,
    //   level: entry.level,
    //   details: entry.details
    // });
  }

  /**
   * 清理过期审计日志
   * @param days 保留天数
   */
  public async cleanupLogs(days: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 删除过期日志
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        },
        // 保留关键日志
        NOT: {
          level: AuditLogLevel.CRITICAL
        }
      }
    });

    return result.count;
  }
}

// 导出单例实例
export const auditLogService = AuditLogService.getInstance();

export default auditLogService; 