'use client';

import { useRouter } from 'next/navigation';
import { StreamType } from '@prisma/client';
import { VideoPlayer, useVideoConfig } from '@/app/components/VideoPlayer';

/**
 * 视频详情页面
 * 用于查看单个视频流
 */
export default function VideoDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const router = useRouter();
  const videoId = params.id;
  const { videoConfig, loading, error } = useVideoConfig(videoId);

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
        <h1 className="text-2xl font-bold">{videoConfig.name}</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push(`/video/capture?id=${videoId}`)}
            className="px-4 py-2 bg-green-500 text-white rounded-md"
          >
            截图
          </button>
          <button
            onClick={() => router.push('/video')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md"
          >
            返回视频中心
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-black aspect-video">
            <VideoPlayer
              url={videoConfig.streamUrl}
              type={videoConfig.streamType as StreamType}
              width="100%"
              height="100%"
            />
          </div>
        </div>
        
        <div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">视频信息</h2>
            
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-500">摄像头编号</div>
                <div>{videoConfig.cameraCode}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500">视频流类型</div>
                <div>{videoConfig.streamType}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500">状态</div>
                <div className={videoConfig.status ? 'text-green-600' : 'text-red-600'}>
                  {videoConfig.status ? '已启用' : '已停用'}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500">创建时间</div>
                <div>{new Date(videoConfig.createdAt).toLocaleString()}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500">更新时间</div>
                <div>{new Date(videoConfig.updatedAt).toLocaleString()}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500">视频流地址</div>
                <div className="text-sm break-all bg-gray-50 p-2 rounded">
                  {videoConfig.streamUrl}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex space-x-2">
              <button
                onClick={() => router.push(`/video/config?edit=${videoId}`)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md w-full"
              >
                编辑配置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 