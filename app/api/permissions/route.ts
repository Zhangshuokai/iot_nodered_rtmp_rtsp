import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 权限创建验证模式
const createPermissionSchema = z.object({
  name: z.string().min(1, '权限名称不能为空'),
  code: z.string().min(1, '权限编码不能为空'),
  description: z.string().optional(),
});

// 获取权限列表
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['permission:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 获取查询参数
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50'); // 权限通常较多，默认显示更多
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 查询权限总数
    const total = await prisma.permission.count({ where });

    // 查询权限列表
    const permissions = await prisma.permission.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { code: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      data: permissions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取权限列表失败:', error);
    return NextResponse.json({ error: '获取权限列表失败' }, { status: 500 });
  }
}

// 创建权限
export async function POST(req: NextRequest) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['permission:create']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = createPermissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, code, description } = validationResult.data;

    // 检查权限名称和编码是否已存在
    const existingPermission = await prisma.permission.findFirst({
      where: {
        OR: [
          { name },
          { code },
        ],
      },
    });

    if (existingPermission) {
      if (existingPermission.name === name) {
        return NextResponse.json({ error: '权限名称已存在' }, { status: 400 });
      }
      if (existingPermission.code === code) {
        return NextResponse.json({ error: '权限编码已存在' }, { status: 400 });
      }
    }

    // 创建权限
    const permission = await prisma.permission.create({
      data: {
        name,
        code,
        description,
      },
    });

    return NextResponse.json({ data: permission }, { status: 201 });
  } catch (error) {
    console.error('创建权限失败:', error);
    return NextResponse.json({ error: '创建权限失败' }, { status: 500 });
  }
}