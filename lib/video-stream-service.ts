/**
 * 视频流服务
 * 基于EasyPlayer-pro实现视频流处理，支持WebSocket和HTTP方式
 */

import { PrismaClient, StreamType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService, AuditEventType, AuditLogLevel } from './audit-log-service';

const prisma = new PrismaClient();
const auditLog = AuditLogService.getInstance();

/**
 * 视频流服务类
 * 提供视频流配置管理和处理功能
 */
export class VideoStreamService {
  /**
   * 创建视频配置
   * @param data 视频配置数据
   * @returns 创建的视频配置
   */
  async createVideoConfig(data: any, userId: string) {
    try {
      const videoConfig = await prisma.videoConfig.create({
        data: {
          name: data.name,
          cover: data.cover,
          cameraCode: data.cameraCode,
          streamUrl: data.streamUrl,
          streamType: data.streamType as StreamType,
          status: data.status ?? true,
          organizationId: data.organizationId,
        },
      });

      await auditLog.log({
        userId,
        eventType: AuditEventType.DEVICE_CREATE,
        level: AuditLogLevel.INFO,
        resourceType: 'VideoConfig',
        resourceId: videoConfig.id,
        description: `Created video configuration: ${data.name}`,
      });

      return videoConfig;
    } catch (error) {
      console.error('Error creating video config:', error);
      throw new Error('Failed to create video configuration');
    }
  }

  /**
   * 获取视频配置列表
   * @param organizationId 组织ID
   * @returns 视频配置列表
   */
  async getVideoConfigs(organizationId: string) {
    try {
      const videoConfigs = await prisma.videoConfig.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return videoConfigs;
    } catch (error) {
      console.error('Error getting video configs:', error);
      throw new Error('Failed to get video configurations');
    }
  }

  /**
   * 获取单个视频配置
   * @param id 视频配置ID
   * @returns 视频配置
   */
  async getVideoConfig(id: string) {
    try {
      const videoConfig = await prisma.videoConfig.findUnique({
        where: {
          id,
        },
      });

      if (!videoConfig) {
        throw new Error('Video configuration not found');
      }

      return videoConfig;
    } catch (error) {
      console.error('Error getting video config:', error);
      throw new Error('Failed to get video configuration');
    }
  }

  /**
   * 更新视频配置
   * @param id 视频配置ID
   * @param data 更新数据
   * @returns 更新后的视频配置
   */
  async updateVideoConfig(id: string, data: any, userId: string) {
    try {
      const videoConfig = await prisma.videoConfig.update({
        where: {
          id,
        },
        data: {
          name: data.name,
          cover: data.cover,
          cameraCode: data.cameraCode,
          streamUrl: data.streamUrl,
          streamType: data.streamType as StreamType,
          status: data.status,
        },
      });

      await auditLog.log({
        userId,
        eventType: AuditEventType.DEVICE_UPDATE,
        level: AuditLogLevel.INFO,
        resourceType: 'VideoConfig',
        resourceId: id,
        description: `Updated video configuration: ${data.name}`,
      });

      return videoConfig;
    } catch (error) {
      console.error('Error updating video config:', error);
      throw new Error('Failed to update video configuration');
    }
  }

  /**
   * 删除视频配置
   * @param id 视频配置ID
   * @returns 删除结果
   */
  async deleteVideoConfig(id: string, userId: string) {
    try {
      const videoConfig = await prisma.videoConfig.delete({
        where: {
          id,
        },
      });

      await auditLog.log({
        userId,
        eventType: AuditEventType.DEVICE_DELETE,
        level: AuditLogLevel.INFO,
        resourceType: 'VideoConfig',
        resourceId: id,
        description: `Deleted video configuration: ${videoConfig.name}`,
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting video config:', error);
      throw new Error('Failed to delete video configuration');
    }
  }

  /**
   * 更新视频配置状态
   * @param id 视频配置ID
   * @param status 状态
   * @returns 更新后的视频配置
   */
  async updateVideoStatus(id: string, status: boolean, userId: string) {
    try {
      const videoConfig = await prisma.videoConfig.update({
        where: {
          id,
        },
        data: {
          status,
        },
      });

      await auditLog.log({
        userId,
        eventType: status ? AuditEventType.DEVICE_ONLINE : AuditEventType.DEVICE_OFFLINE,
        level: AuditLogLevel.INFO,
        resourceType: 'VideoConfig',
        resourceId: id,
        description: `Updated video status to ${status ? 'active' : 'inactive'}: ${videoConfig.name}`,
      });

      return videoConfig;
    } catch (error) {
      console.error('Error updating video status:', error);
      throw new Error('Failed to update video status');
    }
  }

  /**
   * 测试视频流地址
   * @param url 视频流地址
   * @param type 视频流类型
   * @returns 测试结果
   */
  async testVideoStream(url: string, type: StreamType) {
    try {
      // 这里只进行简单的URL格式验证
      // 实际测试需要在前端进行，使用EasyPlayer-pro
      if (!url) {
        return { success: false, message: 'Stream URL is required' };
      }

      // 验证URL格式
      try {
        new URL(url);
      } catch (e) {
        return { success: false, message: 'Invalid URL format' };
      }

      // 验证URL协议
      if (type === StreamType.WEBSOCKET && !url.startsWith('ws://') && !url.startsWith('wss://')) {
        return { success: false, message: 'WebSocket URL must start with ws:// or wss://' };
      }

      if (type === StreamType.HTTP && !url.startsWith('http://') && !url.startsWith('https://')) {
        return { success: false, message: 'HTTP URL must start with http:// or https://' };
      }

      return { success: true, message: 'Stream URL format is valid' };
    } catch (error) {
      console.error('Error testing video stream:', error);
      return { success: false, message: 'Failed to test video stream' };
    }
  }

  /**
   * 获取视频流配置信息（供前端使用）
   * @param id 视频配置ID
   * @returns 视频流配置信息
   */
  async getStreamConfig(id: string) {
    try {
      const videoConfig = await this.getVideoConfig(id);
      
      if (!videoConfig.status) {
        throw new Error('Video stream is disabled');
      }

      return {
        url: videoConfig.streamUrl,
        type: videoConfig.streamType,
        name: videoConfig.name,
        cameraCode: videoConfig.cameraCode,
        config: {
          isLive: true,
          bufferTime: 0.2,
          stretch: false,
          MSE: true,
          WCS: true,
          hasAudio: true,
        }
      };
    } catch (error) {
      console.error('Error getting stream config:', error);
      throw new Error('Failed to get stream configuration');
    }
  }
}

// 导出单例实例
export const videoStreamService = new VideoStreamService(); 