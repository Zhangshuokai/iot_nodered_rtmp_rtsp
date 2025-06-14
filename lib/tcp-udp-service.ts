/**
 * TCP/UDP服务 - 实现TCP和UDP协议的服务器和客户端功能
 * 
 * 该服务实现了以下功能：
 * 1. TCP服务器创建与管理
 * 2. TCP客户端连接与通信
 * 3. UDP服务器创建与管理
 * 4. UDP客户端通信
 * 5. 数据解析与处理
 * 6. 连接管理与事件处理
 */

import * as net from 'net';
import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { cryptoService } from './crypto-service';
import { auditLogService, AuditEventType, AuditLogLevel } from './audit-log-service';

/**
 * TCP服务器配置选项
 */
export interface TcpServerOptions {
  // 监听端口
  port: number;
  // 监听地址
  host?: string;
  // 是否启用保持连接
  keepAlive?: boolean;
  // 保持连接初始延迟（毫秒）
  keepAliveInitialDelay?: number;
  // 是否启用Nagle算法
  noDelay?: boolean;
  // 连接超时时间（毫秒）
  timeout?: number;
  // 最大连接数
  maxConnections?: number;
  // 是否允许半打开连接
  allowHalfOpen?: boolean;
}

/**
 * TCP客户端配置选项
 */
export interface TcpClientOptions {
  // 服务器端口
  port: number;
  // 服务器地址
  host: string;
  // 是否启用保持连接
  keepAlive?: boolean;
  // 保持连接初始延迟（毫秒）
  keepAliveInitialDelay?: number;
  // 是否启用Nagle算法
  noDelay?: boolean;
  // 连接超时时间（毫秒）
  timeout?: number;
  // 是否允许半打开连接
  allowHalfOpen?: boolean;
}

/**
 * UDP服务器配置选项
 */
export interface UdpServerOptions {
  // 监听端口
  port: number;
  // 监听地址
  host?: string;
  // 是否启用广播
  broadcast?: boolean;
  // 是否启用IPv6
  ipv6Only?: boolean;
  // 接收缓冲区大小
  recvBufferSize?: number;
  // 发送缓冲区大小
  sendBufferSize?: number;
}

/**
 * UDP客户端配置选项
 */
export interface UdpClientOptions {
  // 是否启用广播
  broadcast?: boolean;
  // 是否启用IPv6
  ipv6Only?: boolean;
  // 接收缓冲区大小
  recvBufferSize?: number;
  // 发送缓冲区大小
  sendBufferSize?: number;
  // UDP类型（udp4或udp6）
  type?: 'udp4' | 'udp6';
}

/**
 * 连接信息
 */
export interface ConnectionInfo {
  // 连接ID
  id: string;
  // 远程地址
  remoteAddress: string;
  // 远程端口
  remotePort: number;
  // 本地地址
  localAddress: string;
  // 本地端口
  localPort: number;
  // 连接时间
  connectedAt: Date;
  // 最后活动时间
  lastActivityAt: Date;
  // 接收的字节数
  bytesReceived: number;
  // 发送的字节数
  bytesSent: number;
}

/**
 * TCP服务类
 */
export class TcpService extends EventEmitter {
  private static instance: TcpService;
  private servers: Map<number, net.Server> = new Map();
  private clients: Map<string, net.Socket> = new Map();
  private connections: Map<string, ConnectionInfo> = new Map();

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    super();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TcpService {
    if (!TcpService.instance) {
      TcpService.instance = new TcpService();
    }
    return TcpService.instance;
  }

  /**
   * 创建TCP服务器
   * @param options TCP服务器配置选项
   * @returns 服务器实例
   */
  public createServer(options: TcpServerOptions): net.Server {
    // 如果已存在相同端口的服务器，先关闭它
    if (this.servers.has(options.port)) {
      this.closeServer(options.port);
    }

    // 创建服务器
    const server = net.createServer({
      allowHalfOpen: options.allowHalfOpen,
    });

    // 设置最大连接数
    if (options.maxConnections) {
      server.maxConnections = options.maxConnections;
    }

    // 监听连接事件
    server.on('connection', (socket) => this.handleConnection(socket, options));

    // 监听错误事件
    server.on('error', (error) => {
      this.logEvent('server_error', false, { port: options.port }, error);
      this.emit('server_error', options.port, error);
    });

    // 监听关闭事件
    server.on('close', () => {
      this.logEvent('server_close', true, { port: options.port });
      this.servers.delete(options.port);
      this.emit('server_close', options.port);
    });

    // 开始监听
    server.listen(options.port, options.host || '0.0.0.0', () => {
      this.logEvent('server_listen', true, { port: options.port, host: options.host || '0.0.0.0' });
      this.emit('server_listen', options.port);
    });

    // 保存服务器实例
    this.servers.set(options.port, server);

    return server;
  }

  /**
   * 关闭TCP服务器
   * @param port 服务器端口
   * @returns 是否关闭成功
   */
  public closeServer(port: number): boolean {
    const server = this.servers.get(port);
    if (!server) {
      return false;
    }

    // 关闭服务器
    server.close(() => {
      this.logEvent('server_close', true, { port });
      this.servers.delete(port);
      this.emit('server_close', port);
    });

    return true;
  }

  /**
   * 创建TCP客户端连接
   * @param options TCP客户端配置选项
   * @returns 客户端Socket
   */
  public createClient(options: TcpClientOptions): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      // 创建客户端Socket
      const client = new net.Socket({
        allowHalfOpen: options.allowHalfOpen,
      });

      // 设置Socket选项
      if (options.keepAlive) {
        client.setKeepAlive(true, options.keepAliveInitialDelay);
      }
      if (options.noDelay !== undefined) {
        client.setNoDelay(options.noDelay);
      }
      if (options.timeout) {
        client.setTimeout(options.timeout);
      }

      // 生成客户端ID
      const clientId = `tcp-client-${options.host}-${options.port}-${cryptoService.generateRandomString(8)}`;

      // 连接超时处理
      const connectionTimeout = setTimeout(() => {
        client.destroy();
        this.logEvent('client_connect', false, { host: options.host, port: options.port }, new Error('Connection timeout'));
        reject(new Error('Connection timeout'));
      }, options.timeout || 10000);

      // 监听连接事件
      client.connect(options.port, options.host, () => {
        clearTimeout(connectionTimeout);

        // 保存连接信息
        this.saveClientConnection(clientId, client);

        // 设置事件监听器
        this.setupClientEventListeners(clientId, client);

        this.logEvent('client_connect', true, { host: options.host, port: options.port });
        this.emit('client_connect', clientId, options.host, options.port);
        
        resolve(client);
      });

      // 监听错误事件
      client.on('error', (error) => {
        clearTimeout(connectionTimeout);
        this.logEvent('client_connect', false, { host: options.host, port: options.port }, error);
        reject(error);
      });
    });
  }

  /**
   * 关闭TCP客户端连接
   * @param clientId 客户端ID
   * @returns 是否关闭成功
   */
  public closeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    // 关闭客户端连接
    client.end();
    client.destroy();

    // 清理连接信息
    this.clients.delete(clientId);
    this.connections.delete(clientId);

    this.logEvent('client_close', true, { clientId });
    this.emit('client_close', clientId);

    return true;
  }

  /**
   * 发送数据到TCP客户端
   * @param clientId 客户端ID
   * @param data 数据
   * @returns 是否发送成功
   */
  public sendToClient(clientId: string, data: string | Buffer): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    // 发送数据
    const success = client.write(data);
    
    // 更新连接信息
    const connectionInfo = this.connections.get(clientId);
    if (connectionInfo) {
      connectionInfo.lastActivityAt = new Date();
      connectionInfo.bytesSent += data instanceof Buffer ? data.length : Buffer.from(data).length;
    }

    return success;
  }

  /**
   * 获取所有TCP服务器
   * @returns 服务器映射表
   */
  public getServers(): Map<number, net.Server> {
    return new Map(this.servers);
  }

  /**
   * 获取所有TCP客户端
   * @returns 客户端映射表
   */
  public getClients(): Map<string, net.Socket> {
    return new Map(this.clients);
  }

  /**
   * 获取所有连接信息
   * @returns 连接信息映射表
   */
  public getConnections(): Map<string, ConnectionInfo> {
    return new Map(this.connections);
  }

  /**
   * 处理新的TCP连接
   * @param socket 客户端Socket
   * @param options 服务器选项
   */
  private handleConnection(socket: net.Socket, options: TcpServerOptions): void {
    // 生成连接ID
    const connectionId = `tcp-server-${socket.remoteAddress}-${socket.remotePort}-${cryptoService.generateRandomString(8)}`;
    
    // 设置Socket选项
    if (options.keepAlive) {
      socket.setKeepAlive(true, options.keepAliveInitialDelay);
    }
    if (options.noDelay !== undefined) {
      socket.setNoDelay(options.noDelay);
    }
    if (options.timeout) {
      socket.setTimeout(options.timeout);
    }

    // 保存连接信息
    this.saveClientConnection(connectionId, socket);

    // 设置事件监听器
    this.setupClientEventListeners(connectionId, socket);

    this.logEvent('connection', true, { 
      remoteAddress: socket.remoteAddress, 
      remotePort: socket.remotePort,
      localAddress: socket.localAddress,
      localPort: socket.localPort
    });
    
    // 触发连接事件
    this.emit('connection', connectionId, socket);
  }

  /**
   * 保存客户端连接信息
   * @param connectionId 连接ID
   * @param socket 客户端Socket
   */
  private saveClientConnection(connectionId: string, socket: net.Socket): void {
    // 保存客户端Socket
    this.clients.set(connectionId, socket);

    // 保存连接信息
    this.connections.set(connectionId, {
      id: connectionId,
      remoteAddress: socket.remoteAddress || 'unknown',
      remotePort: socket.remotePort || 0,
      localAddress: socket.localAddress || 'unknown',
      localPort: socket.localPort || 0,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      bytesReceived: 0,
      bytesSent: 0
    });
  }

  /**
   * 设置客户端事件监听器
   * @param connectionId 连接ID
   * @param socket 客户端Socket
   */
  private setupClientEventListeners(connectionId: string, socket: net.Socket): void {
    // 监听数据事件
    socket.on('data', (data) => {
      // 更新连接信息
      const connectionInfo = this.connections.get(connectionId);
      if (connectionInfo) {
        connectionInfo.lastActivityAt = new Date();
        connectionInfo.bytesReceived += data.length;
      }

      // 触发数据事件
      this.emit('data', connectionId, data);
    });

    // 监听关闭事件
    socket.on('close', (hadError) => {
      // 清理连接信息
      this.clients.delete(connectionId);
      this.connections.delete(connectionId);

      this.logEvent('socket_close', true, { connectionId, hadError });
      
      // 触发关闭事件
      this.emit('socket_close', connectionId, hadError);
    });

    // 监听错误事件
    socket.on('error', (error) => {
      this.logEvent('socket_error', false, { connectionId }, error);
      
      // 触发错误事件
      this.emit('socket_error', connectionId, error);
    });

    // 监听超时事件
    socket.on('timeout', () => {
      this.logEvent('socket_timeout', true, { connectionId });
      
      // 触发超时事件
      this.emit('socket_timeout', connectionId);
      
      // 关闭超时连接
      socket.end();
    });
  }

  /**
   * 记录事件日志
   * @param eventType 事件类型
   * @param success 是否成功
   * @param details 详细信息
   * @param error 错误信息
   */
  private logEvent(eventType: string, success: boolean, details?: any, error?: any): void {
    const level = success ? AuditLogLevel.INFO : AuditLogLevel.WARNING;
    const description = success 
      ? `TCP ${eventType} 成功` 
      : `TCP ${eventType} 失败`;
    
    auditLogService.logSecurityEvent(
      AuditEventType.DEVICE_UPDATE,
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

/**
 * UDP服务类
 */
export class UdpService extends EventEmitter {
  private static instance: UdpService;
  private servers: Map<number, dgram.Socket> = new Map();
  private clients: Map<string, dgram.Socket> = new Map();

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    super();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): UdpService {
    if (!UdpService.instance) {
      UdpService.instance = new UdpService();
    }
    return UdpService.instance;
  }

  /**
   * 创建UDP服务器
   * @param options UDP服务器配置选项
   * @returns UDP服务器Socket
   */
  public createServer(options: UdpServerOptions): Promise<dgram.Socket> {
    return new Promise((resolve, reject) => {
      // 如果已存在相同端口的服务器，先关闭它
      if (this.servers.has(options.port)) {
        this.closeServer(options.port);
      }

      // 创建UDP服务器Socket
      const server = dgram.createSocket({
        type: options.ipv6Only ? 'udp6' : 'udp4',
        reuseAddr: true,
        recvBufferSize: options.recvBufferSize,
        sendBufferSize: options.sendBufferSize
      });

      // 设置广播
      if (options.broadcast) {
        server.setBroadcast(true);
      }

      // 监听错误事件
      server.on('error', (error) => {
        this.logEvent('server_error', false, { port: options.port }, error);
        this.emit('server_error', options.port, error);
        reject(error);
      });

      // 监听消息事件
      server.on('message', (msg, rinfo) => {
        this.logEvent('message', true, { 
          port: options.port,
          remoteAddress: rinfo.address,
          remotePort: rinfo.port,
          size: msg.length
        });
        
        // 触发消息事件
        this.emit('message', options.port, msg, rinfo);
      });

      // 监听监听事件
      server.on('listening', () => {
        const address = server.address();
        this.logEvent('server_listen', true, { 
          port: address.port,
          address: address.address,
          family: address.family
        });
        
        // 保存服务器实例
        this.servers.set(options.port, server);
        
        // 触发监听事件
        this.emit('server_listen', options.port);
        
        resolve(server);
      });

      // 监听关闭事件
      server.on('close', () => {
        this.logEvent('server_close', true, { port: options.port });
        this.servers.delete(options.port);
        this.emit('server_close', options.port);
      });

      // 绑定端口
      server.bind(options.port, options.host);
    });
  }

  /**
   * 关闭UDP服务器
   * @param port 服务器端口
   * @returns 是否关闭成功
   */
  public closeServer(port: number): boolean {
    const server = this.servers.get(port);
    if (!server) {
      return false;
    }

    // 关闭服务器
    server.close(() => {
      this.logEvent('server_close', true, { port });
      this.servers.delete(port);
      this.emit('server_close', port);
    });

    return true;
  }

  /**
   * 创建UDP客户端
   * @param options UDP客户端配置选项
   * @returns UDP客户端Socket
   */
  public createClient(options: UdpClientOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      // 创建UDP客户端Socket
      const client = dgram.createSocket({
        type: options.type || 'udp4',
        reuseAddr: true,
        recvBufferSize: options.recvBufferSize,
        sendBufferSize: options.sendBufferSize
      });

      // 设置广播
      if (options.broadcast) {
        client.setBroadcast(true);
      }

      // 生成客户端ID
      const clientId = `udp-client-${cryptoService.generateRandomString(8)}`;

      // 监听错误事件
      client.on('error', (error) => {
        this.logEvent('client_error', false, { clientId }, error);
        this.emit('client_error', clientId, error);
        reject(error);
      });

      // 监听消息事件
      client.on('message', (msg, rinfo) => {
        this.logEvent('client_message', true, { 
          clientId,
          remoteAddress: rinfo.address,
          remotePort: rinfo.port,
          size: msg.length
        });
        
        // 触发消息事件
        this.emit('client_message', clientId, msg, rinfo);
      });

      // 监听关闭事件
      client.on('close', () => {
        this.logEvent('client_close', true, { clientId });
        this.clients.delete(clientId);
        this.emit('client_close', clientId);
      });

      // 保存客户端实例
      this.clients.set(clientId, client);
      
      this.logEvent('client_create', true, { clientId });
      this.emit('client_create', clientId);
      
      resolve(clientId);
    });
  }

  /**
   * 关闭UDP客户端
   * @param clientId 客户端ID
   * @returns 是否关闭成功
   */
  public closeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    // 关闭客户端
    client.close(() => {
      this.logEvent('client_close', true, { clientId });
      this.clients.delete(clientId);
      this.emit('client_close', clientId);
    });

    return true;
  }

  /**
   * 发送UDP消息
   * @param clientId 客户端ID
   * @param msg 消息
   * @param port 目标端口
   * @param address 目标地址
   * @returns 是否发送成功的Promise
   */
  public send(clientId: string, msg: string | Buffer, port: number, address: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const client = this.clients.get(clientId);
      if (!client) {
        reject(new Error(`UDP client ${clientId} not found`));
        return;
      }

      const buffer = typeof msg === 'string' ? Buffer.from(msg) : msg;

      client.send(buffer, 0, buffer.length, port, address, (error) => {
        if (error) {
          this.logEvent('send', false, { clientId, address, port }, error);
          reject(error);
          return;
        }

        this.logEvent('send', true, { clientId, address, port, size: buffer.length });
        this.emit('send', clientId, buffer, port, address);
        resolve(true);
      });
    });
  }

  /**
   * 从UDP服务器发送消息
   * @param port 服务器端口
   * @param msg 消息
   * @param targetPort 目标端口
   * @param targetAddress 目标地址
   * @returns 是否发送成功的Promise
   */
  public sendFromServer(port: number, msg: string | Buffer, targetPort: number, targetAddress: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const server = this.servers.get(port);
      if (!server) {
        reject(new Error(`UDP server on port ${port} not found`));
        return;
      }

      const buffer = typeof msg === 'string' ? Buffer.from(msg) : msg;

      server.send(buffer, 0, buffer.length, targetPort, targetAddress, (error) => {
        if (error) {
          this.logEvent('server_send', false, { port, targetAddress, targetPort }, error);
          reject(error);
          return;
        }

        this.logEvent('server_send', true, { port, targetAddress, targetPort, size: buffer.length });
        this.emit('server_send', port, buffer, targetPort, targetAddress);
        resolve(true);
      });
    });
  }

  /**
   * 获取所有UDP服务器
   * @returns 服务器映射表
   */
  public getServers(): Map<number, dgram.Socket> {
    return new Map(this.servers);
  }

  /**
   * 获取所有UDP客户端
   * @returns 客户端映射表
   */
  public getClients(): Map<string, dgram.Socket> {
    return new Map(this.clients);
  }

  /**
   * 记录事件日志
   * @param eventType 事件类型
   * @param success 是否成功
   * @param details 详细信息
   * @param error 错误信息
   */
  private logEvent(eventType: string, success: boolean, details?: any, error?: any): void {
    const level = success ? AuditLogLevel.INFO : AuditLogLevel.WARNING;
    const description = success 
      ? `UDP ${eventType} 成功` 
      : `UDP ${eventType} 失败`;
    
    auditLogService.logSecurityEvent(
      AuditEventType.DEVICE_UPDATE,
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
export const tcpService = TcpService.getInstance();
export const udpService = UdpService.getInstance();

export default {
  tcpService,
  udpService
}; 