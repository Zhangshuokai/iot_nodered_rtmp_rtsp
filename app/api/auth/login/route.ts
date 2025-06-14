import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { AuthService } from '@/lib/auth';
import { z } from 'zod';

// 登录验证模式
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

// 登录API
export async function POST(req: NextRequest) {
  try {
    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { username, password } = validationResult.data;

    // 查询用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }, // 支持使用邮箱登录
        ],
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // 用户不存在
    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 用户未激活
    if (!user.isActive) {
      return NextResponse.json({ error: '账户已被禁用，请联系管理员' }, { status: 403 });
    }

    // 验证密码
    const isPasswordValid = await AuthService.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 生成JWT令牌
    const token = AuthService.generateAccessToken({
      id: user.id,
      username: user.username,
      email: user.email,
      organizationId: user.organizationId,
      roleId: user.roleId,
    });

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // 返回用户信息和令牌
    return NextResponse.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          organization: user.organization,
        },
      },
    });
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
} 