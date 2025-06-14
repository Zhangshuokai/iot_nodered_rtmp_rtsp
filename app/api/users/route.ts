import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';
import { AuthService } from '@/lib/auth';

// 用户创建验证模式
const createUserSchema = z.object({
  username: z.string().min(3, '用户名至少需要3个字符'),
  password: z.string().min(6, '密码至少需要6个字符'),
  email: z.string().email('请输入有效的电子邮件地址'),
  name: z.string().min(1, '姓名不能为空'),
  avatar: z.string().url('请输入有效的头像URL').optional(),
  phone: z.string().optional(),
  organizationId: z.string().uuid('请输入有效的组织ID'),
  roleId: z.string().uuid('请输入有效的角色ID'),
});

// 获取用户列表
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['user:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 获取查询参数
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const roleId = url.searchParams.get('roleId');
    const search = url.searchParams.get('search');
    const isActive = url.searchParams.get('isActive');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // 如果不是系统管理员，只能查看自己所在组织的用户
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
      where.organizationId = { in: allowedOrgIds };
    }

    // 查询用户总数
    const total = await prisma.user.count({ where });

    // 查询用户列表
    const users = await prisma.user.findMany({
      where,
      skip,
      take: pageSize,
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
      orderBy: { username: 'asc' },
    });

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// 创建用户
export async function POST(req: NextRequest) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['user:create']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { username, password, email, name, avatar, phone, organizationId, roleId } = validationResult.data;

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
      }
      if (existingUser.email === email) {
        return NextResponse.json({ error: '电子邮件已存在' }, { status: 400 });
      }
    }

    // 检查组织是否存在
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json({ error: '组织不存在' }, { status: 400 });
    }

    // 检查角色是否存在
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 400 });
    }

    // 如果不是系统管理员，只能在自己所在组织及其子组织下创建用户
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
      if (!allowedOrgIds.includes(organizationId)) {
        return NextResponse.json({ error: '无权在此组织下创建用户' }, { status: 403 });
      }
    }

    // 加密密码
    const hashedPassword = await AuthService.hashPassword(password);

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        name,
        avatar,
        phone,
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
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        roleId: true,
      },
    });

    return NextResponse.json({ data: newUser }, { status: 201 });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
} 