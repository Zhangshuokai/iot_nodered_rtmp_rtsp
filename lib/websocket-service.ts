import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { AuthService } from './auth';
import { PermissionService } from './permission-service';

/**
 * WebSocket服务类
 * 提供WebSocket服务器的创建和管理功能
 */
export class WebSocketService {
  private io: SocketIOServer | null = null;
  private static instance: WebSocketService | null = null;
  private roomPermissions: Map<string, string> = new Map();

  /**
   * 获取WebSocketService单例
   * @returns WebSocketService实例
   */
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * 初始化WebSocket服务
   * @param server HTTP服务器实例
   */
  init(server: HttpServer): void {
    if (this.io) {
      console.warn('WebSocket服务已初始化');
      return;
    }

    // 创建Socket.IO服务器
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/api/ws',
    });

    // 配置命名空间和中间件
    this.configureNamespaces();

    console.log('WebSocket服务已初始化');
  }

  /**
   * 配置Socket.IO命名空间
   */
  private configureNamespaces(): void {
    if (!this.io) {
      throw new Error('WebSocket服务未初始化');
    }

    // 设备数据命名空间
    const deviceNamespace = this.io.of('/devices');
    deviceNamespace.use(this.authMiddleware);
    deviceNamespace.on('connection', (socket) => {
      console.log(`设备命名空间新连接: ${socket.id}`);

      // 订阅设备数据
      socket.on('subscribe', async (deviceId: string) => {
        try {
          const userId = socket.data.userId;
          // 检查用户是否有权限访问该设备
          const permissionService = new PermissionService();
          const hasPermission = await permissionService.hasPermission(userId, 'device:view');

          if (hasPermission) {
            const roomName = `device:${deviceId}`;
            socket.join(roomName);
            console.log(`用户 ${userId} 订阅了设备 ${deviceId}`);
            socket.emit('subscribed', { deviceId });
          } else {
            socket.emit('error', { message: '没有权限订阅该设备' });
          }
        } catch (error) {
          console.error('设备订阅错误:', error);
          socket.emit('error', { message: '订阅设备失败' });
        }
      });

      // 取消订阅设备数据
      socket.on('unsubscribe', (deviceId: string) => {
        const roomName = `device:${deviceId}`;
        socket.leave(roomName);
        console.log(`用户 ${socket.data.userId} 取消订阅了设备 ${deviceId}`);
        socket.emit('unsubscribed', { deviceId });
      });

      // 断开连接
      socket.on('disconnect', () => {
        console.log(`设备命名空间连接断开: ${socket.id}`);
      });
    });

    // 告警命名空间
    const alertNamespace = this.io.of('/alerts');
    alertNamespace.use(this.authMiddleware);
    alertNamespace.on('connection', (socket) => {
      console.log(`告警命名空间新连接: ${socket.id}`);

      // 订阅告警
      socket.on('subscribe', async (filter: { organizationId?: string }) => {
        try {
          const userId = socket.data.userId;
          // 检查用户是否有权限接收告警
          const permissionService = new PermissionService();
          const hasPermission = await permissionService.hasPermission(userId, 'alert:view');

          if (hasPermission) {
            let roomName = 'alerts:all';
            
            if (filter.organizationId) {
              roomName = `alerts:org:${filter.organizationId}`;
            }
            
            socket.join(roomName);
            console.log(`用户 ${userId} 订阅了告警 ${roomName}`);
            socket.emit('subscribed', { filter });
          } else {
            socket.emit('error', { message: '没有权限订阅告警' });
          }
        } catch (error) {
          console.error('告警订阅错误:', error);
          socket.emit('error', { message: '订阅告警失败' });
        }
      });

      // 断开连接
      socket.on('disconnect', () => {
        console.log(`告警命名空间连接断开: ${socket.id}`);
      });
    });

    // 系统通知命名空间
    const notificationNamespace = this.io.of('/notifications');
    notificationNamespace.use(this.authMiddleware);
    notificationNamespace.on('connection', (socket) => {
      console.log(`通知命名空间新连接: ${socket.id}`);

      // 订阅用户通知
      socket.on('subscribe', async () => {
        try {
          const userId = socket.data.userId;
          const roomName = `notifications:user:${userId}`;
          
          socket.join(roomName);
          console.log(`用户 ${userId} 订阅了通知`);
          socket.emit('subscribed', { userId });
        } catch (error) {
          console.error('通知订阅错误:', error);
          socket.emit('error', { message: '订阅通知失败' });
        }
      });

      // 断开连接
      socket.on('disconnect', () => {
        console.log(`通知命名空间连接断开: ${socket.id}`);
      });
    });
  }

  /**
   * 认证中间件
   * 验证WebSocket连接的JWT令牌
   */
  private authMiddleware = async (socket: any, next: (err?: Error) => void) => {
    try {
      // 从握手请求中获取token
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('未提供认证令牌'));
      }

      try {
        // 验证令牌
        const decoded = AuthService.verifyToken(token);
        
        // 将用户ID保存到socket数据中
        socket.data.userId = decoded.id;
        socket.data.user = decoded;
        
        next();
      } catch (error) {
        return next(new Error('无效的认证令牌'));
      }
    } catch (error) {
      console.error('WebSocket认证错误:', error);
      return next(new Error('认证失败'));
    }
  };

  /**
   * 发送设备数据更新
   * @param deviceId 设备ID
   * @param data 设备数据
   */
  sendDeviceUpdate(deviceId: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return;
    }

    const roomName = `device:${deviceId}`;
    this.io.of('/devices').to(roomName).emit('deviceUpdate', {
      deviceId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * 发送设备状态变更
   * @param deviceId 设备ID
   * @param status 设备状态
   */
  sendDeviceStatusChange(deviceId: string, status: string): void {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return;
    }

    const roomName = `device:${deviceId}`;
    this.io.of('/devices').to(roomName).emit('statusChange', {
      deviceId,
      timestamp: new Date().toISOString(),
      status,
    });
  }

  /**
   * 发送告警通知
   * @param alert 告警信息
   */
  sendAlert(alert: any): void {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return;
    }

    // 发送到全局告警频道
    this.io.of('/alerts').to('alerts:all').emit('newAlert', alert);

    // 如果有组织ID，还发送到组织特定频道
    if (alert.organizationId) {
      const orgRoomName = `alerts:org:${alert.organizationId}`;
      this.io.of('/alerts').to(orgRoomName).emit('newAlert', alert);
    }
  }

  /**
   * 发送用户通知
   * @param userId 用户ID
   * @param notification 通知信息
   */
  sendUserNotification(userId: string, notification: any): void {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return;
    }

    const roomName = `notifications:user:${userId}`;
    this.io.of('/notifications').to(roomName).emit('newNotification', notification);
  }

  /**
   * 广播系统通知
   * @param notification 通知信息
   */
  broadcastSystemNotification(notification: any): void {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return;
    }

    this.io.of('/notifications').emit('systemNotification', notification);
  }

  /**
   * 获取命名空间连接数
   * @param namespace 命名空间
   * @returns 连接数
   */
  getConnectionCount(namespace: string): number {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return 0;
    }

    return this.io.of(namespace).sockets.size;
  }

  /**
   * 获取房间连接数
   * @param namespace 命名空间
   * @param room 房间名
   * @returns 连接数
   */
  async getRoomSize(namespace: string, room: string): Promise<number> {
    if (!this.io) {
      console.warn('WebSocket服务未初始化');
      return 0;
    }

    const sockets = await this.io.of(namespace).in(room).fetchSockets();
    return sockets.length;
  }

  /**
   * 关闭WebSocket服务
   */
  close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      console.log('WebSocket服务已关闭');
    }
  }
} 