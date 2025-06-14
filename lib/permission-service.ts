import prisma from './db-prisma';
import { Permission, Role, RolePermission, Prisma } from '@prisma/client';

/**
 * 权限服务类
 * 提供权限相关的数据库操作和权限检查方法
 */
export class PermissionService {
  // 权限缓存，用于提高权限检查性能
  private static permissionCache: Map<string, Set<string>> = new Map();

  /**
   * 获取所有权限列表
   * @param options 查询选项，包括分页、排序等
   * @returns 权限列表
   */
  async getAllPermissions(
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.PermissionOrderByWithRelationInput;
      where?: Prisma.PermissionWhereInput;
    }
  ): Promise<Permission[]> {
    try {
      return await prisma.permission.findMany({
        where: options?.where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy,
      });
    } catch (error) {
      console.error('获取权限列表失败:', error);
      throw new Error('获取权限列表失败');
    }
  }

  /**
   * 根据ID获取权限详情
   * @param id 权限ID
   * @returns 权限详情
   */
  async getPermissionById(id: string): Promise<Permission | null> {
    try {
      return await prisma.permission.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error(`获取权限 ${id} 详情失败:`, error);
      throw new Error('获取权限详情失败');
    }
  }

  /**
   * 根据权限编码获取权限
   * @param code 权限编码
   * @returns 权限信息
   */
  async getPermissionByCode(code: string): Promise<Permission | null> {
    try {
      return await prisma.permission.findUnique({
        where: { code },
      });
    } catch (error) {
      console.error(`获取权限编码 ${code} 的权限失败:`, error);
      throw new Error('获取权限失败');
    }
  }

  /**
   * 创建权限
   * @param data 权限数据
   * @returns 创建的权限
   */
  async createPermission(data: Prisma.PermissionCreateInput): Promise<Permission> {
    try {
      return await prisma.permission.create({
        data,
      });
    } catch (error) {
      console.error('创建权限失败:', error);
      throw new Error('创建权限失败');
    }
  }

  /**
   * 更新权限
   * @param id 权限ID
   * @param data 更新的权限数据
   * @returns 更新后的权限
   */
  async updatePermission(
    id: string,
    data: Prisma.PermissionUpdateInput
  ): Promise<Permission> {
    try {
      // 清除权限缓存
      PermissionService.clearPermissionCache();
      
      return await prisma.permission.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(`更新权限 ${id} 失败:`, error);
      throw new Error('更新权限失败');
    }
  }

  /**
   * 删除权限
   * @param id 权限ID
   * @returns 删除的权限
   */
  async deletePermission(id: string): Promise<Permission> {
    try {
      // 清除权限缓存
      PermissionService.clearPermissionCache();
      
      return await prisma.permission.delete({
        where: { id },
      });
    } catch (error) {
      console.error(`删除权限 ${id} 失败:`, error);
      throw new Error('删除权限失败');
    }
  }

  /**
   * 获取所有角色列表
   * @param options 查询选项，包括分页、排序等
   * @returns 角色列表
   */
  async getAllRoles(
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.RoleOrderByWithRelationInput;
      where?: Prisma.RoleWhereInput;
      include?: Prisma.RoleInclude;
    }
  ): Promise<Role[]> {
    try {
      return await prisma.role.findMany({
        where: options?.where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy,
        include: options?.include,
      });
    } catch (error) {
      console.error('获取角色列表失败:', error);
      throw new Error('获取角色列表失败');
    }
  }

  /**
   * 根据ID获取角色详情
   * @param id 角色ID
   * @param include 关联查询选项
   * @returns 角色详情
   */
  async getRoleById(
    id: string,
    include?: Prisma.RoleInclude
  ): Promise<Role | null> {
    try {
      return await prisma.role.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      console.error(`获取角色 ${id} 详情失败:`, error);
      throw new Error('获取角色详情失败');
    }
  }

  /**
   * 创建角色
   * @param data 角色数据
   * @returns 创建的角色
   */
  async createRole(data: Prisma.RoleCreateInput): Promise<Role> {
    try {
      return await prisma.role.create({
        data,
      });
    } catch (error) {
      console.error('创建角色失败:', error);
      throw new Error('创建角色失败');
    }
  }

  /**
   * 更新角色
   * @param id 角色ID
   * @param data 更新的角色数据
   * @returns 更新后的角色
   */
  async updateRole(
    id: string,
    data: Prisma.RoleUpdateInput
  ): Promise<Role> {
    try {
      // 清除权限缓存
      PermissionService.clearPermissionCache();
      
      return await prisma.role.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(`更新角色 ${id} 失败:`, error);
      throw new Error('更新角色失败');
    }
  }

  /**
   * 删除角色
   * @param id 角色ID
   * @returns 删除的角色
   */
  async deleteRole(id: string): Promise<Role> {
    try {
      // 清除权限缓存
      PermissionService.clearPermissionCache();
      
      return await prisma.role.delete({
        where: { id },
      });
    } catch (error) {
      console.error(`删除角色 ${id} 失败:`, error);
      throw new Error('删除角色失败');
    }
  }

  /**
   * 为角色分配权限
   * @param roleId 角色ID
   * @param permissionIds 权限ID数组
   * @returns 分配结果
   */
  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[]
  ): Promise<{ success: boolean; count: number }> {
    try {
      // 清除权限缓存
      PermissionService.clearPermissionCache();
      
      // 先删除该角色的所有权限
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // 批量创建新的角色权限关联
      const rolePermissions = await prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId,
          permissionId,
        })),
      });

      return {
        success: true,
        count: rolePermissions.count,
      };
    } catch (error) {
      console.error(`为角色 ${roleId} 分配权限失败:`, error);
      throw new Error('分配权限失败');
    }
  }

  /**
   * 获取角色的所有权限
   * @param roleId 角色ID
   * @returns 权限列表
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    try {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId },
        include: {
          permission: true,
        },
      });

      return rolePermissions.map(rp => rp.permission);
    } catch (error) {
      console.error(`获取角色 ${roleId} 的权限失败:`, error);
      throw new Error('获取角色权限失败');
    }
  }

  /**
   * 检查用户是否具有指定权限
   * @param userId 用户ID
   * @param permissionCode 权限编码
   * @returns 是否具有权限
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    try {
      // 获取用户角色
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { roleId: true },
      });

      if (!user) {
        return false;
      }

      // 查询角色是否具有指定权限
      const permission = await prisma.permission.findUnique({
        where: { code: permissionCode },
      });

      if (!permission) {
        return false;
      }

      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: user.roleId,
          permissionId: permission.id,
        },
      });

      return !!rolePermission;
    } catch (error) {
      console.error('权限检查失败:', error);
      return false;
    }
  }

  /**
   * 检查用户是否具有指定的多个权限
   * @param userId 用户ID
   * @param permissionCodes 权限编码数组
   * @returns 是否具有所有指定权限
   */
  async hasPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
    try {
      // 如果权限列表为空，直接返回true
      if (permissionCodes.length === 0) {
        return true;
      }

      // 获取用户角色
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { roleId: true },
      });

      if (!user) {
        return false;
      }

      // 查询所有指定的权限
      const permissions = await prisma.permission.findMany({
        where: {
          code: { in: permissionCodes },
        },
      });

      // 如果找不到任何权限，返回false
      if (permissions.length === 0) {
        return false;
      }

      // 获取权限ID列表
      const permissionIds = permissions.map(p => p.id);

      // 查询用户角色是否具有所有指定权限
      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          roleId: user.roleId,
          permissionId: { in: permissionIds },
        },
      });

      // 检查是否具有所有权限
      return rolePermissions.length === permissionCodes.length;
    } catch (error) {
      console.error('权限检查失败:', error);
      return false;
    }
  }

  /**
   * 从缓存获取用户权限
   * @param userId 用户ID
   * @returns 权限编码集合
   */
  private static getPermissionFromCache(userId: string): Set<string> | null {
    return PermissionService.permissionCache.get(userId) || null;
  }

  /**
   * 设置用户权限到缓存
   * @param userId 用户ID
   * @param permissions 权限编码集合
   */
  private static setPermissionToCache(userId: string, permissions: Set<string>): void {
    PermissionService.permissionCache.set(userId, permissions);
  }

  /**
   * 清除权限缓存
   */
  private static clearPermissionCache(): void {
    PermissionService.permissionCache.clear();
  }

  /**
   * 清除指定用户的权限缓存
   * @param userId 用户ID
   */
  static clearUserPermissionCache(userId: string): void {
    PermissionService.permissionCache.delete(userId);
  }
} 