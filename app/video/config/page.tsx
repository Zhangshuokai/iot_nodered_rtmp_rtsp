'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StreamType } from '@prisma/client';
import { useTestVideoStream } from '@/app/components/VideoPlayer';

/**
 * 视频配置页面
 * 用于添加、编辑和删除视频配置
 */
export default function VideoConfigPage() {
  const router = useRouter();
  // 假设当前组织ID，实际应从用户会话或上下文获取
  const organizationId = 'org123';
  const { testStream, loading: testLoading, result: testResult } = useTestVideoStream();
  
  const [videoConfigs, setVideoConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    cameraCode: '',
    streamUrl: '',
    streamType: StreamType.WEBSOCKET,
    status: true,
    cover: '',
    organizationId: organizationId,
  });

  // 加载视频配置列表
  useEffect(() => {
    const fetchVideoConfigs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/streams?organizationId=${organizationId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video configs: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVideoConfigs(data);
      } catch (err) {
        console.error('Error fetching video configs:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoConfigs();
  }, [organizationId]);

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // 处理复选框
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // 测试视频流
  const handleTestStream = async () => {
    await testStream(formData.streamUrl, formData.streamType as StreamType);
  };

  // 创建或更新视频配置
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (editingConfig) {
        // 更新现有配置
        response = await fetch(`/api/streams/${editingConfig.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      } else {
        // 创建新配置
        response = await fetch('/api/streams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `操作失败: ${response.statusText}`);
      }
      
      // 重新加载视频配置列表
      const listResponse = await fetch(`/api/streams?organizationId=${organizationId}`);
      const data = await listResponse.json();
      setVideoConfigs(data);
      
      // 重置表单
      resetForm();
      setIsCreating(false);
      setEditingConfig(null);
    } catch (err) {
      console.error('Error saving video config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 删除视频配置
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此视频配置吗？')) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/streams/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`删除失败: ${response.statusText}`);
      }
      
      // 从列表中移除
      setVideoConfigs(videoConfigs.filter(config => config.id !== id));
    } catch (err) {
      console.error('Error deleting video config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 编辑视频配置
  const handleEdit = (config: any) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      cameraCode: config.cameraCode,
      streamUrl: config.streamUrl,
      streamType: config.streamType,
      status: config.status,
      cover: config.cover || '',
      organizationId: config.organizationId,
    });
    setIsCreating(true);
  };

  // 更新视频状态
  const handleStatusChange = async (id: string, status: boolean) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/streams/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: !status }),
      });
      
      if (!response.ok) {
        throw new Error(`状态更新失败: ${response.statusText}`);
      }
      
      // 更新列表中的状态
      setVideoConfigs(
        videoConfigs.map(config => 
          config.id === id ? { ...config, status: !status } : config
        )
      );
    } catch (err) {
      console.error('Error updating video status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      cameraCode: '',
      streamUrl: '',
      streamType: StreamType.WEBSOCKET,
      status: true,
      cover: '',
      organizationId: organizationId,
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">视频配置管理</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push('/video')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md"
          >
            返回视频中心
          </button>
          <button
            onClick={() => {
              setIsCreating(!isCreating);
              if (!isCreating) {
                resetForm();
                setEditingConfig(null);
              }
            }}
            className={`px-4 py-2 rounded-md ${
              isCreating ? 'bg-gray-500 text-white' : 'bg-blue-500 text-white'
            }`}
          >
            {isCreating ? '取消' : '添加视频配置'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingConfig ? '编辑视频配置' : '添加视频配置'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  视频名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="输入视频名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  摄像头编号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="cameraCode"
                  value={formData.cameraCode}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="输入摄像头编号"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  视频封面URL
                </label>
                <input
                  type="text"
                  name="cover"
                  value={formData.cover}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="输入视频封面URL（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  视频流类型 <span className="text-red-500">*</span>
                </label>
                <select
                  name="streamType"
                  value={formData.streamType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={StreamType.WEBSOCKET}>WebSocket</option>
                  <option value={StreamType.HTTP}>HTTP</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  视频流地址 <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <input
                    type="text"
                    name="streamUrl"
                    value={formData.streamUrl}
                    onChange={handleInputChange}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md"
                    placeholder={`输入${formData.streamType === StreamType.WEBSOCKET ? 'ws://' : 'http://'}地址`}
                  />
                  <button
                    type="button"
                    onClick={handleTestStream}
                    disabled={testLoading || !formData.streamUrl}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-r-md disabled:opacity-50"
                  >
                    测试
                  </button>
                </div>
                {testResult && (
                  <div className={`mt-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.message}
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="status"
                    checked={formData.status}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">启用</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                视频名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                摄像头编号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                视频流类型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                更新时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && videoConfigs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">
                  加载中...
                </td>
              </tr>
            ) : videoConfigs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">
                  暂无视频配置
                </td>
              </tr>
            ) : (
              videoConfigs.map((config) => (
                <tr key={config.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{config.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{config.cameraCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{config.streamType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        config.status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {config.status ? '已启用' : '已停用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(config.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleStatusChange(config.id, config.status)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      {config.status ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleEdit(config)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 