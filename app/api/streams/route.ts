import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { videoStreamService } from '@/lib/video-stream-service';
import { StreamType } from '@prisma/client';

/**
 * 获取视频流配置列表
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const videoConfigs = await videoStreamService.getVideoConfigs(organizationId);
    return NextResponse.json(videoConfigs);
  } catch (error) {
    console.error('Error getting video configs:', error);
    return NextResponse.json({ error: 'Failed to get video configurations' }, { status: 500 });
  }
}

/**
 * 创建视频流配置
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    // 验证必填字段
    if (!data.name || !data.cameraCode || !data.streamUrl || !data.streamType || !data.organizationId) {
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

    const videoConfig = await videoStreamService.createVideoConfig(data, session.user.id);
    return NextResponse.json(videoConfig, { status: 201 });
  } catch (error) {
    console.error('Error creating video config:', error);
    return NextResponse.json({ error: 'Failed to create video configuration' }, { status: 500 });
  }
} 