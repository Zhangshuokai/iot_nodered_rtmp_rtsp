import prisma from './db-prisma';
import { Device, DeviceClass, DeviceCommand, DeviceEvent, DeviceAlarm, DeviceConnection, Prisma } from '@prisma/client';

/**
 * 设备服务类
 * 提供设备相关的数据库操作方法
 */
export class DeviceService {
  /**
   * 获取所有设备列表
   * @param organizationId 组织ID，用于筛选特定组织的设备
   * @param options 查询选项，包括分页、排序等
   * @returns 设备列表
   */
  async getAllDevices(
    organizationId?: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DeviceOrderByWithRelationInput;
      where?: Prisma.DeviceWhereInput;
      include?: Prisma.DeviceInclude;
    }
  ): Promise<Device[]> {
    try {
      const where: Prisma.DeviceWhereInput = {
        ...(organizationId ? { organizationId } : {}),
        ...(options?.where || {}),
      };

      return await prisma.device.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy,
        include: options?.include,
      });
    } catch (error) {
      console.error('获取设备列表失败:', error);
      throw new Error('获取设备列表失败');
    }
  }

  /**
   * 获取设备总数
   * @param organizationId 组织ID
   * @param where 查询条件
   * @returns 设备总数
   */
  async countDevices(
    organizationId?: string,
    where?: Prisma.DeviceWhereInput
  ): Promise<number> {
    try {
      return await prisma.device.count({
        where: {
          ...(organizationId ? { organizationId } : {}),
          ...where,
        },
      });
    } catch (error) {
      console.error('获取设备总数失败:', error);
      throw new Error('获取设备总数失败');
    }
  }

  /**
   * 根据ID获取设备详情
   * @param id 设备ID
   * @param include 关联查询选项
   * @returns 设备详情
   */
  async getDeviceById(
    id: string,
    include?: Prisma.DeviceInclude
  ): Promise<Device | null> {
    try {
      return await prisma.device.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      console.error(`获取设备 ${id} 详情失败:`, error);
      throw new Error('获取设备详情失败');
    }
  }

  /**
   * 创建设备
   * @param data 设备数据
   * @returns 创建的设备
   */
  async createDevice(data: Prisma.DeviceCreateInput): Promise<Device> {
    try {
      return await prisma.device.create({
        data,
      });
    } catch (error) {
      console.error('创建设备失败:', error);
      throw new Error('创建设备失败');
    }
  }

  /**
   * 更新设备
   * @param id 设备ID
   * @param data 更新的设备数据
   * @returns 更新后的设备
   */
  async updateDevice(
    id: string,
    data: Prisma.DeviceUpdateInput
  ): Promise<Device> {
    try {
      return await prisma.device.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(`更新设备 ${id} 失败:`, error);
      throw new Error('更新设备失败');
    }
  }

  /**
   * 删除设备
   * @param id 设备ID
   * @returns 删除的设备
   */
  async deleteDevice(id: string): Promise<Device> {
    try {
      return await prisma.device.delete({
        where: { id },
      });
    } catch (error) {
      console.error(`删除设备 ${id} 失败:`, error);
      throw new Error('删除设备失败');
    }
  }

  /**
   * 更新设备状态
   * @param id 设备ID
   * @param status 设备状态
   * @param connectionTime 连接时间
   * @returns 更新后的设备
   */
  async updateDeviceStatus(
    id: string,
    status: 'ONLINE' | 'OFFLINE' | 'ERROR',
    connectionTime: Date = new Date()
  ): Promise<Device> {
    try {
      // 开启事务，同时更新设备状态和添加连接记录
      return await prisma.$transaction(async (tx) => {
        // 更新设备状态
        const device = await tx.device.update({
          where: { id },
          data: {
            status,
            ...(status === 'ONLINE'
              ? { lastConnected: connectionTime }
              : { lastDisconnected: connectionTime }),
          },
        });

        // 添加连接记录
        await tx.deviceConnection.create({
          data: {
            deviceId: id,
            connectionType: status === 'ONLINE' ? 'CONNECT' : 'DISCONNECT',
            connectionTime,
          },
        });

        return device;
      });
    } catch (error) {
      console.error(`更新设备 ${id} 状态失败:`, error);
      throw new Error('更新设备状态失败');
    }
  }

  /**
   * 获取设备的连接记录
   * @param deviceId 设备ID
   * @param options 查询选项
   * @returns 连接记录列表
   */
  async getDeviceConnections(
    deviceId: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DeviceConnectionOrderByWithRelationInput;
    }
  ): Promise<DeviceConnection[]> {
    try {
      return await prisma.deviceConnection.findMany({
        where: { deviceId },
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy || { connectionTime: 'desc' },
      });
    } catch (error) {
      console.error(`获取设备 ${deviceId} 连接记录失败:`, error);
      throw new Error('获取设备连接记录失败');
    }
  }

  /**
   * 获取设备的命令记录
   * @param deviceId 设备ID
   * @param options 查询选项
   * @returns 命令记录列表
   */
  async getDeviceCommands(
    deviceId: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DeviceCommandOrderByWithRelationInput;
    }
  ): Promise<DeviceCommand[]> {
    try {
      return await prisma.deviceCommand.findMany({
        where: { deviceId },
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy || { createdAt: 'desc' },
      });
    } catch (error) {
      console.error(`获取设备 ${deviceId} 命令记录失败:`, error);
      throw new Error('获取设备命令记录失败');
    }
  }

  /**
   * 创建设备命令
   * @param data 命令数据
   * @returns 创建的命令
   */
  async createDeviceCommand(
    data: Prisma.DeviceCommandCreateInput
  ): Promise<DeviceCommand> {
    try {
      return await prisma.deviceCommand.create({
        data,
      });
    } catch (error) {
      console.error('创建设备命令失败:', error);
      throw new Error('创建设备命令失败');
    }
  }

  /**
   * 更新设备命令状态
   * @param id 命令ID
   * @param status 命令状态
   * @param responseContent 响应内容
   * @returns 更新后的命令
   */
  async updateDeviceCommandStatus(
    id: string,
    status: 'SENT' | 'RECEIVED' | 'EXECUTED' | 'FAILED',
    responseContent?: any
  ): Promise<DeviceCommand> {
    try {
      return await prisma.deviceCommand.update({
        where: { id },
        data: {
          status,
          ...(responseContent ? { responseContent } : {}),
        },
      });
    } catch (error) {
      console.error(`更新命令 ${id} 状态失败:`, error);
      throw new Error('更新命令状态失败');
    }
  }

  /**
   * 获取设备的告警记录
   * @param deviceId 设备ID
   * @param options 查询选项
   * @returns 告警记录列表
   */
  async getDeviceAlarms(
    deviceId: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.DeviceAlarmOrderByWithRelationInput;
      where?: Prisma.DeviceAlarmWhereInput;
    }
  ): Promise<DeviceAlarm[]> {
    try {
      return await prisma.deviceAlarm.findMany({
        where: {
          deviceId,
          ...(options?.where || {}),
        },
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy || { createdAt: 'desc' },
        include: {
          confirmedUser: true,
          scene: true,
        },
      });
    } catch (error) {
      console.error(`获取设备 ${deviceId} 告警记录失败:`, error);
      throw new Error('获取设备告警记录失败');
    }
  }

  /**
   * 创建设备告警
   * @param data 告警数据
   * @returns 创建的告警
   */
  async createDeviceAlarm(
    data: Prisma.DeviceAlarmCreateInput
  ): Promise<DeviceAlarm> {
    try {
      return await prisma.deviceAlarm.create({
        data,
      });
    } catch (error) {
      console.error('创建设备告警失败:', error);
      throw new Error('创建设备告警失败');
    }
  }

  /**
   * 确认设备告警
   * @param id 告警ID
   * @param userId 确认用户ID
   * @returns 更新后的告警
   */
  async confirmDeviceAlarm(
    id: string,
    userId: string
  ): Promise<DeviceAlarm> {
    try {
      return await prisma.deviceAlarm.update({
        where: { id },
        data: {
          isConfirmed: true,
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`确认告警 ${id} 失败:`, error);
      throw new Error('确认告警失败');
    }
  }
}

// 导出设备服务实例
const deviceService = new DeviceService();
export default deviceService; 