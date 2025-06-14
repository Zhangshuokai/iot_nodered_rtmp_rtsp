import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 验证错误接口
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 验证请求数据
 * @param schema Zod验证模式
 * @param data 待验证数据
 * @returns 验证结果
 */
export function validateData<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: boolean; data?: T; errors?: ValidationError[] } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: [{ field: '', message: '验证失败' }] 
    };
  }
}

/**
 * 验证请求中间件
 * @param schema Zod验证模式
 * @param source 数据来源
 * @returns 中间件函数
 */
export function validateRequest<T>(
  schema: z.ZodType<T>,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (request: NextRequest): Promise<NextResponse | T> => {
    try {
      let data: unknown;

      // 根据数据来源获取数据
      if (source === 'body') {
        try {
          data = await request.json();
        } catch (error) {
          return NextResponse.json(
            { success: false, message: '无效的JSON数据', errors: [{ field: '', message: '无效的JSON数据' }] },
            { status: 400 }
          );
        }
      } else if (source === 'query') {
        const url = new URL(request.url);
        const params: Record<string, any> = {};
        url.searchParams.forEach((value, key) => {
          params[key] = value;
        });
        data = params;
      } else {
        // params 通常从路由参数获取，在Next.js中需要从外部传入
        data = {};
      }

      // 验证数据
      const result = validateData(schema, data);

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: '验证失败', errors: result.errors },
          { status: 400 }
        );
      }

      // 返回验证后的数据
      return result.data as T;
    } catch (error) {
      console.error('请求验证错误:', error);
      return NextResponse.json(
        { success: false, message: '请求验证失败' },
        { status: 500 }
      );
    }
  };
}

/**
 * 常用验证模式
 */
export const ValidationSchemas = {
  /**
   * 用户登录验证模式
   */
  login: z.object({
    username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
    password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
  }),

  /**
   * 用户注册验证模式
   */
  register: z.object({
    username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
    password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
    email: z.string().email('无效的邮箱地址'),
    name: z.string().min(2, '姓名至少2个字符').max(50, '姓名最多50个字符'),
    organizationId: z.string().uuid('无效的组织ID').optional(),
    roleId: z.string().uuid('无效的角色ID').optional(),
  }),

  /**
   * 用户更新验证模式
   */
  userUpdate: z.object({
    name: z.string().min(2, '姓名至少2个字符').max(50, '姓名最多50个字符').optional(),
    email: z.string().email('无效的邮箱地址').optional(),
    password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符').optional(),
    avatar: z.string().url('无效的头像URL').optional(),
    organizationId: z.string().uuid('无效的组织ID').optional(),
    roleId: z.string().uuid('无效的角色ID').optional(),
    isActive: z.boolean().optional(),
  }),

  /**
   * 组织创建验证模式
   */
  organizationCreate: z.object({
    name: z.string().min(2, '组织名称至少2个字符').max(100, '组织名称最多100个字符'),
    code: z.string().min(2, '组织编码至少2个字符').max(50, '组织编码最多50个字符').optional(),
    parentId: z.string().uuid('无效的父组织ID').optional(),
    level: z.number().int('级别必须是整数').min(1, '级别最小为1').optional(),
    description: z.string().max(500, '描述最多500个字符').optional(),
  }),

  /**
   * 组织更新验证模式
   */
  organizationUpdate: z.object({
    name: z.string().min(2, '组织名称至少2个字符').max(100, '组织名称最多100个字符').optional(),
    description: z.string().max(500, '描述最多500个字符').optional(),
  }),

  /**
   * 角色创建验证模式
   */
  roleCreate: z.object({
    name: z.string().min(2, '角色名称至少2个字符').max(50, '角色名称最多50个字符'),
    code: z.string().min(2, '角色编码至少2个字符').max(50, '角色编码最多50个字符'),
    description: z.string().max(500, '描述最多500个字符').optional(),
    permissionIds: z.array(z.string().uuid('无效的权限ID')).optional(),
  }),

  /**
   * 角色更新验证模式
   */
  roleUpdate: z.object({
    name: z.string().min(2, '角色名称至少2个字符').max(50, '角色名称最多50个字符').optional(),
    description: z.string().max(500, '描述最多500个字符').optional(),
  }),

  /**
   * 权限分配验证模式
   */
  assignPermissions: z.object({
    roleId: z.string().uuid('无效的角色ID'),
    permissionIds: z.array(z.string().uuid('无效的权限ID')),
  }),

  /**
   * 分页查询验证模式
   */
  pagination: z.object({
    page: z.string().regex(/^\d+$/, '页码必须是数字').transform(Number).optional(),
    pageSize: z.string().regex(/^\d+$/, '每页条数必须是数字').transform(Number).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),

  /**
   * ID参数验证模式
   */
  idParam: z.object({
    id: z.string().uuid('无效的ID'),
  }),
}; 