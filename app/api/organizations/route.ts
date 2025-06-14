import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 组织创建验证模式
const createOrganizationSchema = z.object({
  name: z.string().min(1, '组织名称不能为空'),
  code: z.string().min(1, '组织编码不能为空'),
  level: z.number().int().min(0, '组织级别必须为非负整数'),
  parentId: z.string().uuid().optional(),
  description: z.string().optional(),
});

// 获取组织列表
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['org:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 获取查询参数
    const url = new URL(req.url);
    const parentId = url.searchParams.get('parentId');
    const includeChildren = url.searchParams.get('includeChildren') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {};
    if (parentId) {
      where.parentId = parentId;
    }

    // 如果不是系统管理员，只能查看自己所在组织及其子组织
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
      where.id = { in: allowedOrgIds };
    }

    // 查询组织总数
    const total = await prisma.organization.count({ where });

    // 查询组织列表
    const organizations = await prisma.organization.findMany({
      where,
      skip,
      take: pageSize,
      include: includeChildren ? {
        children: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
      } : undefined,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      data: organizations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取组织列表失败:', error);
    return NextResponse.json({ error: '获取组织列表失败' }, { status: 500 });
  }
}

// 创建组织
export async function POST(req: NextRequest) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['org:create']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = createOrganizationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, code, level, parentId, description } = validationResult.data;

    // 检查组织编码是否已存在
    const existingOrg = await prisma.organization.findUnique({
      where: { code },
    });

    if (existingOrg) {
      return NextResponse.json({ error: '组织编码已存在' }, { status: 400 });
    }

    // 如果指定了父组织，检查父组织是否存在
    if (parentId) {
      const parentOrg = await prisma.organization.findUnique({
        where: { id: parentId },
      });

      if (!parentOrg) {
        return NextResponse.json({ error: '父组织不存在' }, { status: 400 });
      }

      // 如果不是系统管理员，只能在自己所在组织下创建子组织
      if (user.role !== 'SYSTEM_ADMIN' && parentOrg.id !== user.organizationId) {
        return NextResponse.json({ error: '无权在此组织下创建子组织' }, { status: 403 });
      }
    }

    // 创建组织
    const organization = await prisma.organization.create({
      data: {
        name,
        code,
        level,
        description,
        parent: parentId ? { connect: { id: parentId } } : undefined,
      },
    });

    return NextResponse.json({ data: organization }, { status: 201 });
  } catch (error) {
    console.error('创建组织失败:', error);
    return NextResponse.json({ error: '创建组织失败' }, { status: 500 });
  }
} 