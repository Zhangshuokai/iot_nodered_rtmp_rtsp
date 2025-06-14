/**
 * 设备连接状态管理服务 - 实现设备在线状态管理、连接事件处理和通知功能
 * 
 * 该服务实现了以下功能：
 * 1. 设备连接状态管理
 * 2. 设备在线/离线事件处理
 * 3. 设备连接状态变更通知
 * 4. 设备心跳管理
 * 5. 设备连接统计
 */

import { EventEmitter } from 'events';
import { PrismaClient, Device, DeviceConnectionLog, ConnectionProtocol } from '@prisma/client';
import { prisma } from './db-prisma';
import { auditLogService, AuditEventType, AuditLogLevel } from './audit-log-service';
import { websocketService } from './websocket-service';
import mqttClient from './mqtt-client';
import { tcpService, udpService } from './tcp-udp-service';

/**
 * 设备连接状态
 */
export enum DeviceConnectionStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR'
}

/**
 * 设备连接协议类型
 */
export enum DeviceProtocol {
  MQTT = 'MQTT',
  TCP = 'TCP',
  UDP = 'UDP',
  HTTP = 'HTTP',
  WEBSOCKET = 'WEBSOCKET',
  COAP = 'COAP',
  UNKNOWN = 'UNKNOWN'
}

/**
 * 设备连接信息
 */
export interface DeviceConnectionInfo {
  // 设备ID
  deviceId: string;
  // 设备标识符
  deviceIdentifier: string;
  // 连接状态
  status: DeviceConnectionStatus;
  // 连接协议
  protocol: DeviceProtocol;
  // 连接地址
  address?: string;
  // 连接端口
  port?: number;
  // 客户端ID
  clientId?: string;
  // 最后活动时间
  lastActivityAt: Date;
  // 连接时间
  connectedAt?: Date;
  // 断开连接时间
  disconnectedAt?: Date;
  // 连接持续时间（秒）
  connectionDuration?: number;
  // 连接会话ID
  sessionId?: string;
  // 额外信息
  metadata?: Record<string, any>;
}

/**
 * 设备连接状态管理服务类
 */
export class DeviceConnectionService extends EventEmitter {
  private static instance: DeviceConnectionService;
  private deviceConnections: Map<string, DeviceConnectionInfo> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 60000; // 60秒
  private readonly CLEANUP_INTERVAL = 300000; // 5分钟
  private readonly INACTIVE_THRESHOLD = 300000; // 5分钟无活动视为不活跃

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    super();
    this.setupEventListeners();
    this.startCleanupInterval();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DeviceConnectionService {
    if (!DeviceConnectionService.instance) {
      DeviceConnectionService.instance = new DeviceConnectionService();
    }
    return DeviceConnectionService.instance;
  }

  /**
   * 设置设备连接状态
   * @param deviceId 设备ID
   * @param status 连接状态
   * @param protocol 连接协议
   * @param connectionInfo 连接信息
   */
  public async setDeviceStatus(
    deviceId: string,
    status: DeviceConnectionStatus,
    protocol: DeviceProtocol,
    connectionInfo?: Partial<DeviceConnectionInfo>
  ): Promise<DeviceConnectionInfo> {
    // 获取设备信息
    const device = await this.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    // 获取当前连接信息
    const existingConnection = this.deviceConnections.get(deviceId);
    const now = new Date();

    // 创建新的连接信息
    const connectionData: DeviceConnectionInfo = {
      deviceId,
      deviceIdentifier: device.identifier,
      status,
      protocol,
      lastActivityAt: now,
      ...connectionInfo
    };

    // 根据状态设置相关字段
    if (status === DeviceConnectionStatus.ONLINE) {
      // 如果之前不在线，设置连接时间
      if (!existingConnection || existingConnection.status !== DeviceConnectionStatus.ONLINE) {
        connectionData.connectedAt = now;
        connectionData.sessionId = this.generateSessionId();
      } else {
        // 保留原有连接时间和会话ID
        connectionData.connectedAt = existingConnection.connectedAt;
        connectionData.sessionId = existingConnection.sessionId;
      }
      
      // 清除断开连接时间
      connectionData.disconnectedAt = undefined;
      
      // 设置心跳检测
      this.setupHeartbeat(deviceId);
    } else if (status === DeviceConnectionStatus.OFFLINE) {
      // 设置断开连接时间
      connectionData.disconnectedAt = now;
      
      // 计算连接持续时间
      if (existingConnection?.connectedAt) {
        const duration = now.getTime() - existingConnection.connectedAt.getTime();
        connectionData.connectionDuration = Math.floor(duration / 1000);
      }
      
      // 清除心跳检测
      this.clearHeartbeat(deviceId);
    }

    // 保存连接信息
    this.deviceConnections.set(deviceId, connectionData);

    // 记录连接日志
    await this.logConnectionStatus(deviceId, status, protocol, connectionData);

    // 更新设备状态
    await this.updateDeviceStatus(deviceId, status);

    // 触发状态变更事件
    this.emitStatusChange(deviceId, connectionData, existingConnection);

    return connectionData;
  }

  /**
   * 更新设备活动状态
   * @param deviceId 设备ID
   * @param metadata 额外信息
   */
  public async updateDeviceActivity(deviceId: string, metadata?: Record<string, any>): Promise<void> {
    const connection = this.deviceConnections.get(deviceId);
    if (!connection) {
      return;
    }

    // 更新最后活动时间
    connection.lastActivityAt = new Date();
    
    // 更新额外信息
    if (metadata) {
      connection.metadata = {
        ...connection.metadata,
        ...metadata
      };
    }

    // 保存更新后的连接信息
    this.deviceConnections.set(deviceId, connection);
  }

  /**
   * 获取设备连接状态
   * @param deviceId 设备ID
   * @returns 设备连接信息
   */
  public getDeviceConnection(deviceId: string): DeviceConnectionInfo | undefined {
    return this.deviceConnections.get(deviceId);
  }

  /**
   * 获取所有设备连接状态
   * @returns 设备连接信息映射表
   */
  public getAllDeviceConnections(): Map<string, DeviceConnectionInfo> {
    return new Map(this.deviceConnections);
  }

  /**
   * 获取在线设备数量
   * @returns 在线设备数量
   */
  public getOnlineDeviceCount(): number {
    let count = 0;
    for (const connection of this.deviceConnections.values()) {
      if (connection.status === DeviceConnectionStatus.ONLINE) {
        count++;
      }
    }
    return count;
  }

  /**
   * 获取按协议分组的设备连接统计
   * @returns 按协议分组的设备连接统计
   */
  public getDeviceConnectionStatsByProtocol(): Record<DeviceProtocol, number> {
    const stats: Record<DeviceProtocol, number> = {
      [DeviceProtocol.MQTT]: 0,
      [DeviceProtocol.TCP]: 0,
      [DeviceProtocol.UDP]: 0,
      [DeviceProtocol.HTTP]: 0,
      [DeviceProtocol.WEBSOCKET]: 0,
      [DeviceProtocol.COAP]: 0,
      [DeviceProtocol.UNKNOWN]: 0
    };

    for (const connection of this.deviceConnections.values()) {
      if (connection.status === DeviceConnectionStatus.ONLINE) {
        stats[connection.protocol]++;
      }
    }

    return stats;
  }

  /**
   * 设置设备心跳
   * @param deviceId 设备ID
   */
  private setupHeartbeat(deviceId: string): void {
    // 清除现有心跳
    this.clearHeartbeat(deviceId);

    // 设置新的心跳
    const interval = setInterval(async () => {
      const connection = this.deviceConnections.get(deviceId);
      if (!connection) {
        this.clearHeartbeat(deviceId);
        return;
      }

      const now = new Date();
      const lastActivity = connection.lastActivityAt;
      const inactiveTime = now.getTime() - lastActivity.getTime();

      // 如果超过不活跃阈值，设置为不活跃状态
      if (inactiveTime > this.INACTIVE_THRESHOLD) {
        await this.setDeviceStatus(
          deviceId,
          DeviceConnectionStatus.INACTIVE,
          connection.protocol,
          {
            lastActivityAt: lastActivity,
            metadata: {
              ...connection.metadata,
              inactiveReason: 'Heartbeat timeout'
            }
          }
        );
      }
    }, this.HEARTBEAT_INTERVAL);

    // 保存心跳间隔
    this.heartbeatIntervals.set(deviceId, interval);
  }

  /**
   * 清除设备心跳
   * @param deviceId 设备ID
   */
  private clearHeartbeat(deviceId: string): void {
    const interval = this.heartbeatIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(deviceId);
    }
  }

  /**
   * 启动清理间隔
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * 清理不活跃的连接
   */
  private async cleanupInactiveConnections(): Promise<void> {
    const now = new Date();
    const devicesToCleanup: string[] = [];

    // 查找不活跃的连接
    for (const [deviceId, connection] of this.deviceConnections.entries()) {
      if (connection.status === DeviceConnectionStatus.INACTIVE || connection.status === DeviceConnectionStatus.ERROR) {
        const inactiveTime = now.getTime() - connection.lastActivityAt.getTime();
        
        // 如果超过24小时不活跃，清理连接
        if (inactiveTime > 24 * 60 * 60 * 1000) {
          devicesToCleanup.push(deviceId);
        }
      }
    }

    // 清理连接
    for (const deviceId of devicesToCleanup) {
      const connection = this.deviceConnections.get(deviceId);
      if (connection) {
        // 记录连接日志
        await this.logConnectionStatus(
          deviceId,
          DeviceConnectionStatus.OFFLINE,
          connection.protocol,
          {
            ...connection,
            status: DeviceConnectionStatus.OFFLINE,
            disconnectedAt: now,
            metadata: {
              ...connection.metadata,
              cleanupReason: 'Inactive for more than 24 hours'
            }
          }
        );

        // 清除连接信息
        this.deviceConnections.delete(deviceId);
        this.clearHeartbeat(deviceId);
      }
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听MQTT连接事件
    mqttClient.on('connect', () => {
      // MQTT连接成功后，需要重新订阅设备主题
      this.setupMqttSubscriptions();
    });

    mqttClient.on('message', async (topic, payload) => {
      // 解析主题，提取设备ID
      const deviceId = this.extractDeviceIdFromTopic(topic);
      if (deviceId) {
        // 更新设备活动状态
        await this.updateDeviceActivity(deviceId, {
          lastMessage: {
            topic,
            timestamp: new Date()
          }
        });
      }
    });

    // 监听TCP连接事件
    tcpService.on('connection', async (connectionId, socket) => {
      // 从连接中提取设备标识符
      const deviceIdentifier = this.extractDeviceIdentifierFromSocket(socket);
      if (deviceIdentifier) {
        // 查找设备
        const device = await this.getDeviceByIdentifier(deviceIdentifier);
        if (device) {
          // 设置设备为在线状态
          await this.setDeviceStatus(
            device.id,
            DeviceConnectionStatus.ONLINE,
            DeviceProtocol.TCP,
            {
              clientId: connectionId,
              address: socket.remoteAddress,
              port: socket.remotePort
            }
          );
        }
      }
    });

    tcpService.on('socket_close', async (connectionId) => {
      // 查找使用此连接ID的设备
      for (const [deviceId, connection] of this.deviceConnections.entries()) {
        if (connection.protocol === DeviceProtocol.TCP && connection.clientId === connectionId) {
          // 设置设备为离线状态
          await this.setDeviceStatus(
            deviceId,
            DeviceConnectionStatus.OFFLINE,
            DeviceProtocol.TCP
          );
          break;
        }
      }
    });

    // 监听WebSocket连接事件
    websocketService.on('connection', async (client) => {
      // 从WebSocket连接中提取设备标识符
      const deviceIdentifier = this.extractDeviceIdentifierFromWebSocket(client);
      if (deviceIdentifier) {
        // 查找设备
        const device = await this.getDeviceByIdentifier(deviceIdentifier);
        if (device) {
          // 设置设备为在线状态
          await this.setDeviceStatus(
            device.id,
            DeviceConnectionStatus.ONLINE,
            DeviceProtocol.WEBSOCKET,
            {
              clientId: client.id,
              address: client.handshake.address
            }
          );

          // 监听设备消息
          client.on('device:heartbeat', async () => {
            await this.updateDeviceActivity(device.id, {
              lastHeartbeat: new Date()
            });
          });
        }
      }
    });

    websocketService.on('disconnect', async (client) => {
      // 查找使用此连接ID的设备
      for (const [deviceId, connection] of this.deviceConnections.entries()) {
        if (connection.protocol === DeviceProtocol.WEBSOCKET && connection.clientId === client.id) {
          // 设置设备为离线状态
          await this.setDeviceStatus(
            deviceId,
            DeviceConnectionStatus.OFFLINE,
            DeviceProtocol.WEBSOCKET
          );
          break;
        }
      }
    });
  }

  /**
   * 设置MQTT订阅
   */
  private async setupMqttSubscriptions(): Promise<void> {
    if (!mqttClient.isClientConnected()) {
      return;
    }

    try {
      // 订阅设备状态主题
      await mqttClient.subscribe('devices/+/status', { qos: 1 }, async (topic, payload) => {
        const deviceId = this.extractDeviceIdFromTopic(topic);
        if (!deviceId) return;

        try {
          const status = payload.toString();
          if (status === 'online') {
            // 设备上线
            const device = await this.getDeviceById(deviceId);
            if (device) {
              await this.setDeviceStatus(
                deviceId,
                DeviceConnectionStatus.ONLINE,
                DeviceProtocol.MQTT
              );
            }
          } else if (status === 'offline') {
            // 设备离线
            await this.setDeviceStatus(
              deviceId,
              DeviceConnectionStatus.OFFLINE,
              DeviceProtocol.MQTT
            );
          }
        } catch (error) {
          console.error(`Error processing MQTT status message: ${error}`);
        }
      });

      // 订阅设备遗嘱主题
      await mqttClient.subscribe('devices/+/lwt', { qos: 1 }, async (topic, payload) => {
        const deviceId = this.extractDeviceIdFromTopic(topic);
        if (!deviceId) return;

        try {
          // 设备意外断开连接
          await this.setDeviceStatus(
            deviceId,
            DeviceConnectionStatus.OFFLINE,
            DeviceProtocol.MQTT,
            {
              metadata: {
                lwtMessage: payload.toString(),
                lwtTimestamp: new Date()
              }
            }
          );
        } catch (error) {
          console.error(`Error processing MQTT LWT message: ${error}`);
        }
      });
    } catch (error) {
      console.error(`Error setting up MQTT subscriptions: ${error}`);
    }
  }

  /**
   * 从主题中提取设备ID
   * @param topic MQTT主题
   * @returns 设备ID
   */
  private extractDeviceIdFromTopic(topic: string): string | null {
    // 主题格式: devices/{deviceId}/...
    const match = topic.match(/^devices\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * 从Socket中提取设备标识符
   * @param socket TCP Socket
   * @returns 设备标识符
   */
  private extractDeviceIdentifierFromSocket(socket: any): string | null {
    // 这里需要根据实际协议实现提取设备标识符的逻辑
    // 例如，可能从首次通信的数据中提取，或者从连接地址中提取
    return null;
  }

  /**
   * 从WebSocket中提取设备标识符
   * @param client WebSocket客户端
   * @returns 设备标识符
   */
  private extractDeviceIdentifierFromWebSocket(client: any): string | null {
    // 从WebSocket握手请求中提取设备标识符
    // 例如，可能从查询参数或认证信息中提取
    const query = client.handshake.query;
    return query.deviceId || null;
  }

  /**
   * 记录连接状态日志
   * @param deviceId 设备ID
   * @param status 连接状态
   * @param protocol 连接协议
   * @param connectionInfo 连接信息
   */
  private async logConnectionStatus(
    deviceId: string,
    status: DeviceConnectionStatus,
    protocol: DeviceProtocol,
    connectionInfo: DeviceConnectionInfo
  ): Promise<void> {
    try {
      // 转换协议枚举
      let dbProtocol: ConnectionProtocol;
      switch (protocol) {
        case DeviceProtocol.MQTT:
          dbProtocol = ConnectionProtocol.MQTT;
          break;
        case DeviceProtocol.TCP:
          dbProtocol = ConnectionProtocol.TCP;
          break;
        case DeviceProtocol.UDP:
          dbProtocol = ConnectionProtocol.UDP;
          break;
        case DeviceProtocol.HTTP:
          dbProtocol = ConnectionProtocol.HTTP;
          break;
        case DeviceProtocol.WEBSOCKET:
          dbProtocol = ConnectionProtocol.WEBSOCKET;
          break;
        case DeviceProtocol.COAP:
          dbProtocol = ConnectionProtocol.COAP;
          break;
        default:
          dbProtocol = ConnectionProtocol.UNKNOWN;
      }

      // 创建连接日志
      await prisma.deviceConnectionLog.create({
        data: {
          deviceId,
          status: status,
          protocol: dbProtocol,
          clientId: connectionInfo.clientId,
          ipAddress: connectionInfo.address,
          port: connectionInfo.port,
          connectedAt: connectionInfo.connectedAt,
          disconnectedAt: connectionInfo.disconnectedAt,
          connectionDuration: connectionInfo.connectionDuration,
          sessionId: connectionInfo.sessionId,
          metadata: connectionInfo.metadata
        }
      });

      // 记录审计日志
      const level = status === DeviceConnectionStatus.ONLINE ? AuditLogLevel.INFO : AuditLogLevel.WARNING;
      const description = status === DeviceConnectionStatus.ONLINE 
        ? `设备连接成功 (${protocol})` 
        : `设备断开连接 (${protocol})`;
      
      await auditLogService.logSecurityEvent(
        AuditEventType.DEVICE_ONLINE,
        level,
        description,
        undefined,
        deviceId,
        {
          status,
          protocol,
          address: connectionInfo.address,
          port: connectionInfo.port,
          sessionId: connectionInfo.sessionId,
          duration: connectionInfo.connectionDuration
        }
      );
    } catch (error) {
      console.error(`Error logging connection status: ${error}`);
    }
  }

  /**
   * 更新设备状态
   * @param deviceId 设备ID
   * @param status 连接状态
   */
  private async updateDeviceStatus(deviceId: string, status: DeviceConnectionStatus): Promise<void> {
    try {
      // 更新设备状态
      await prisma.device.update({
        where: { id: deviceId },
        data: {
          status: status,
          lastOnlineAt: status === DeviceConnectionStatus.ONLINE ? new Date() : undefined
        }
      });
    } catch (error) {
      console.error(`Error updating device status: ${error}`);
    }
  }

  /**
   * 触发状态变更事件
   * @param deviceId 设备ID
   * @param newConnection 新连接信息
   * @param oldConnection 旧连接信息
   */
  private emitStatusChange(
    deviceId: string,
    newConnection: DeviceConnectionInfo,
    oldConnection?: DeviceConnectionInfo
  ): void {
    // 如果状态没有变化，不触发事件
    if (oldConnection && oldConnection.status === newConnection.status) {
      return;
    }

    // 触发状态变更事件
    this.emit('status_change', deviceId, newConnection, oldConnection);

    // 触发特定状态事件
    if (newConnection.status === DeviceConnectionStatus.ONLINE) {
      this.emit('device_online', deviceId, newConnection);
    } else if (newConnection.status === DeviceConnectionStatus.OFFLINE) {
      this.emit('device_offline', deviceId, newConnection);
    } else if (newConnection.status === DeviceConnectionStatus.INACTIVE) {
      this.emit('device_inactive', deviceId, newConnection);
    } else if (newConnection.status === DeviceConnectionStatus.ERROR) {
      this.emit('device_error', deviceId, newConnection);
    }

    // 通过WebSocket广播设备状态变更
    websocketService.broadcastToRoom(`device:${deviceId}`, 'device:status_change', {
      deviceId,
      status: newConnection.status,
      timestamp: new Date()
    });
  }

  /**
   * 生成会话ID
   * @returns 会话ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 根据ID获取设备
   * @param deviceId 设备ID
   * @returns 设备信息
   */
  private async getDeviceById(deviceId: string): Promise<Device | null> {
    try {
      return await prisma.device.findUnique({
        where: { id: deviceId }
      });
    } catch (error) {
      console.error(`Error getting device by ID: ${error}`);
      return null;
    }
  }

  /**
   * 根据标识符获取设备
   * @param identifier 设备标识符
   * @returns 设备信息
   */
  private async getDeviceByIdentifier(identifier: string): Promise<Device | null> {
    try {
      return await prisma.device.findFirst({
        where: { identifier }
      });
    } catch (error) {
      console.error(`Error getting device by identifier: ${error}`);
      return null;
    }
  }
}

// 导出单例实例
export const deviceConnectionService = DeviceConnectionService.getInstance();

export default deviceConnectionService; 