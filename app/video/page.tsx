'use client';

import { useState } from 'react';
import { VideoList, VideoGrid } from '../components/VideoPlayer';

/**
 * 视频中心页面
 * 提供视频列表和视频网格两种展示模式
 */
export default function VideoPage() {
  // 假设当前组织ID，实际应从用户会话或上下文获取
  const organizationId = 'org123';
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">视频中心</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md ${
              viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            列表视图
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-md ${
              viewMode === 'grid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            网格视图
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <VideoList organizationId={organizationId} />
      ) : (
        <VideoGrid organizationId={organizationId} />
      )}
    </div>
  );
} 