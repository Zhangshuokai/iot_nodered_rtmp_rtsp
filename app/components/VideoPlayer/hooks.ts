import { useState, useEffect } from 'react';
import { VideoConfigInfo } from './types';
import { StreamType } from '@prisma/client';

/**
 * 获取视频配置钩子函数
 * @param id 视频配置ID
 */
export function useVideoConfig(id: string | null) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [videoConfig, setVideoConfig] = useState<VideoConfigInfo | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchVideoConfig = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/streams/${id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video config: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVideoConfig(data);
      } catch (err) {
        console.error('Error fetching video config:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoConfig();
  }, [id]);

  return { videoConfig, loading, error };
}

/**
 * 获取视频配置列表钩子函数
 * @param organizationId 组织ID
 */
export function useVideoConfigs(organizationId: string | null) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [videoConfigs, setVideoConfigs] = useState<VideoConfigInfo[]>([]);

  useEffect(() => {
    if (!organizationId) return;

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

  return { videoConfigs, loading, error };
}

/**
 * 测试视频流地址钩子函数
 */
export function useTestVideoStream() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const testStream = async (url: string, type: StreamType) => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/streams/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to test stream: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      console.error('Error testing stream:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { testStream, loading, error, result };
} 