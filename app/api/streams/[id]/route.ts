import { NextRequest, NextResponse } from 'next/server';
import { videoStreamService } from '@/lib/video-stream-service';
import { StreamType } from '@prisma/client';

/**
 * 获取单个视频流配置
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const videoConfig = await videoStreamService.getVideoConfig(id);
    return NextResponse.json(videoConfig);
  } catch (error) {
    console.error('Error getting video config:', error);
    return NextResponse.json({ error: 'Failed to get video configuration' }, { status: 500 });
  }
}

/**
 * 更新视频流配置
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const data = await req.json();
    
    // 验证必填字段
    if (!data.name || !data.cameraCode || !data.streamUrl || !data.streamType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 验证流类型
    if (!Object.values(StreamType).includes(data.streamType)) {
      return NextResponse.json({ error: 'Invalid stream type' }, { status: 400 });
    }

    // 验证流URL
    const testResult = await videoStreamService.testVideoStream(data.streamUrl, data.streamType);
    if (!testResult.success) {
      return NextResponse.json({ error: testResult.message }, { status: 400 });
    }

    const userId = 'system'; // 应该从session中获取，这里简化处理
    const videoConfig = await videoStreamService.updateVideoConfig(id, data, userId);
    return NextResponse.json(videoConfig);
  } catch (error) {
    console.error('Error updating video config:', error);
    return NextResponse.json({ error: 'Failed to update video configuration' }, { status: 500 });
  }
}

/**
 * 删除视频流配置
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const userId = 'system'; // 应该从session中获取，这里简化处理
    await videoStreamService.deleteVideoConfig(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video config:', error);
    return NextResponse.json({ error: 'Failed to delete video configuration' }, { status: 500 });
  }
} 