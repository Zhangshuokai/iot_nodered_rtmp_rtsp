import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';

// 组织树节点接口
interface OrganizationNode {
  id: string;
  name: string;
  code: string;
  level: number;
  description?: string;
  children: OrganizationNode[];
}

// 获取组织树
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, user, error } = await validateRequest(req, ['org:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 获取查询参数
    const url = new URL(req.url);
    const rootId = url.searchParams.get('rootId');
    const maxDepth = parseInt(url.searchParams.get('maxDepth') || '0');

    // 确定根组织
    let rootOrganizationId: string | null = rootId;

    // 如果不是系统管理员且没有指定根组织，则使用用户所在组织作为根组织
    if (!rootOrganizationId && user.role !== 'SYSTEM_ADMIN') {
      rootOrganizationId = user.organizationId;
    }

    // 构建组织树
    const organizationTree = await buildOrganizationTree(rootOrganizationId, maxDepth);

    return NextResponse.json({ data: organizationTree });
  } catch (error) {
    console.error('获取组织树失败:', error);
    return NextResponse.json({ error: '获取组织树失败' }, { status: 500 });
  }
}

// 递归构建组织树
async function buildOrganizationTree(
  parentId: string | null,
  maxDepth: number = 0,
  currentDepth: number = 0
): Promise<OrganizationNode[]> {
  // 如果达到最大深度且最大深度不为0，则不再继续
  if (maxDepth > 0 && currentDepth >= maxDepth) {
    return [];
  }

  // 查询组织
  const organizations = await prisma.organization.findMany({
    where: { parentId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      level: true,
      description: true,
    },
  });

  // 递归构建子树
  const organizationNodes: OrganizationNode[] = [];
  for (const org of organizations) {
    const children = await buildOrganizationTree(org.id, maxDepth, currentDepth + 1);
    organizationNodes.push({
      ...org,
      children,
    });
  }

  return organizationNodes;
}