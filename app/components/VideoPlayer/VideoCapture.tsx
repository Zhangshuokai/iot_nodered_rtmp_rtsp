'use client';

import { useState, useRef } from 'react';
import { StreamType } from '@prisma/client';
import VideoPlayer from './VideoPlayer';

interface VideoCaptureProps {
  url: string;
  type: StreamType;
  width?: number | string;
  height?: number | string;
}

/**
 * 视频截图组件
 * 提供视频播放和截图功能
 */
const VideoCapture = ({
  url,
  type,
  width = '100%',
  height = '360px',
}: VideoCaptureProps) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  // 截取视频画面
  const captureFrame = () => {
    if (!videoRef.current) return;
    
    setCapturing(true);
    
    try {
      // 查找视频元素
      const videoElement = videoRef.current.querySelector('video');
      
      if (!videoElement) {
        console.error('Video element not found');
        setCapturing(false);
        return;
      }
      
      // 创建canvas并绘制视频当前帧
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        setCapturing(false);
        return;
      }
      
      // 绘制视频帧到canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // 转换为图像数据URL
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
    } catch (err) {
      console.error('Error capturing video frame:', err);
    } finally {
      setCapturing(false);
    }
  };

  // 下载截图
  const downloadImage = () => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `video-capture-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 清除截图
  const clearCapture = () => {
    setCapturedImage(null);
  };

  return (
    <div className="video-capture-container">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="bg-black mb-2" style={{ width, height }} ref={videoRef}>
            <VideoPlayer url={url} type={type} width="100%" height="100%" />
          </div>
          <div className="flex justify-center mt-2">
            <button
              onClick={captureFrame}
              disabled={capturing}
              className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
            >
              {capturing ? '截图中...' : '截取画面'}
            </button>
          </div>
        </div>
        
        <div>
          <div
            className="bg-gray-100 flex items-center justify-center mb-2"
            style={{ width, height }}
          >
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured frame"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            ) : (
              <div className="text-gray-500">尚未截取画面</div>
            )}
          </div>
          <div className="flex justify-center space-x-2 mt-2">
            <button
              onClick={downloadImage}
              disabled={!capturedImage}
              className="px-4 py-2 bg-green-500 text-white rounded-md disabled:opacity-50"
            >
              下载截图
            </button>
            <button
              onClick={clearCapture}
              disabled={!capturedImage}
              className="px-4 py-2 bg-red-500 text-white rounded-md disabled:opacity-50"
            >
              清除截图
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCapture; 