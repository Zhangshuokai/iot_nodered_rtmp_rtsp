/**
 * MQTT客户端服务 - 实现MQTT协议连接、订阅、发布和消息处理功能
 * 
 * 该服务实现了以下功能：
 * 1. MQTT连接管理
 * 2. 主题订阅与取消订阅
 * 3. 消息发布
 * 4. 消息处理与回调
 * 5. QoS级别控制
 * 6. 断线重连机制
 */

import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { cryptoService } from './crypto-service';
import { auditLogService, AuditEventType, AuditLogLevel } from './audit-log-service';

/**
 * MQTT连接选项
 */
export interface MqttConnectionOptions {
  // MQTT代理服务器地址
  brokerUrl: string;
  // 客户端ID
  clientId?: string;
  // 用户名
  username?: string;
  // 密码
  password?: string;
  // 是否使用安全连接
  useSSL?: boolean;
  // 是否清除会话
  clean?: boolean;
  // 保持连接心跳间隔（秒）
  keepalive?: number;
  // 重连间隔（毫秒）
  reconnectPeriod?: number;
  // 连接超时时间（毫秒）
  connectTimeout?: number;
  // 遗嘱消息配置
  will?: {
    topic: string;
    payload: string;
    qos?: 0 | 1 | 2;
    retain?: boolean;
  };
  // 证书配置（用于TLS/SSL）
  certs?: {
    ca?: string;
    cert?: string;
    key?: string;
  };
}

/**
 * MQTT消息处理器
 */
export type MqttMessageHandler = (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => void;

/**
 * MQTT客户端服务类
 */
export class MqttClientService extends EventEmitter {
  private static instance: MqttClientService;
  private client: mqtt.MqttClient | null = null;
  private options: MqttConnectionOptions | null = null;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, { qos: 0 | 1 | 2, handler: MqttMessageHandler }> = new Map();
  private connectionAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    super();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MqttClientService {
    if (!MqttClientService.instance) {
      MqttClientService.instance = new MqttClientService();
    }
    return MqttClientService.instance;
  }

  /**
   * 连接到MQTT代理服务器
   * @param options 连接选项
   * @returns 是否连接成功的Promise
   */
  public async connect(options: MqttConnectionOptions): Promise<boolean> {
    // 如果已经连接，先断开
    if (this.isConnected) {
      await this.disconnect();
    }

    // 保存连接选项
    this.options = {
      ...options,
      // 如果未提供客户端ID，生成一个随机的
      clientId: options.clientId || `mqtt-client-${cryptoService.generateRandomString(8)}`,
      // 默认使用清除会话
      clean: options.clean !== undefined ? options.clean : true,
      // 默认10秒心跳
      keepalive: options.keepalive || 10,
      // 默认5秒重连
      reconnectPeriod: options.reconnectPeriod || 5000,
      // 默认30秒连接超时
      connectTimeout: options.connectTimeout || 30000,
    };

    // 构建MQTT连接URL
    let url = this.options.brokerUrl;
    if (this.options.useSSL && !url.startsWith('mqtts://')) {
      url = url.replace('mqtt://', 'mqtts://');
    }

    // 构建MQTT连接选项
    const mqttOptions: mqtt.IClientOptions = {
      clientId: this.options.clientId,
      clean: this.options.clean,
      keepalive: this.options.keepalive,
      reconnectPeriod: this.options.reconnectPeriod,
      connectTimeout: this.options.connectTimeout,
    };

    // 添加认证信息
    if (this.options.username) {
      mqttOptions.username = this.options.username;
    }
    if (this.options.password) {
      mqttOptions.password = this.options.password;
    }

    // 添加遗嘱消息
    if (this.options.will) {
      mqttOptions.will = {
        topic: this.options.will.topic,
        payload: this.options.will.payload,
        qos: this.options.will.qos || 0,
        retain: this.options.will.retain || false,
      };
    }

    // 添加TLS/SSL证书
    if (this.options.certs) {
      mqttOptions.ca = this.options.certs.ca;
      mqttOptions.cert = this.options.certs.cert;
      mqttOptions.key = this.options.certs.key;
    }

    // 重置连接尝试次数
    this.connectionAttempts = 0;

    try {
      // 创建MQTT客户端
      this.client = mqtt.connect(url, mqttOptions);

      // 返回连接结果Promise
      return new Promise<boolean>((resolve, reject) => {
        // 设置连接超时
        const connectionTimeout = setTimeout(() => {
          reject(new Error('MQTT connection timeout'));
        }, this.options!.connectTimeout);

        // 连接成功处理
        this.client!.on('connect', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.connectionAttempts = 0;
          this.setupEventListeners();
          
          // 重新订阅之前的主题
          this.resubscribe();
          
          // 记录连接成功日志
          this.logConnectionEvent('connect', true);
          
          // 触发连接事件
          this.emit('connect');
          resolve(true);
        });

        // 连接错误处理
        this.client!.on('error', (err) => {
          clearTimeout(connectionTimeout);
          this.logConnectionEvent('connect', false, err);
          reject(err);
        });
      });
    } catch (error) {
      this.logConnectionEvent('connect', false, error);
      throw error;
    }
  }

  /**
   * 断开MQTT连接
   * @returns 是否断开成功的Promise
   */
  public async disconnect(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return true;
    }

    // 停止重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    return new Promise<boolean>((resolve) => {
      // 设置断开连接超时
      const disconnectTimeout = setTimeout(() => {
        this.client = null;
        this.isConnected = false;
        resolve(true);
      }, 5000);

      // 断开连接
      this.client!.end(false, () => {
        clearTimeout(disconnectTimeout);
        this.client = null;
        this.isConnected = false;
        
        // 记录断开连接日志
        this.logConnectionEvent('disconnect', true);
        
        // 触发断开连接事件
        this.emit('disconnect');
        resolve(true);
      });
    });
  }

  /**
   * 订阅主题
   * @param topic 主题
   * @param options 订阅选项
   * @param handler 消息处理函数
   * @returns 是否订阅成功的Promise
   */
  public async subscribe(
    topic: string,
    options: { qos?: 0 | 1 | 2 } = { qos: 0 },
    handler?: MqttMessageHandler
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise<boolean>((resolve, reject) => {
      this.client!.subscribe(topic, { qos: options.qos || 0 }, (err, granted) => {
        if (err) {
          this.logEvent('subscribe', false, { topic }, err);
          reject(err);
          return;
        }

        // 保存订阅信息
        if (handler) {
          this.subscriptions.set(topic, { qos: options.qos || 0, handler });
        }

        this.logEvent('subscribe', true, { topic, qos: options.qos || 0 });
        this.emit('subscribe', topic, options.qos || 0);
        resolve(true);
      });
    });
  }

  /**
   * 取消订阅主题
   * @param topic 主题
   * @returns 是否取消订阅成功的Promise
   */
  public async unsubscribe(topic: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise<boolean>((resolve, reject) => {
      this.client!.unsubscribe(topic, (err) => {
        if (err) {
          this.logEvent('unsubscribe', false, { topic }, err);
          reject(err);
          return;
        }

        // 移除订阅信息
        this.subscriptions.delete(topic);

        this.logEvent('unsubscribe', true, { topic });
        this.emit('unsubscribe', topic);
        resolve(true);
      });
    });
  }

  /**
   * 发布消息
   * @param topic 主题
   * @param payload 消息负载
   * @param options 发布选项
   * @returns 是否发布成功的Promise
   */
  public async publish(
    topic: string,
    payload: string | Buffer,
    options: { qos?: 0 | 1 | 2, retain?: boolean } = { qos: 0, retain: false }
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise<boolean>((resolve, reject) => {
      this.client!.publish(
        topic,
        payload,
        { qos: options.qos || 0, retain: options.retain || false },
        (err) => {
          if (err) {
            this.logEvent('publish', false, { topic }, err);
            reject(err);
            return;
          }

          this.logEvent('publish', true, { topic, qos: options.qos || 0 });
          this.emit('publish', topic, payload);
          resolve(true);
        }
      );
    });
  }

  /**
   * 检查是否已连接
   * @returns 是否已连接
   */
  public isClientConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * 获取当前订阅的主题列表
   * @returns 主题列表
   */
  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // 消息接收处理
    this.client.on('message', (topic, payload, packet) => {
      this.handleMessage(topic, payload, packet);
    });

    // 连接关闭处理
    this.client.on('close', () => {
      this.isConnected = false;
      this.logConnectionEvent('close', true);
      this.emit('close');
    });

    // 重连处理
    this.client.on('reconnect', () => {
      this.connectionAttempts++;
      this.logConnectionEvent('reconnect', true, { attempts: this.connectionAttempts });
      this.emit('reconnect', this.connectionAttempts);
    });

    // 错误处理
    this.client.on('error', (error) => {
      this.logConnectionEvent('error', false, error);
      this.emit('error', error);
    });

    // 离线处理
    this.client.on('offline', () => {
      this.isConnected = false;
      this.logConnectionEvent('offline', true);
      this.emit('offline');
      
      // 如果重连次数超过最大值，停止重连
      if (this.connectionAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.stopReconnect();
      }
    });
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (!this.client) return;
    
    this.client.end(true, () => {
      this.logConnectionEvent('reconnect_max_attempts', false, { attempts: this.connectionAttempts });
      this.emit('reconnect_failed');
      this.client = null;
    });
  }

  /**
   * 重新订阅之前的主题
   */
  private resubscribe(): void {
    if (!this.client || !this.isConnected || this.subscriptions.size === 0) return;

    for (const [topic, { qos }] of this.subscriptions.entries()) {
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) {
          this.logEvent('resubscribe', false, { topic }, err);
          this.emit('resubscribe_error', topic, err);
        } else {
          this.logEvent('resubscribe', true, { topic, qos });
          this.emit('resubscribe', topic);
        }
      });
    }
  }

  /**
   * 处理接收到的消息
   * @param topic 主题
   * @param payload 消息负载
   * @param packet 消息包
   */
  private handleMessage(topic: string, payload: Buffer, packet: mqtt.IPublishPacket): void {
    // 查找对应主题的处理函数
    const subscription = this.subscriptions.get(topic);
    
    // 如果有指定处理函数，调用它
    if (subscription && subscription.handler) {
      try {
        subscription.handler(topic, payload, packet);
      } catch (error) {
        this.logEvent('message_handler_error', false, { topic }, error);
        this.emit('message_error', topic, error);
      }
    }
    
    // 触发消息事件
    this.emit('message', topic, payload, packet);
  }

  /**
   * 记录连接相关事件
   * @param eventType 事件类型
   * @param success 是否成功
   * @param error 错误信息
   */
  private logConnectionEvent(eventType: string, success: boolean, error?: any): void {
    const level = success ? AuditLogLevel.INFO : AuditLogLevel.ERROR;
    const description = success 
      ? `MQTT ${eventType} 成功` 
      : `MQTT ${eventType} 失败`;
    
    auditLogService.logSecurityEvent(
      AuditEventType.DEVICE_ONLINE, // 使用设备在线事件类型
      level,
      description,
      undefined,
      undefined,
      {
        eventType,
        brokerUrl: this.options?.brokerUrl,
        clientId: this.options?.clientId,
        error: error ? (error.message || String(error)) : undefined
      }
    ).catch(console.error);
  }

  /**
   * 记录MQTT操作事件
   * @param eventType 事件类型
   * @param success 是否成功
   * @param details 详细信息
   * @param error 错误信息
   */
  private logEvent(eventType: string, success: boolean, details?: any, error?: any): void {
    const level = success ? AuditLogLevel.INFO : AuditLogLevel.WARNING;
    const description = success 
      ? `MQTT ${eventType} 成功` 
      : `MQTT ${eventType} 失败`;
    
    auditLogService.logSecurityEvent(
      AuditEventType.DEVICE_UPDATE, // 使用设备更新事件类型
      level,
      description,
      undefined,
      undefined,
      {
        eventType,
        ...details,
        error: error ? (error.message || String(error)) : undefined
      }
    ).catch(console.error);
  }
}

// 导出单例实例
export const mqttClient = MqttClientService.getInstance();

export default mqttClient; 