import prisma from './db-prisma';
import { Organization, Prisma } from '@prisma/client';

/**
 * 组织服务类
 * 提供组织相关的数据库操作和组织树结构管理方法
 */
export class OrganizationService {
  /**
   * 获取所有组织列表
   * @param options 查询选项，包括分页、排序等
   * @returns 组织列表
   */
  async getAllOrganizations(
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.OrganizationOrderByWithRelationInput;
      where?: Prisma.OrganizationWhereInput;
      include?: Prisma.OrganizationInclude;
    }
  ): Promise<Organization[]> {
    try {
      return await prisma.organization.findMany({
        where: options?.where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy,
        include: options?.include,
      });
    } catch (error) {
      console.error('获取组织列表失败:', error);
      throw new Error('获取组织列表失败');
    }
  }

  /**
   * 根据ID获取组织详情
   * @param id 组织ID
   * @param include 关联查询选项
   * @returns 组织详情
   */
  async getOrganizationById(
    id: string,
    include?: Prisma.OrganizationInclude
  ): Promise<Organization | null> {
    try {
      return await prisma.organization.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      console.error(`获取组织 ${id} 详情失败:`, error);
      throw new Error('获取组织详情失败');
    }
  }

  /**
   * 创建组织
   * @param data 组织数据
   * @returns 创建的组织
   */
  async createOrganization(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    try {
      return await prisma.organization.create({
        data,
      });
    } catch (error) {
      console.error('创建组织失败:', error);
      throw new Error('创建组织失败');
    }
  }

  /**
   * 更新组织
   * @param id 组织ID
   * @param data 更新的组织数据
   * @returns 更新后的组织
   */
  async updateOrganization(
    id: string,
    data: Prisma.OrganizationUpdateInput
  ): Promise<Organization> {
    try {
      return await prisma.organization.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(`更新组织 ${id} 失败:`, error);
      throw new Error('更新组织失败');
    }
  }

  /**
   * 删除组织
   * @param id 组织ID
   * @returns 删除的组织
   */
  async deleteOrganization(id: string): Promise<Organization> {
    try {
      // 检查是否有子组织
      const childCount = await prisma.organization.count({
        where: { parentId: id },
      });

      if (childCount > 0) {
        throw new Error('该组织下有子组织，无法删除');
      }

      // 检查是否有关联用户
      const userCount = await prisma.user.count({
        where: { organizationId: id },
      });

      if (userCount > 0) {
        throw new Error('该组织下有用户，无法删除');
      }

      return await prisma.organization.delete({
        where: { id },
      });
    } catch (error) {
      console.error(`删除组织 ${id} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取组织树
   * @param rootId 根组织ID，如果不提供则获取所有顶级组织
   * @returns 组织树结构
   */
  async getOrganizationTree(rootId?: string): Promise<OrganizationTree[]> {
    try {
      // 获取所有组织
      const allOrganizations = await prisma.organization.findMany({
        orderBy: { level: 'asc' },
      });

      // 如果指定了根组织ID，则只返回该组织及其子组织
      if (rootId) {
        const rootOrg = allOrganizations.find(org => org.id === rootId);
        if (!rootOrg) {
          throw new Error('根组织不存在');
        }
        return this.buildOrganizationTree([rootOrg], allOrganizations);
      }

      // 获取顶级组织（没有父组织的组织）
      const rootOrganizations = allOrganizations.filter(org => !org.parentId);
      
      // 构建组织树
      return this.buildOrganizationTree(rootOrganizations, allOrganizations);
    } catch (error) {
      console.error('获取组织树失败:', error);
      throw new Error('获取组织树失败');
    }
  }

  /**
   * 构建组织树
   * @param roots 根组织列表
   * @param allOrganizations 所有组织列表
   * @returns 组织树结构
   */
  private buildOrganizationTree(
    roots: Organization[],
    allOrganizations: Organization[]
  ): OrganizationTree[] {
    return roots.map(root => {
      // 查找当前组织的子组织
      const children = allOrganizations.filter(org => org.parentId === root.id);
      
      // 递归构建子组织树
      const childrenTree = this.buildOrganizationTree(children, allOrganizations);
      
      return {
        id: root.id,
        name: root.name,
        code: root.code,
        level: root.level,
        parentId: root.parentId,
        description: root.description,
        children: childrenTree,
      };
    });
  }

  /**
   * 生成组织编码
   * @param parentCode 父组织编码
   * @param level 组织级别
   * @returns 新的组织编码
   */
  async generateOrganizationCode(parentCode?: string, level: number = 1): Promise<string> {
    try {
      if (!parentCode) {
        // 顶级组织编码规则：ORG + 3位序号，如ORG001
        const topOrgs = await prisma.organization.findMany({
          where: { level: 1 },
          orderBy: { code: 'desc' },
          take: 1,
        });

        if (topOrgs.length === 0) {
          return 'ORG001';
        }

        const lastCode = topOrgs[0].code;
        const lastNum = parseInt(lastCode.substring(3));
        return `ORG${String(lastNum + 1).padStart(3, '0')}`;
      } else {
        // 子组织编码规则：父编码 + 3位序号，如ORG001001
        const childOrgs = await prisma.organization.findMany({
          where: { 
            parentId: { not: null },
            code: { startsWith: parentCode }
          },
          orderBy: { code: 'desc' },
          take: 1,
        });

        if (childOrgs.length === 0) {
          return `${parentCode}001`;
        }

        const lastCode = childOrgs[0].code;
        const lastNum = parseInt(lastCode.substring(parentCode.length));
        return `${parentCode}${String(lastNum + 1).padStart(3, '0')}`;
      }
    } catch (error) {
      console.error('生成组织编码失败:', error);
      throw new Error('生成组织编码失败');
    }
  }

  /**
   * 移动组织
   * @param id 组织ID
   * @param newParentId 新的父组织ID
   * @returns 更新后的组织
   */
  async moveOrganization(id: string, newParentId: string): Promise<Organization> {
    try {
      // 获取新父组织
      const newParent = await this.getOrganizationById(newParentId);
      if (!newParent) {
        throw new Error('新的父组织不存在');
      }

      // 获取当前组织
      const org = await this.getOrganizationById(id);
      if (!org) {
        throw new Error('组织不存在');
      }

      // 检查是否形成循环引用
      if (await this.isDescendant(newParentId, id)) {
        throw new Error('不能将组织移动到其子组织下');
      }

      // 计算新的组织级别
      const newLevel = newParent.level + 1;

      // 生成新的组织编码
      const newCode = await this.generateOrganizationCode(newParent.code, newLevel);

      // 更新组织
      return await this.updateOrganization(id, {
        parent: { connect: { id: newParentId } },
        level: newLevel,
        code: newCode,
      });
    } catch (error) {
      console.error(`移动组织 ${id} 失败:`, error);
      throw error;
    }
  }

  /**
   * 检查组织是否是另一个组织的后代
   * @param orgId 组织ID
   * @param potentialAncestorId 潜在祖先组织ID
   * @returns 是否是后代
   */
  private async isDescendant(orgId: string, potentialAncestorId: string): Promise<boolean> {
    try {
      let currentId = orgId;
      
      while (currentId) {
        if (currentId === potentialAncestorId) {
          return true;
        }
        
        const org = await this.getOrganizationById(currentId);
        if (!org || !org.parentId) {
          break;
        }
        
        currentId = org.parentId;
      }
      
      return false;
    } catch (error) {
      console.error('检查组织关系失败:', error);
      throw new Error('检查组织关系失败');
    }
  }
}

/**
 * 组织树节点接口
 */
export interface OrganizationTree {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  description: string | null;
  children: OrganizationTree[];
} 