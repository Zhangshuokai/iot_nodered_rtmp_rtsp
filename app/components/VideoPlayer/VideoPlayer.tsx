'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoPlayerProps } from './types';

/**
 * 视频播放器组件
 * 基于EasyPlayer-pro实现，支持WebSocket和HTTP流
 */
const VideoPlayer = ({
  url,
  type,
  width = '100%',
  height = '100%',
  autoPlay = true,
  config = {
    isLive: true,
    bufferTime: 0.2,
    stretch: false,
    MSE: true,
    WCS: true,
    hasAudio: true,
  },
}: VideoPlayerProps) => {
  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstance = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化播放器
  useEffect(() => {
    // 确保EasyPlayer-pro脚本已加载
    if (typeof window !== 'undefined' && !window.EasyPlayerPro) {
      const script = document.createElement('script');
      script.src = '/js/player/EasyPlayer-pro.js';
      script.async = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => setError('Failed to load player script');
      document.body.appendChild(script);
    } else {
      setIsLoaded(true);
    }
  }, []);

  // 创建播放器实例并播放
  useEffect(() => {
    if (!isLoaded || !playerRef.current || !url) return;

    const createPlayer = () => {
      try {
        if (playerInstance.current) {
          playerInstance.current.destroy().then(() => {
            initPlayer();
          });
        } else {
          initPlayer();
        }
      } catch (err) {
        console.error('Error creating player:', err);
        setError('Failed to create player');
      }
    };

    const initPlayer = () => {
      try {
        if (!window.EasyPlayerPro) {
          setError('Player not loaded');
          return;
        }

        playerInstance.current = new window.EasyPlayerPro(playerRef.current, {
          isLive: config.isLive,
          bufferTime: config.bufferTime,
          stretch: config.stretch,
          MSE: config.MSE,
          WCS: config.WCS,
          hasAudio: config.hasAudio,
          watermark: config.watermark || { text: { content: 'IoT Platform' }, right: 10, top: 10 },
        });

        if (autoPlay) {
          playVideo();
        }
      } catch (err) {
        console.error('Error initializing player:', err);
        setError('Failed to initialize player');
      }
    };

    const playVideo = () => {
      if (!playerInstance.current) return;

      playerInstance.current
        .play(url)
        .then(() => {
          console.log('Video playback started');
          setError(null);
        })
        .catch((err: any) => {
          console.error('Error playing video:', err);
          setError('Failed to play video stream');
        });
    };

    createPlayer();

    return () => {
      if (playerInstance.current) {
        try {
          playerInstance.current.destroy();
          playerInstance.current = null;
        } catch (err) {
          console.error('Error destroying player:', err);
        }
      }
    };
  }, [isLoaded, url, autoPlay, config]);

  return (
    <div className="video-player-container">
      <div
        ref={playerRef}
        style={{
          width,
          height,
          backgroundColor: '#000000',
          position: 'relative',
        }}
      >
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '10px',
              borderRadius: '5px',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer; 