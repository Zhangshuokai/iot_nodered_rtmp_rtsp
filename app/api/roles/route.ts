import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 角色创建验证模式
const createRoleSchema = z.object({
  name: z.string().min(1, '角色名称不能为空'),
  description: z.string().optional(),
  permissions: z.array(z.string().uuid()).optional(),
});

// 定义角色权限关联的类型
interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  rolePermissions?: Array<{
    permission: {
      id: string;
      name: string;
      code: string;
      description: string | null;
    }
  }>;
}

// 获取角色列表
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['role:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 获取查询参数
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const includePermissions = url.searchParams.get('includePermissions') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 查询角色总数
    const total = await prisma.role.count({ where });

    // 查询角色列表
    const roles = await prisma.role.findMany({
      where,
      skip,
      take: pageSize,
      include: includePermissions ? {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
              },
            },
          },
        },
      } : undefined,
      orderBy: { name: 'asc' },
    });

    // 如果包含权限，重新格式化返回结果
    const formattedRoles = roles.map((role: any) => {
      if (includePermissions && role.rolePermissions) {
        const { rolePermissions, ...roleData } = role;
        return {
          ...roleData,
          permissions: rolePermissions.map((rp: any) => rp.permission),
        };
      }
      return role;
    });

    return NextResponse.json({
      data: formattedRoles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json({ error: '获取角色列表失败' }, { status: 500 });
  }
}

// 创建角色
export async function POST(req: NextRequest) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['role:create']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = createRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, description, permissions = [] } = validationResult.data;

    // 检查角色名称是否已存在
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return NextResponse.json({ error: '角色名称已存在' }, { status: 400 });
    }

    // 如果提供了权限ID，检查权限是否存在
    if (permissions.length > 0) {
      const permissionCount = await prisma.permission.count({
        where: {
          id: { in: permissions },
        },
      });

      if (permissionCount !== permissions.length) {
        return NextResponse.json({ error: '部分权限不存在' }, { status: 400 });
      }
    }

    // 创建角色
    const role = await prisma.$transaction(async (tx) => {
      // 创建角色
      const newRole = await tx.role.create({
        data: {
          name,
          description,
        },
      });

      // 如果提供了权限，创建角色权限关联
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map(permissionId => ({
            roleId: newRole.id,
            permissionId,
          })),
        });
      }

      return newRole;
    });

    // 查询创建的角色及其权限
    const createdRole = await prisma.role.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
              },
            },
          },
        },
      },
    }) as unknown as RoleWithPermissions;

    if (!createdRole || !createdRole.rolePermissions) {
      return NextResponse.json({ error: '创建角色失败' }, { status: 500 });
    }

    // 格式化返回结果
    const { rolePermissions, ...roleData } = createdRole;
    const formattedRole = {
      ...roleData,
      permissions: rolePermissions.map(rp => rp.permission),
    };

    return NextResponse.json({ data: formattedRole }, { status: 201 });
  } catch (error) {
    console.error('创建角色失败:', error);
    return NextResponse.json({ error: '创建角色失败' }, { status: 500 });
  }
} 