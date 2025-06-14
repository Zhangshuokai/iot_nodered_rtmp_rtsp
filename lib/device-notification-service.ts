/**
 * 设备在线离线通知服务 - 实现设备状态变更通知功能
 * 
 * 该服务实现了以下功能：
 * 1. 设备状态变更通知
 * 2. 通知渠道管理（WebSocket、邮件、短信等）
 * 3. 通知模板管理
 * 4. 通知发送记录
 * 5. 通知规则配置
 */

import { EventEmitter } from 'events';
import { PrismaClient, Device, User, Organization } from '@prisma/client';
import { prisma } from './db-prisma';
import { websocketService } from './websocket-service';
import { deviceConnectionService, DeviceConnectionStatus, DeviceConnectionInfo } from './device-connection-service';
import { auditLogService, AuditEventType, AuditLogLevel } from './audit-log-service';

/**
 * 通知类型
 */
export enum NotificationType {
  DEVICE_ONLINE = 'DEVICE_ONLINE',
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',
  DEVICE_INACTIVE = 'DEVICE_INACTIVE',
  DEVICE_ERROR = 'DEVICE_ERROR',
  DEVICE_ALARM = 'DEVICE_ALARM',
  DEVICE_COMMAND_RESPONSE = 'DEVICE_COMMAND_RESPONSE',
  DEVICE_DATA_ANOMALY = 'DEVICE_DATA_ANOMALY',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

/**
 * 通知渠道
 */
export enum NotificationChannel {
  WEBSOCKET = 'WEBSOCKET',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEBHOOK = 'WEBHOOK'
}

/**
 * 通知优先级
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  // 通知类型
  type: NotificationType;
  // 通知渠道
  channels: NotificationChannel[];
  // 通知优先级
  priority: NotificationPriority;
  // 是否启用
  enabled: boolean;
  // 通知模板
  template?: string;
  // 额外配置
  config?: Record<string, any>;
}

/**
 * 通知消息
 */
export interface NotificationMessage {
  // 通知ID
  id: string;
  // 通知类型
  type: NotificationType;
  // 通知标题
  title: string;
  // 通知内容
  content: string;
  // 通知时间
  timestamp: Date;
  // 通知优先级
  priority: NotificationPriority;
  // 设备ID
  deviceId?: string;
  // 设备标识符
  deviceIdentifier?: string;
  // 设备名称
  deviceName?: string;
  // 组织ID
  organizationId?: string;
  // 组织名称
  organizationName?: string;
  // 额外数据
  data?: Record<string, any>;
  // 已读状态
  read?: boolean;
  // 已读时间
  readAt?: Date;
  // 已读用户ID
  readBy?: string;
}

/**
 * 设备在线离线通知服务类
 */
export class DeviceNotificationService extends EventEmitter {
  private static instance: DeviceNotificationService;
  private notificationConfigs: Map<string, NotificationConfig[]> = new Map();
  private defaultConfigs: NotificationConfig[] = [];

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    super();
    this.setupEventListeners();
    this.loadDefaultConfigs();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DeviceNotificationService {
    if (!DeviceNotificationService.instance) {
      DeviceNotificationService.instance = new DeviceNotificationService();
    }
    return DeviceNotificationService.instance;
  }

  /**
   * 设置通知配置
   * @param organizationId 组织ID
   * @param configs 通知配置数组
   */
  public setNotificationConfigs(organizationId: string, configs: NotificationConfig[]): void {
    this.notificationConfigs.set(organizationId, configs);
  }

  /**
   * 获取通知配置
   * @param organizationId 组织ID
   * @returns 通知配置数组
   */
  public getNotificationConfigs(organizationId: string): NotificationConfig[] {
    return this.notificationConfigs.get(organizationId) || this.defaultConfigs;
  }

  /**
   * 发送设备状态变更通知
   * @param deviceId 设备ID
   * @param status 设备状态
   * @param connectionInfo 连接信息
   */
  public async sendDeviceStatusNotification(
    deviceId: string,
    status: DeviceConnectionStatus,
    connectionInfo: DeviceConnectionInfo
  ): Promise<void> {
    try {
      // 获取设备信息
      const device = await this.getDeviceWithOrganization(deviceId);
      if (!device) {
        console.error(`Device with ID ${deviceId} not found`);
        return;
      }

      // 确定通知类型
      let notificationType: NotificationType;
      switch (status) {
        case DeviceConnectionStatus.ONLINE:
          notificationType = NotificationType.DEVICE_ONLINE;
          break;
        case DeviceConnectionStatus.OFFLINE:
          notificationType = NotificationType.DEVICE_OFFLINE;
          break;
        case DeviceConnectionStatus.INACTIVE:
          notificationType = NotificationType.DEVICE_INACTIVE;
          break;
        case DeviceConnectionStatus.ERROR:
          notificationType = NotificationType.DEVICE_ERROR;
          break;
        default:
          return; // 不支持的状态
      }

      // 获取组织的通知配置
      const organizationId = device.organizationId || 'default';
      const configs = this.getNotificationConfigs(organizationId);

      // 查找匹配的通知配置
      const matchingConfig = configs.find(config => 
        config.type === notificationType && config.enabled
      );

      if (!matchingConfig) {
        return; // 没有匹配的配置或配置已禁用
      }

      // 创建通知消息
      const message: NotificationMessage = {
        id: this.generateNotificationId(),
        type: notificationType,
        title: this.generateNotificationTitle(notificationType, device),
        content: this.generateNotificationContent(notificationType, device, connectionInfo),
        timestamp: new Date(),
        priority: matchingConfig.priority,
        deviceId: deviceId,
        deviceIdentifier: device.identifier,
        deviceName: device.name,
        organizationId: device.organizationId || undefined,
        organizationName: device.organization?.name,
        data: {
          status,
          protocol: connectionInfo.protocol,
          address: connectionInfo.address,
          port: connectionInfo.port,
          lastActivityAt: connectionInfo.lastActivityAt,
          connectedAt: connectionInfo.connectedAt,
          disconnectedAt: connectionInfo.disconnectedAt,
          connectionDuration: connectionInfo.connectionDuration
        }
      };

      // 发送通知
      await this.sendNotification(message, matchingConfig.channels);

      // 记录通知日志
      await this.logNotification(message);
    } catch (error) {
      console.error(`Error sending device status notification: ${error}`);
    }
  }

  /**
   * 发送通知
   * @param message 通知消息
   * @param channels 通知渠道
   */
  public async sendNotification(
    message: NotificationMessage,
    channels: NotificationChannel[]
  ): Promise<void> {
    try {
      // 遍历所有通知渠道
      for (const channel of channels) {
        switch (channel) {
          case NotificationChannel.WEBSOCKET:
            await this.sendWebSocketNotification(message);
            break;
          case NotificationChannel.EMAIL:
            await this.sendEmailNotification(message);
            break;
          case NotificationChannel.SMS:
            await this.sendSmsNotification(message);
            break;
          case NotificationChannel.PUSH:
            await this.sendPushNotification(message);
            break;
          case NotificationChannel.WEBHOOK:
            await this.sendWebhookNotification(message);
            break;
        }
      }

      // 触发通知发送事件
      this.emit('notification_sent', message);
    } catch (error) {
      console.error(`Error sending notification: ${error}`);
    }
  }

  /**
   * 标记通知为已读
   * @param notificationId 通知ID
   * @param userId 用户ID
   */
  public async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      // 这里应该实现标记通知为已读的逻辑
      // 例如，更新数据库中的通知记录
      
      // 触发通知已读事件
      this.emit('notification_read', notificationId, userId);
      
      return true;
    } catch (error) {
      console.error(`Error marking notification as read: ${error}`);
      return false;
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听设备连接状态变更事件
    deviceConnectionService.on('status_change', (deviceId, newConnection, oldConnection) => {
      this.sendDeviceStatusNotification(deviceId, newConnection.status, newConnection);
    });

    // 监听特定状态事件
    deviceConnectionService.on('device_online', (deviceId, connectionInfo) => {
      this.sendDeviceStatusNotification(deviceId, DeviceConnectionStatus.ONLINE, connectionInfo);
    });

    deviceConnectionService.on('device_offline', (deviceId, connectionInfo) => {
      this.sendDeviceStatusNotification(deviceId, DeviceConnectionStatus.OFFLINE, connectionInfo);
    });

    deviceConnectionService.on('device_inactive', (deviceId, connectionInfo) => {
      this.sendDeviceStatusNotification(deviceId, DeviceConnectionStatus.INACTIVE, connectionInfo);
    });

    deviceConnectionService.on('device_error', (deviceId, connectionInfo) => {
      this.sendDeviceStatusNotification(deviceId, DeviceConnectionStatus.ERROR, connectionInfo);
    });
  }

  /**
   * 加载默认配置
   */
  private loadDefaultConfigs(): void {
    // 设置默认通知配置
    this.defaultConfigs = [
      {
        type: NotificationType.DEVICE_ONLINE,
        channels: [NotificationChannel.WEBSOCKET],
        priority: NotificationPriority.LOW,
        enabled: true
      },
      {
        type: NotificationType.DEVICE_OFFLINE,
        channels: [NotificationChannel.WEBSOCKET],
        priority: NotificationPriority.MEDIUM,
        enabled: true
      },
      {
        type: NotificationType.DEVICE_INACTIVE,
        channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
        priority: NotificationPriority.MEDIUM,
        enabled: true
      },
      {
        type: NotificationType.DEVICE_ERROR,
        channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        enabled: true
      },
      {
        type: NotificationType.DEVICE_ALARM,
        channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
        priority: NotificationPriority.HIGH,
        enabled: true
      },
      {
        type: NotificationType.DEVICE_COMMAND_RESPONSE,
        channels: [NotificationChannel.WEBSOCKET],
        priority: NotificationPriority.LOW,
        enabled: true
      },
      {
        type: NotificationType.DEVICE_DATA_ANOMALY,
        channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
        priority: NotificationPriority.MEDIUM,
        enabled: true
      },
      {
        type: NotificationType.SYSTEM_ERROR,
        channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
        priority: NotificationPriority.CRITICAL,
        enabled: true
      }
    ];
  }

  /**
   * 发送WebSocket通知
   * @param message 通知消息
   */
  private async sendWebSocketNotification(message: NotificationMessage): Promise<void> {
    try {
      // 如果有设备ID，发送到设备相关的房间
      if (message.deviceId) {
        websocketService.broadcastToRoom(`device:${message.deviceId}`, 'notification', message);
      }

      // 如果有组织ID，发送到组织相关的房间
      if (message.organizationId) {
        websocketService.broadcastToRoom(`organization:${message.organizationId}`, 'notification', message);
      }

      // 根据通知优先级，可能还需要发送到全局通知房间
      if (message.priority === NotificationPriority.HIGH || message.priority === NotificationPriority.CRITICAL) {
        websocketService.broadcastToRoom('notifications', 'notification', message);
      }
    } catch (error) {
      console.error(`Error sending WebSocket notification: ${error}`);
    }
  }

  /**
   * 发送邮件通知
   * @param message 通知消息
   */
  private async sendEmailNotification(message: NotificationMessage): Promise<void> {
    try {
      // 这里应该实现发送邮件的逻辑
      // 例如，使用邮件服务发送邮件
      console.log(`[EMAIL] ${message.title}: ${message.content}`);
    } catch (error) {
      console.error(`Error sending email notification: ${error}`);
    }
  }

  /**
   * 发送短信通知
   * @param message 通知消息
   */
  private async sendSmsNotification(message: NotificationMessage): Promise<void> {
    try {
      // 这里应该实现发送短信的逻辑
      // 例如，使用短信服务发送短信
      console.log(`[SMS] ${message.title}: ${message.content}`);
    } catch (error) {
      console.error(`Error sending SMS notification: ${error}`);
    }
  }

  /**
   * 发送推送通知
   * @param message 通知消息
   */
  private async sendPushNotification(message: NotificationMessage): Promise<void> {
    try {
      // 这里应该实现发送推送通知的逻辑
      // 例如，使用推送服务发送推送通知
      console.log(`[PUSH] ${message.title}: ${message.content}`);
    } catch (error) {
      console.error(`Error sending push notification: ${error}`);
    }
  }

  /**
   * 发送Webhook通知
   * @param message 通知消息
   */
  private async sendWebhookNotification(message: NotificationMessage): Promise<void> {
    try {
      // 这里应该实现发送Webhook通知的逻辑
      // 例如，调用配置的Webhook URL
      console.log(`[WEBHOOK] ${message.title}: ${message.content}`);
    } catch (error) {
      console.error(`Error sending webhook notification: ${error}`);
    }
  }

  /**
   * 记录通知日志
   * @param message 通知消息
   */
  private async logNotification(message: NotificationMessage): Promise<void> {
    try {
      // 记录审计日志
      await auditLogService.logSecurityEvent(
        AuditEventType.NOTIFICATION_SENT,
        message.priority === NotificationPriority.CRITICAL 
          ? AuditLogLevel.CRITICAL 
          : message.priority === NotificationPriority.HIGH 
            ? AuditLogLevel.ERROR
            : message.priority === NotificationPriority.MEDIUM
              ? AuditLogLevel.WARNING
              : AuditLogLevel.INFO,
        `发送通知: ${message.title}`,
        undefined,
        message.deviceId,
        {
          notificationType: message.type,
          notificationId: message.id,
          deviceName: message.deviceName,
          organizationId: message.organizationId,
          organizationName: message.organizationName,
          content: message.content
        }
      );
    } catch (error) {
      console.error(`Error logging notification: ${error}`);
    }
  }

  /**
   * 生成通知ID
   * @returns 通知ID
   */
  private generateNotificationId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 生成通知标题
   * @param type 通知类型
   * @param device 设备信息
   * @returns 通知标题
   */
  private generateNotificationTitle(type: NotificationType, device: Device): string {
    switch (type) {
      case NotificationType.DEVICE_ONLINE:
        return `设备上线: ${device.name}`;
      case NotificationType.DEVICE_OFFLINE:
        return `设备离线: ${device.name}`;
      case NotificationType.DEVICE_INACTIVE:
        return `设备不活跃: ${device.name}`;
      case NotificationType.DEVICE_ERROR:
        return `设备错误: ${device.name}`;
      case NotificationType.DEVICE_ALARM:
        return `设备告警: ${device.name}`;
      case NotificationType.DEVICE_COMMAND_RESPONSE:
        return `设备命令响应: ${device.name}`;
      case NotificationType.DEVICE_DATA_ANOMALY:
        return `设备数据异常: ${device.name}`;
      case NotificationType.SYSTEM_ERROR:
        return `系统错误`;
      default:
        return `设备通知: ${device.name}`;
    }
  }

  /**
   * 生成通知内容
   * @param type 通知类型
   * @param device 设备信息
   * @param connectionInfo 连接信息
   * @returns 通知内容
   */
  private generateNotificationContent(
    type: NotificationType,
    device: Device,
    connectionInfo: DeviceConnectionInfo
  ): string {
    const time = new Date().toLocaleString();
    
    switch (type) {
      case NotificationType.DEVICE_ONLINE:
        return `设备 ${device.name}(${device.identifier}) 于 ${time} 上线。连接协议: ${connectionInfo.protocol}`;
      case NotificationType.DEVICE_OFFLINE:
        return `设备 ${device.name}(${device.identifier}) 于 ${time} 离线。连接持续时间: ${connectionInfo.connectionDuration || 0} 秒`;
      case NotificationType.DEVICE_INACTIVE:
        return `设备 ${device.name}(${device.identifier}) 于 ${time} 变为不活跃状态。最后活动时间: ${connectionInfo.lastActivityAt.toLocaleString()}`;
      case NotificationType.DEVICE_ERROR:
        return `设备 ${device.name}(${device.identifier}) 于 ${time} 发生错误。请检查设备状态。`;
      default:
        return `设备 ${device.name}(${device.identifier}) 状态变更通知。`;
    }
  }

  /**
   * 获取设备信息（包含组织信息）
   * @param deviceId 设备ID
   * @returns 设备信息
   */
  private async getDeviceWithOrganization(deviceId: string): Promise<Device & { organization: Organization | null }> {
    try {
      return await prisma.device.findUnique({
        where: { id: deviceId },
        include: { organization: true }
      }) as (Device & { organization: Organization | null });
    } catch (error) {
      console.error(`Error getting device with organization: ${error}`);
      throw error;
    }
  }
}

// 导出单例实例
export const deviceNotificationService = DeviceNotificationService.getInstance();

export default deviceNotificationService; 