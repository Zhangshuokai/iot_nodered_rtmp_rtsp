import { StreamType } from '@prisma/client';

/**
 * 视频播放器属性
 */
export interface VideoPlayerProps {
  url: string;
  type: StreamType;
  width?: number | string;
  height?: number | string;
  autoPlay?: boolean;
  config?: {
    isLive?: boolean;
    bufferTime?: number;
    stretch?: boolean;
    MSE?: boolean;
    WCS?: boolean;
    hasAudio?: boolean;
    watermark?: {
      text?: { content: string };
      right?: number;
      top?: number;
    };
  };
}

/**
 * 视频配置信息
 */
export interface VideoConfigInfo {
  id: string;
  name: string;
  cover?: string;
  cameraCode: string;
  streamUrl: string;
  streamType: StreamType;
  status: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 扩展Window接口以支持EasyPlayerPro
 */
declare global {
  interface Window {
    EasyPlayerPro: any;
  }
} 