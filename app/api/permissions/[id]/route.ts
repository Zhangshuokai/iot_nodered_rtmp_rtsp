import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 权限更新验证模式
const updatePermissionSchema = z.object({
  name: z.string().min(1, '权限名称不能为空').optional(),
  code: z.string().min(1, '权限编码不能为空').optional(),
  description: z.string().optional().nullable(),
});

// 获取权限详情
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['permission:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 查询权限详情
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!permission) {
      return NextResponse.json({ error: '权限不存在' }, { status: 404 });
    }

    // 格式化返回结果
    const { rolePermissions, ...permissionData } = permission;
    const formattedPermission = {
      ...permissionData,
      roles: rolePermissions.map(rp => rp.role),
    };

    return NextResponse.json({ data: formattedPermission });
  } catch (error) {
    console.error('获取权限详情失败:', error);
    return NextResponse.json({ error: '获取权限详情失败' }, { status: 500 });
  }
}

// 更新权限
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['permission:update']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 检查权限是否存在
    const existingPermission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!existingPermission) {
      return NextResponse.json({ error: '权限不存在' }, { status: 404 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = updatePermissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, code, description } = validationResult.data;

    // 如果更新名称，检查名称是否已存在
    if (name && name !== existingPermission.name) {
      const permissionWithSameName = await prisma.permission.findFirst({
        where: {
          name,
          id: { not: id },
        },
      });

      if (permissionWithSameName) {
        return NextResponse.json({ error: '权限名称已存在' }, { status: 400 });
      }
    }

    // 如果更新编码，检查编码是否已存在
    if (code && code !== existingPermission.code) {
      const permissionWithSameCode = await prisma.permission.findFirst({
        where: {
          code,
          id: { not: id },
        },
      });

      if (permissionWithSameCode) {
        return NextResponse.json({ error: '权限编码已存在' }, { status: 400 });
      }
    }

    // 更新权限
    const updatedPermission = await prisma.permission.update({
      where: { id },
      data: {
        name,
        code,
        description,
      },
    });

    return NextResponse.json({ data: updatedPermission });
  } catch (error) {
    console.error('更新权限失败:', error);
    return NextResponse.json({ error: '更新权限失败' }, { status: 500 });
  }
}

// 删除权限
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['permission:delete']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 检查权限是否存在
    const existingPermission = await prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          select: { roleId: true },
        },
      },
    });

    if (!existingPermission) {
      return NextResponse.json({ error: '权限不存在' }, { status: 404 });
    }

    // 检查是否有角色使用此权限
    if (existingPermission.rolePermissions.length > 0) {
      return NextResponse.json({ error: '无法删除有角色使用的权限，请先移除角色的权限关联' }, { status: 400 });
    }

    // 删除权限
    await prisma.permission.delete({
      where: { id },
    });

    return NextResponse.json({ message: '权限已成功删除' }, { status: 200 });
  } catch (error) {
    console.error('删除权限失败:', error);
    return NextResponse.json({ error: '删除权限失败' }, { status: 500 });
  }
} 