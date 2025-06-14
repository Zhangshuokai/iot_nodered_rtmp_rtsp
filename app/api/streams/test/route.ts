import { NextRequest, NextResponse } from 'next/server';
import { videoStreamService } from '@/lib/video-stream-service';
import { StreamType } from '@prisma/client';

/**
 * 测试视频流地址
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.url || !data.type) {
      return NextResponse.json({ error: 'URL and type are required' }, { status: 400 });
    }

    // 验证流类型
    if (!Object.values(StreamType).includes(data.type)) {
      return NextResponse.json({ error: 'Invalid stream type' }, { status: 400 });
    }

    const result = await videoStreamService.testVideoStream(data.url, data.type);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing video stream:', error);
    return NextResponse.json({ error: 'Failed to test video stream' }, { status: 500 });
  }
} 