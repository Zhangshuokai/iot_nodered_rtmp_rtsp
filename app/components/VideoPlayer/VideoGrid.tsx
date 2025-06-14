'use client';

import { useState } from 'react';
import { useVideoConfigs } from './hooks';
import VideoPlayer from './index';

interface VideoGridProps {
  organizationId: string;
}

/**
 * 视频网格组件
 * 支持单屏、四宫格和九宫格展示
 */
const VideoGrid = ({ organizationId }: VideoGridProps) => {
  const { videoConfigs, loading, error } = useVideoConfigs(organizationId);
  const [gridMode, setGridMode] = useState<1 | 4 | 9>(4); // 默认四宫格
  const [currentPage, setCurrentPage] = useState(0);

  if (loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">错误: {error}</div>;
  }

  if (videoConfigs.length === 0) {
    return <div className="p-4 text-center">暂无视频配置</div>;
  }

  // 计算分页
  const itemsPerPage = gridMode;
  const totalPages = Math.ceil(videoConfigs.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const displayedVideos = videoConfigs
    .filter((video) => video.status) // 只显示启用的视频
    .slice(startIndex, startIndex + itemsPerPage);

  // 根据模式设置网格列数
  const gridCols = gridMode === 1 ? 'grid-cols-1' : gridMode === 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="font-semibold">视频监控 ({videoConfigs.filter(v => v.status).length}个)</div>
        <div className="flex space-x-2">
          <button
            onClick={() => setGridMode(1)}
            className={`px-3 py-1 rounded ${
              gridMode === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            单屏
          </button>
          <button
            onClick={() => setGridMode(4)}
            className={`px-3 py-1 rounded ${
              gridMode === 4 ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            四宫格
          </button>
          <button
            onClick={() => setGridMode(9)}
            className={`px-3 py-1 rounded ${
              gridMode === 9 ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            九宫格
          </button>
        </div>
      </div>

      <div className={`grid ${gridCols} gap-2 aspect-[16/9]`}>
        {displayedVideos.map((video) => (
          <div key={video.id} className="bg-black relative">
            <VideoPlayer
              url={video.streamUrl}
              type={video.streamType}
              width="100%"
              height="100%"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-xs">
              {video.name}
            </div>
          </div>
        ))}
        {/* 填充空白格子 */}
        {Array.from({ length: itemsPerPage - displayedVideos.length }).map((_, index) => (
          <div key={`empty-${index}`} className="bg-gray-800 flex items-center justify-center text-gray-500">
            无视频
          </div>
        ))}
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            上一页
          </button>
          <div className="px-3 py-1">
            {currentPage + 1} / {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoGrid; 