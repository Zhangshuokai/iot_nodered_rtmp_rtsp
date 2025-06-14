import { NextRequest, NextResponse } from 'next/server';
import { AuthService, TokenPayload } from './auth';
import { PermissionService } from './permission-service';

/**
 * 认证中间件
 * 验证请求中的JWT令牌，确保用户已登录
 * @param request 请求对象
 * @returns 响应对象或undefined（继续处理请求）
 */
export async function authMiddleware(request: NextRequest): Promise<NextResponse | undefined> {
  try {
    // 从请求头获取Authorization
    const authHeader = request.headers.get('Authorization');
    const token = AuthService.extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: '未提供认证令牌' },
        { status: 401 }
      );
    }

    try {
      // 验证令牌
      const decoded = AuthService.verifyToken(token);
      
      // 将用户信息添加到请求中
      // 由于Next.js的请求对象是不可变的，我们需要通过其他方式传递用户信息
      // 这里我们使用请求头来传递用户ID
      const requestWithUser = new NextRequest(request, {
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'X-User-Id': decoded.id,
        },
      });
      
      return NextResponse.next({
        request: requestWithUser,
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, message: '无效的认证令牌' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('认证中间件错误:', error);
    return NextResponse.json(
      { success: false, message: '认证处理失败' },
      { status: 500 }
    );
  }
}

/**
 * 验证请求权限
 * 检查用户是否已认证并具有指定的权限
 * @param request 请求对象
 * @param permissions 需要的权限编码数组
 * @returns 验证结果对象
 */
export async function validateRequest(request: NextRequest, permissions: string[] = []) {
  try {
    // 从请求头获取Authorization
    const authHeader = request.headers.get('Authorization');
    const token = AuthService.extractTokenFromHeader(authHeader || '');

    if (!token) {
      return { isAuthorized: false, user: null, error: '未提供认证令牌' };
    }

    try {
      // 验证令牌
      const user = AuthService.verifyToken(token);
      
      // 如果不需要检查权限，直接返回授权成功
      if (permissions.length === 0) {
        return { isAuthorized: true, user, error: null };
      }
      
      // 检查用户权限
      const permissionService = new PermissionService();
      const hasPermission = await permissionService.hasPermissions(user.id, permissions);

      if (!hasPermission) {
        return { isAuthorized: false, user, error: '权限不足' };
      }

      return { isAuthorized: true, user, error: null };
    } catch (error) {
      return { isAuthorized: false, user: null, error: '无效的认证令牌' };
    }
  } catch (error) {
    console.error('请求验证错误:', error);
    return { isAuthorized: false, user: null, error: '认证处理失败' };
  }
}

/**
 * 权限检查中间件
 * 检查用户是否具有指定的权限
 * @param permissionCode 权限编码
 * @returns 中间件函数
 */
export function permissionMiddleware(permissionCode: string) {
  return async (request: NextRequest): Promise<NextResponse | undefined> => {
    try {
      // 从请求头获取用户ID
      const userId = request.headers.get('X-User-Id');
      
      if (!userId) {
        return NextResponse.json(
          { success: false, message: '未认证的请求' },
          { status: 401 }
        );
      }

      // 检查用户权限
      const permissionService = new PermissionService();
      const hasPermission = await permissionService.hasPermission(userId, permissionCode);

      if (!hasPermission) {
        return NextResponse.json(
          { success: false, message: '权限不足' },
          { status: 403 }
        );
      }

      // 继续处理请求
      return NextResponse.next();
    } catch (error) {
      console.error('权限检查中间件错误:', error);
      return NextResponse.json(
        { success: false, message: '权限检查失败' },
        { status: 500 }
      );
    }
  };
}

/**
 * 请求限速中间件
 * 限制API请求频率，防止恶意请求
 * @param limit 时间窗口内的请求限制
 * @param window 时间窗口（毫秒）
 * @returns 中间件函数
 */
export function rateLimitMiddleware(limit: number = 100, window: number = 60000) {
  // 请求记录，格式为: { [ip]: { count: number, resetTime: number } }
  const requestRecords: Record<string, { count: number; resetTime: number }> = {};

  return async (request: NextRequest): Promise<NextResponse | undefined> => {
    try {
      // 获取客户端IP
      const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                '127.0.0.1';
      const now = Date.now();

      // 初始化或重置请求记录
      if (!requestRecords[ip] || now > requestRecords[ip].resetTime) {
        requestRecords[ip] = {
          count: 0,
          resetTime: now + window,
        };
      }

      // 增加请求计数
      requestRecords[ip].count++;

      // 检查是否超过限制
      if (requestRecords[ip].count > limit) {
        return NextResponse.json(
          { success: false, message: '请求过于频繁，请稍后再试' },
          { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((requestRecords[ip].resetTime - now) / 1000)),
            }
          }
        );
      }

      // 继续处理请求
      return NextResponse.next();
    } catch (error) {
      console.error('请求限速中间件错误:', error);
      // 发生错误时继续处理请求，不阻止用户访问
      return NextResponse.next();
    }
  };
}

/**
 * 错误处理中间件
 * 统一处理API错误，返回标准格式的错误响应
 * @param error 错误对象
 * @returns 错误响应
 */
export function errorHandler(error: any): NextResponse {
  console.error('API错误:', error);

  // 确定错误状态码
  let status = 500;
  if (error.status) {
    status = error.status;
  } else if (error.name === 'ValidationError') {
    status = 400;
  } else if (error.name === 'UnauthorizedError') {
    status = 401;
  } else if (error.name === 'ForbiddenError') {
    status = 403;
  } else if (error.name === 'NotFoundError') {
    status = 404;
  }

  // 构建错误响应
  return NextResponse.json(
    {
      success: false,
      message: error.message || '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    { status }
  );
}

/**
 * 响应格式化函数
 * 统一API响应格式
 * @param data 响应数据
 * @param message 响应消息
 * @param status 状态码
 * @returns 格式化的响应对象
 */
export function formatResponse(data: any, message: string = '操作成功', status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * 获取当前用户ID
 * 从请求头中提取用户ID
 * @param request 请求对象
 * @returns 用户ID或null
 */
export function getCurrentUserId(request: NextRequest): string | null {
  return request.headers.get('X-User-Id');
}

/**
 * 获取当前用户信息
 * 从请求头中提取用户信息
 * @param request 请求对象
 * @returns 用户信息或null
 */
export function getCurrentUser(request: NextRequest): Partial<TokenPayload> | null {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = AuthService.extractTokenFromHeader(authHeader || '');

    if (!token) {
      return null;
    }

    const decoded = AuthService.verifyToken(token);
    return {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      organizationId: decoded.organizationId,
      roleId: decoded.roleId,
    };
  } catch (error) {
    return null;
  }
} 