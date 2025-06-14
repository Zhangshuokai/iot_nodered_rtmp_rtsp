'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StreamType } from '@prisma/client';
import { VideoCapture, useVideoConfig } from '@/app/components/VideoPlayer';

/**
 * 视频截图页面
 * 用于展示视频截图功能
 */
export default function VideoCaptureScreen({ 
  searchParams 
}: { 
  searchParams: { id?: string } 
}) {
  const router = useRouter();
  const videoId = searchParams.id;
  const { videoConfig, loading, error } = useVideoConfig(videoId || null);

  if (!videoId) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <p>请选择一个视频进行截图</p>
        </div>
        <button
          onClick={() => router.push('/video')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md"
        >
          返回视频中心
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-10">加载中...</div>
      </div>
    );
  }

  if (error || !videoConfig) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error || '视频配置不存在'}</p>
        </div>
        <button
          onClick={() => router.push('/video')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md"
        >
          返回视频中心
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">视频截图 - {videoConfig.name}</h1>
        <button
          onClick={() => router.push('/video')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md"
        >
          返回视频中心
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">摄像头编号: {videoConfig.cameraCode}</div>
          <div className="text-sm text-gray-500">视频流类型: {videoConfig.streamType}</div>
        </div>

        <VideoCapture
          url={videoConfig.streamUrl}
          type={videoConfig.streamType as StreamType}
          width="100%"
          height="400px"
        />

        <div className="mt-6 text-sm text-gray-500">
          <p>使用说明:</p>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li>点击"截取画面"按钮捕获当前视频帧</li>
            <li>截图成功后可以查看预览</li>
            <li>点击"下载截图"保存图片到本地</li>
            <li>点击"清除截图"可以重新截取</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 