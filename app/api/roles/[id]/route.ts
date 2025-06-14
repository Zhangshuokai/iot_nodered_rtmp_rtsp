import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 角色更新验证模式
const updateRoleSchema = z.object({
  name: z.string().min(1, '角色名称不能为空').optional(),
  description: z.string().optional().nullable(),
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

// 获取角色详情
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['role:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 查询角色详情
    const role = await prisma.role.findUnique({
      where: { id },
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
        users: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    }) as unknown as RoleWithPermissions & { users: any[] };

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 格式化返回结果
    const { rolePermissions, ...roleData } = role;
    const formattedRole = {
      ...roleData,
      permissions: rolePermissions ? rolePermissions.map(rp => rp.permission) : [],
    };

    return NextResponse.json({ data: formattedRole });
  } catch (error) {
    console.error('获取角色详情失败:', error);
    return NextResponse.json({ error: '获取角色详情失败' }, { status: 500 });
  }
}

// 更新角色
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['role:update']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = updateRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, description, permissions } = validationResult.data;

    // 如果更新名称，检查名称是否已存在
    if (name && name !== existingRole.name) {
      const roleWithSameName = await prisma.role.findUnique({
        where: { name },
      });

      if (roleWithSameName) {
        return NextResponse.json({ error: '角色名称已存在' }, { status: 400 });
      }
    }

    // 如果提供了权限ID，检查权限是否存在
    if (permissions && permissions.length > 0) {
      const permissionCount = await prisma.permission.count({
        where: {
          id: { in: permissions },
        },
      });

      if (permissionCount !== permissions.length) {
        return NextResponse.json({ error: '部分权限不存在' }, { status: 400 });
      }
    }

    // 更新角色
    const updatedRole = await prisma.$transaction(async (tx) => {
      // 更新角色基本信息
      const role = await tx.role.update({
        where: { id },
        data: {
          name,
          description,
        },
      });

      // 如果提供了权限，更新角色权限关联
      if (permissions !== undefined) {
        // 先删除现有的权限关联
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        // 如果有新的权限，创建新的关联
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map(permissionId => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      return role;
    });

    // 查询更新后的角色及其权限
    const roleWithPermissions = await prisma.role.findUnique({
      where: { id: updatedRole.id },
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

    if (!roleWithPermissions) {
      return NextResponse.json({ error: '获取更新后的角色失败' }, { status: 500 });
    }

    // 格式化返回结果
    const { rolePermissions, ...roleData } = roleWithPermissions;
    const formattedRole = {
      ...roleData,
      permissions: rolePermissions ? rolePermissions.map(rp => rp.permission) : [],
    };

    return NextResponse.json({ data: formattedRole });
  } catch (error) {
    console.error('更新角色失败:', error);
    return NextResponse.json({ error: '更新角色失败' }, { status: 500 });
  }
}

// 删除角色
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['role:delete']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 检查是否有用户使用此角色
    if (existingRole.users.length > 0) {
      return NextResponse.json({ error: '无法删除有用户使用的角色，请先移除用户的角色关联' }, { status: 400 });
    }

    // 删除角色及其权限关联
    await prisma.$transaction(async (tx) => {
      // 删除角色权限关联
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // 删除角色
      await tx.role.delete({
        where: { id },
      });
    });

    return NextResponse.json({ message: '角色已成功删除' }, { status: 200 });
  } catch (error) {
    console.error('删除角色失败:', error);
    return NextResponse.json({ error: '删除角色失败' }, { status: 500 });
  }
}