import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 组织更新验证模式
const updateOrganizationSchema = z.object({
  name: z.string().min(1, '组织名称不能为空').optional(),
  level: z.number().int().min(0, '组织级别必须为非负整数').optional(),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
});

// 获取组织详情
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['org:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 获取查询参数
    const url = new URL(req.url);
    const includeChildren = url.searchParams.get('includeChildren') === 'true';
    const includeUsers = url.searchParams.get('includeUsers') === 'true';

    // 如果不是系统管理员，检查是否有权限查看该组织
    if (user.role !== 'SYSTEM_ADMIN') {
      // 检查组织是否是用户所在组织或其子组织
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
      if (!allowedOrgIds.includes(id)) {
        return NextResponse.json({ error: '无权查看此组织' }, { status: 403 });
      }
    }

    // 查询组织详情
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
        children: includeChildren ? {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            description: true,
          },
        } : undefined,
        users: includeUsers ? {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            avatar: true,
          },
        } : undefined,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 });
    }

    return NextResponse.json({ data: organization });
  } catch (error) {
    console.error('获取组织详情失败:', error);
    return NextResponse.json({ error: '获取组织详情失败' }, { status: 500 });
  }
}

// 更新组织
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['org:update']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = updateOrganizationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { name, level, parentId, description } = validationResult.data;

    // 检查组织是否存在
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 });
    }

    // 如果不是系统管理员，检查是否有权限更新该组织
    if (user.role !== 'SYSTEM_ADMIN' && existingOrg.id !== user.organizationId) {
      return NextResponse.json({ error: '无权更新此组织' }, { status: 403 });
    }

    // 如果要更新父组织，检查父组织是否存在
    if (parentId !== undefined) {
      if (parentId) {
        // 检查父组织是否存在
        const parentOrg = await prisma.organization.findUnique({
          where: { id: parentId },
        });

        if (!parentOrg) {
          return NextResponse.json({ error: '父组织不存在' }, { status: 400 });
        }

        // 检查是否形成循环引用
        if (parentId === id) {
          return NextResponse.json({ error: '组织不能作为自己的父组织' }, { status: 400 });
        }

        // 检查是否将组织移动到其子组织下
        const childrenIds = await getChildrenIds(id);
        if (childrenIds.includes(parentId)) {
          return NextResponse.json({ error: '不能将组织移动到其子组织下' }, { status: 400 });
        }
      }
    }

    // 更新组织
    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name,
        level,
        description,
        parent: parentId === undefined
          ? undefined
          : parentId
            ? { connect: { id: parentId } }
            : { disconnect: true },
      },
    });

    return NextResponse.json({ data: organization });
  } catch (error) {
    console.error('更新组织失败:', error);
    return NextResponse.json({ error: '更新组织失败' }, { status: 500 });
  }
}

// 删除组织
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['org:delete']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = params;

    // 检查组织是否存在
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        children: { select: { id: true } },
        users: { select: { id: true } },
      },
    });

    if (!existingOrg) {
      return NextResponse.json({ error: '组织不存在' }, { status: 404 });
    }

    // 如果不是系统管理员，检查是否有权限删除该组织
    if (user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: '无权删除此组织' }, { status: 403 });
    }

    // 检查是否有子组织
    if (existingOrg.children.length > 0) {
      return NextResponse.json({ error: '无法删除有子组织的组织，请先删除子组织' }, { status: 400 });
    }

    // 检查是否有用户
    if (existingOrg.users.length > 0) {
      return NextResponse.json({ error: '无法删除有用户的组织，请先移除或删除组织中的用户' }, { status: 400 });
    }

    // 删除组织
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ message: '组织已成功删除' }, { status: 200 });
  } catch (error) {
    console.error('删除组织失败:', error);
    return NextResponse.json({ error: '删除组织失败' }, { status: 500 });
  }
}

// 递归获取所有子组织ID
async function getChildrenIds(organizationId: string): Promise<string[]> {
  const children = await prisma.organization.findMany({
    where: { parentId: organizationId },
    select: { id: true },
  });

  const childrenIds = children.map(child => child.id);
  
  // 递归获取所有子组织的子组织
  const descendantIds = await Promise.all(
    childrenIds.map(id => getChildrenIds(id))
  );
  
  return [...childrenIds, ...descendantIds.flat()];
} 