import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';
import { AuthService } from '@/lib/auth';

// 用户更新验证模式
const updateUserSchema = z.object({
  name: z.string().min(1, '姓名不能为空').optional(),
  email: z.string().email('请输入有效的电子邮件地址').optional(),
  avatar: z.string().url('请输入有效的头像URL').optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  organizationId: z.string().uuid('请输入有效的组织ID').optional(),
  roleId: z.string().uuid('请输入有效的角色ID').optional(),
});

// 密码更新验证模式
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少需要6个字符'),
});

// 获取用户详情
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['user:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 如果不是系统管理员，只能查看自己或自己所在组织的用户
    if (user.role !== 'SYSTEM_ADMIN' && user.id !== id) {
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
      
      // 检查目标用户是否在允许的组织中
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { organizationId: true },
      });

      if (!targetUser || !allowedOrgIds.includes(targetUser.organizationId)) {
        return NextResponse.json({ error: '无权查看此用户' }, { status: 403 });
      }
    }

    // 查询用户详情
    const userData = await prisma.user.findUnique({
      where: { id },
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
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ data: userData });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return NextResponse.json({ error: '获取用户详情失败' }, { status: 500 });
  }
}

// 更新用户
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['user:update']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 如果不是系统管理员，只能更新自己或自己所在组织的用户
    if (user.role !== 'SYSTEM_ADMIN' && user.id !== id) {
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
      
      // 检查目标用户是否在允许的组织中
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { organizationId: true },
      });

      if (!targetUser || !allowedOrgIds.includes(targetUser.organizationId)) {
        return NextResponse.json({ error: '无权更新此用户' }, { status: 403 });
      }
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = updateUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, email, avatar, phone, isActive, organizationId, roleId } = validationResult.data;

    // 如果更新邮箱，检查邮箱是否已存在
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });

      if (existingUser) {
        return NextResponse.json({ error: '电子邮件已存在' }, { status: 400 });
      }
    }

    // 如果更新组织，检查组织是否存在
    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return NextResponse.json({ error: '组织不存在' }, { status: 400 });
      }

      // 如果不是系统管理员，只能将用户移动到自己所在组织及其子组织
      if (user.role !== 'SYSTEM_ADMIN') {
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
        if (!allowedOrgIds.includes(organizationId)) {
          return NextResponse.json({ error: '无权将用户移动到此组织' }, { status: 403 });
        }
      }
    }

    // 如果更新角色，检查角色是否存在
    if (roleId) {
      const role = await prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!role) {
        return NextResponse.json({ error: '角色不存在' }, { status: 400 });
      }
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        avatar,
        phone,
        isActive,
        organizationId,
        roleId,
      },
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
      },
    });

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

// 删除用户
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['user:delete']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 不能删除自己
    if (user.id === id) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 });
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 如果不是系统管理员，只能删除自己所在组织及其子组织的用户
    if (user.role !== 'SYSTEM_ADMIN') {
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
      if (!allowedOrgIds.includes(existingUser.organizationId)) {
        return NextResponse.json({ error: '无权删除此用户' }, { status: 403 });
      }
    }

    // 删除用户
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: '用户已成功删除' }, { status: 200 });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 });
  }
} 