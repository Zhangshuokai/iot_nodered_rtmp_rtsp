import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';

// 获取当前用户信息
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 查询用户详细信息
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        roleId: true,
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            rolePermissions: {
              include: {
                permission: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 格式化返回结果
    const { role, ...userInfo } = userData;
    const permissions = role.rolePermissions.map(rp => rp.permission);
    
    const formattedUser = {
      ...userInfo,
      role: {
        id: role.id,
        name: role.name,
      },
      permissions,
    };

    return NextResponse.json({ data: formattedUser });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
} 