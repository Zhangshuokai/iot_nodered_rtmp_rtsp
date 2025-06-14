import prisma from './db-prisma';
import { User, Prisma } from '@prisma/client';
import { AuthService, AuthResult } from './auth';

/**
 * 用户服务类
 * 提供用户相关的数据库操作和认证方法
 */
export class UserService {
  /**
   * 获取所有用户列表
   * @param organizationId 组织ID，用于筛选特定组织的用户
   * @param options 查询选项，包括分页、排序等
   * @returns 用户列表
   */
  async getAllUsers(
    organizationId?: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.UserOrderByWithRelationInput;
      where?: Prisma.UserWhereInput;
      include?: Prisma.UserInclude;
    }
  ): Promise<User[]> {
    try {
      const where: Prisma.UserWhereInput = {
        ...(organizationId ? { organizationId } : {}),
        ...(options?.where || {}),
      };

      return await prisma.user.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy,
        include: options?.include,
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw new Error('获取用户列表失败');
    }
  }

  /**
   * 获取用户总数
   * @param organizationId 组织ID
   * @param where 查询条件
   * @returns 用户总数
   */
  async countUsers(
    organizationId?: string,
    where?: Prisma.UserWhereInput
  ): Promise<number> {
    try {
      return await prisma.user.count({
        where: {
          ...(organizationId ? { organizationId } : {}),
          ...where,
        },
      });
    } catch (error) {
      console.error('获取用户总数失败:', error);
      throw new Error('获取用户总数失败');
    }
  }

  /**
   * 根据ID获取用户详情
   * @param id 用户ID
   * @param include 关联查询选项
   * @returns 用户详情
   */
  async getUserById(
    id: string,
    include?: Prisma.UserInclude
  ): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      console.error(`获取用户 ${id} 详情失败:`, error);
      throw new Error('获取用户详情失败');
    }
  }

  /**
   * 根据用户名获取用户
   * @param username 用户名
   * @returns 用户信息
   */
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { username },
      });
    } catch (error) {
      console.error(`获取用户名 ${username} 的用户失败:`, error);
      throw new Error('获取用户失败');
    }
  }

  /**
   * 根据邮箱获取用户
   * @param email 邮箱
   * @returns 用户信息
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      console.error(`获取邮箱 ${email} 的用户失败:`, error);
      throw new Error('获取用户失败');
    }
  }

  /**
   * 创建用户
   * @param data 用户数据
   * @returns 创建的用户
   */
  async createUser(data: Omit<Prisma.UserCreateInput, 'password'> & { password: string }): Promise<User> {
    try {
      // 加密密码
      const hashedPassword = await AuthService.hashPassword(data.password);
      
      return await prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
        },
      });
    } catch (error) {
      console.error('创建用户失败:', error);
      throw new Error('创建用户失败');
    }
  }

  /**
   * 更新用户
   * @param id 用户ID
   * @param data 更新的用户数据
   * @returns 更新后的用户
   */
  async updateUser(
    id: string,
    data: Prisma.UserUpdateInput
  ): Promise<User> {
    try {
      // 如果包含密码更新，需要加密
      if (data.password && typeof data.password === 'string') {
        data.password = await AuthService.hashPassword(data.password);
      }
      
      return await prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(`更新用户 ${id} 失败:`, error);
      throw new Error('更新用户失败');
    }
  }

  /**
   * 删除用户
   * @param id 用户ID
   * @returns 删除的用户
   */
  async deleteUser(id: string): Promise<User> {
    try {
      return await prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      console.error(`删除用户 ${id} 失败:`, error);
      throw new Error('删除用户失败');
    }
  }

  /**
   * 用户登录
   * @param username 用户名
   * @param password 密码
   * @returns 认证结果
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      // 查找用户
      const user = await this.getUserByUsername(username);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证密码
      const isPasswordValid = await AuthService.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error('密码错误');
      }

      // 检查用户状态
      if (!user.isActive) {
        throw new Error('用户已被禁用');
      }

      // 更新最后登录时间
      await this.updateUser(user.id, { lastLogin: new Date() });

      // 生成令牌
      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = AuthService.generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          organizationId: user.organizationId,
          roleId: user.roleId,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error('用户登录失败:', error);
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @returns 新的访问令牌和刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // 验证刷新令牌
      const decoded = AuthService.verifyToken(refreshToken);
      
      // 获取用户信息
      const user = await this.getUserById(decoded.id);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查用户状态
      if (!user.isActive) {
        throw new Error('用户已被禁用');
      }

      // 生成新令牌
      const newAccessToken = AuthService.generateAccessToken(user);
      const newRefreshToken = AuthService.generateRefreshToken(user.id);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      console.error('刷新令牌失败:', error);
      throw new Error('刷新令牌失败');
    }
  }
} 