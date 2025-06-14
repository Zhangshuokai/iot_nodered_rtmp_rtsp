'use client';

import { useState } from 'react';
import { useVideoConfigs } from './hooks';
import { VideoConfigInfo } from './types';
import VideoPlayer from './index';

interface VideoListProps {
  organizationId: string;
}

/**
 * 视频列表组件
 * 展示组织下的所有视频配置
 */
const VideoList = ({ organizationId }: VideoListProps) => {
  const { videoConfigs, loading, error } = useVideoConfigs(organizationId);
  const [selectedVideo, setSelectedVideo] = useState<VideoConfigInfo | null>(null);

  if (loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">错误: {error}</div>;
  }

  if (videoConfigs.length === 0) {
    return <div className="p-4 text-center">暂无视频配置</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">视频列表</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {videoConfigs.map((video) => (
            <div
              key={video.id}
              className={`p-3 rounded-md cursor-pointer transition-colors ${
                selectedVideo?.id === video.id
                  ? 'bg-blue-200'
                  : 'bg-white hover:bg-gray-200'
              }`}
              onClick={() => setSelectedVideo(video)}
            >
              <div className="font-medium">{video.name}</div>
              <div className="text-sm text-gray-500">
                摄像头编号: {video.cameraCode}
              </div>
              <div className="text-xs text-gray-400 flex justify-between mt-1">
                <span>类型: {video.streamType}</span>
                <span className={video.status ? 'text-green-500' : 'text-red-500'}>
                  {video.status ? '已启用' : '已停用'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">
          {selectedVideo ? `预览: ${selectedVideo.name}` : '选择视频预览'}
        </h2>
        {selectedVideo ? (
          <div>
            <div className="bg-black aspect-video mb-3">
              <VideoPlayer
                url={selectedVideo.streamUrl}
                type={selectedVideo.streamType}
                height="100%"
              />
            </div>
            <div className="bg-white p-3 rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">摄像头编号:</span> {selectedVideo.cameraCode}
                </div>
                <div>
                  <span className="font-medium">流类型:</span> {selectedVideo.streamType}
                </div>
                <div>
                  <span className="font-medium">状态:</span>{' '}
                  <span className={selectedVideo.status ? 'text-green-500' : 'text-red-500'}>
                    {selectedVideo.status ? '已启用' : '已停用'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">创建时间:</span>{' '}
                  {new Date(selectedVideo.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium">流地址:</span>{' '}
                <span className="text-gray-500 break-all">{selectedVideo.streamUrl}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white aspect-video flex items-center justify-center text-gray-400">
            请从左侧选择视频进行预览
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoList; 