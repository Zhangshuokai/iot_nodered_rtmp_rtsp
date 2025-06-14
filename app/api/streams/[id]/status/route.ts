import { NextRequest, NextResponse } from 'next/server';
import { videoStreamService } from '@/lib/video-stream-service';

/**
 * 更新视频流状态
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const data = await req.json();
    
    if (data.status === undefined) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const userId = 'system'; // 应该从session中获取，这里简化处理
    const videoConfig = await videoStreamService.updateVideoStatus(id, data.status, userId);
    return NextResponse.json(videoConfig);
  } catch (error) {
    console.error('Error updating video status:', error);
    return NextResponse.json({ error: 'Failed to update video status' }, { status: 500 });
  }
} 