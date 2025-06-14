import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';
import { AuthService } from '@/lib/auth';

// 管理员重置密码验证模式
const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(6, '新密码至少需要6个字符'),
});

// 用户修改密码验证模式
const userChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少需要6个字符'),
});

// 重置/修改密码
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    // 检查用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
        organizationId: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 判断是管理员重置密码还是用户修改自己的密码
    const { isAuthorized, user, error } = await validateRequest(req);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 用户修改自己的密码
    if (user.id === id) {
      // 验证请求数据
      const validationResult = userChangePasswordSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
      }

      const { currentPassword, newPassword } = validationResult.data;

      // 验证当前密码
      const isPasswordValid = await AuthService.verifyPassword(currentPassword, targetUser.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
      }

      // 加密新密码
      const hashedPassword = await AuthService.hashPassword(newPassword);

      // 更新密码
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({ message: '密码修改成功' });
    } 
    // 管理员重置密码
    else {
      // 检查是否有权限重置密码
      const hasPermission = await validateRequest(req, ['user:reset_password']);
      if (!hasPermission.isAuthorized) {
        return NextResponse.json({ error: hasPermission.error }, { status: 403 });
      }

      // 如果不是系统管理员，检查是否有权限操作此用户
      if (user.role !== 'SYSTEM_ADMIN') {
        // 获取用户所在组织及其所有子组织的ID
        const userOrg = await prisma.organization.findUnique({
          where: { id: user.organizationId },
          include: {
            children: {
              select: { id: true },
            },
          },
        });

        if (!userOrg) {
          return NextResponse.json({ error: '无法获取用户组织信息' }, { status: 404 });
        }

        const allowedOrgIds = [userOrg.id, ...userOrg.children.map((child: { id: string }) => child.id)];
        if (!allowedOrgIds.includes(targetUser.organizationId)) {
          return NextResponse.json({ error: '无权重置此用户密码' }, { status: 403 });
        }
      }

      // 验证请求数据
      const validationResult = adminResetPasswordSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
      }

      const { newPassword } = validationResult.data;

      // 加密新密码
      const hashedPassword = await AuthService.hashPassword(newPassword);

      // 更新密码
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({ message: '密码重置成功' });
    }
  } catch (error) {
    console.error('密码重置/修改失败:', error);
    return NextResponse.json({ error: '密码重置/修改失败' }, { status: 500 });
  }
} 