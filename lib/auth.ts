import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

// JWT密钥，应从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// JWT过期时间
const JWT_EXPIRES_IN = '24h';
// 刷新令牌过期时间
const REFRESH_TOKEN_EXPIRES_IN = '7d';
// 密码加密盐轮数
const SALT_ROUNDS = 10;

/**
 * 用户认证服务
 * 提供用户认证、密码加密和JWT令牌生成等功能
 */
export class AuthService {
  /**
   * 加密密码
   * @param password 明文密码
   * @returns 加密后的密码
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      console.error('密码加密失败:', error);
      throw new Error('密码加密失败');
    }
  }

  /**
   * 验证密码
   * @param password 明文密码
   * @param hashedPassword 加密后的密码
   * @returns 密码是否匹配
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('密码验证失败:', error);
      throw new Error('密码验证失败');
    }
  }

  /**
   * 生成JWT访问令牌
   * @param user 用户对象
   * @returns JWT访问令牌
   */
  static generateAccessToken(user: Partial<User>): string {
    try {
      const payload = {
        id: user.id,
        username: user.username,
        email: user.email,
        organizationId: user.organizationId,
        roleId: user.roleId,
      };
      
      return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (error) {
      console.error('生成访问令牌失败:', error);
      throw new Error('生成访问令牌失败');
    }
  }

  /**
   * 生成刷新令牌
   * @param userId 用户ID
   * @returns 刷新令牌
   */
  static generateRefreshToken(userId: string): string {
    try {
      return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
    } catch (error) {
      console.error('生成刷新令牌失败:', error);
      throw new Error('生成刷新令牌失败');
    }
  }

  /**
   * 验证JWT令牌
   * @param token JWT令牌
   * @returns 解码后的令牌载荷
   */
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('令牌验证失败:', error);
      throw new Error('令牌验证失败');
    }
  }

  /**
   * 从请求头中提取令牌
   * @param authHeader 认证头部字符串
   * @returns 令牌字符串或null
   */
  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7); // 移除 'Bearer ' 前缀
  }
}

/**
 * 用户认证结果接口
 */
export interface AuthResult {
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
}

/**
 * 令牌载荷接口
 */
export interface TokenPayload {
  id: string;
  username: string;
  email: string;
  organizationId: string;
  roleId: string;
  iat: number;
  exp: number;
} 