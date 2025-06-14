/**
 * 安全中间件 - 实现XSS和CSRF防护功能
 * 
 * 该中间件实现了以下功能：
 * 1. XSS防护 - 输入过滤和转义
 * 2. CSRF防护 - CSRF令牌验证
 * 3. 内容安全策略(CSP)
 * 4. 安全HTTP头部设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { cryptoService } from './crypto-service';

// CSRF令牌的Cookie名称
const CSRF_TOKEN_COOKIE = 'csrf_token';
// CSRF令牌的请求头名称
const CSRF_TOKEN_HEADER = 'x-csrf-token';
// CSRF令牌的有效期（1小时）
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * 安全中间件配置选项
 */
export interface SecurityMiddlewareOptions {
  // 是否启用XSS防护
  enableXSS?: boolean;
  // 是否启用CSRF防护
  enableCSRF?: boolean;
  // 是否启用CSP
  enableCSP?: boolean;
  // 是否启用安全头部
  enableSecureHeaders?: boolean;
  // 排除CSRF验证的路径
  csrfExcludePaths?: string[];
  // CSP配置
  cspConfig?: Record<string, string[]>;
}

/**
 * 默认CSP配置
 */
const defaultCSPConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'media-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-src': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};

/**
 * 安全中间件类
 */
export class SecurityMiddleware {
  private options: SecurityMiddlewareOptions;

  /**
   * 构造函数
   * @param options 中间件配置选项
   */
  constructor(options: SecurityMiddlewareOptions = {}) {
    this.options = {
      enableXSS: true,
      enableCSRF: true,
      enableCSP: true,
      enableSecureHeaders: true,
      csrfExcludePaths: ['/api/auth/login', '/api/auth/register'],
      cspConfig: defaultCSPConfig,
      ...options
    };
  }

  /**
   * 生成CSRF令牌
   * @returns CSRF令牌
   */
  private generateCSRFToken(): string {
    return cryptoService.generateRandomString(32);
  }

  /**
   * 验证CSRF令牌
   * @param request 请求对象
   * @returns 令牌是否有效
   */
  private validateCSRFToken(request: NextRequest): boolean {
    // 获取请求中的CSRF令牌
    const csrfToken = request.headers.get(CSRF_TOKEN_HEADER);
    
    // 获取Cookie中的CSRF令牌
    const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
    
    // 如果令牌不存在，则验证失败
    if (!csrfToken || !cookieToken) {
      return false;
    }
    
    // 比较令牌是否一致
    return csrfToken === cookieToken;
  }

  /**
   * 检查是否需要CSRF验证
   * @param request 请求对象
   * @returns 是否需要CSRF验证
   */
  private needsCSRFCheck(request: NextRequest): boolean {
    // 只对修改数据的请求方法进行CSRF验证
    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return false;
    }
    
    // 检查是否在排除路径中
    const path = new URL(request.url).pathname;
    if (this.options.csrfExcludePaths?.some(excludePath => path.startsWith(excludePath))) {
      return false;
    }
    
    return true;
  }

  /**
   * 生成CSP头部
   * @returns CSP头部值
   */
  private generateCSPHeader(): string {
    const cspConfig = this.options.cspConfig || defaultCSPConfig;
    
    return Object.entries(cspConfig)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * 设置安全头部
   * @param response 响应对象
   */
  private setSecurityHeaders(response: NextResponse): void {
    // 设置X-Content-Type-Options头部，防止MIME类型嗅探
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // 设置X-Frame-Options头部，防止点击劫持
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    
    // 设置X-XSS-Protection头部，启用浏览器XSS过滤
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // 设置Referrer-Policy头部，控制Referrer信息的发送
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // 设置Strict-Transport-Security头部，强制使用HTTPS
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // 设置Permissions-Policy头部，控制浏览器功能
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // 设置Content-Security-Policy头部，防止XSS和数据注入
    if (this.options.enableCSP) {
      response.headers.set('Content-Security-Policy', this.generateCSPHeader());
    }
  }

  /**
   * 过滤XSS内容
   * @param input 输入字符串
   * @returns 过滤后的字符串
   */
  public sanitizeXSS(input: string): string {
    if (!input) return input;
    
    // 替换可能导致XSS的字符
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * 递归过滤对象中的XSS内容
   * @param obj 输入对象
   * @returns 过滤后的对象
   */
  public sanitizeObject(obj: any): any {
    if (!obj) return obj;
    
    if (typeof obj === 'string') {
      return this.sanitizeXSS(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.sanitizeObject(obj[key]);
        }
      }
      return result;
    }
    
    return obj;
  }

  /**
   * 中间件处理函数
   * @param request 请求对象
   * @param next 下一个中间件
   * @returns 响应对象
   */
  public async middleware(request: NextRequest): Promise<NextResponse> {
    // 创建响应对象
    let response: NextResponse;
    
    // CSRF验证
    if (this.options.enableCSRF && this.needsCSRFCheck(request)) {
      // 验证CSRF令牌
      if (!this.validateCSRFToken(request)) {
        // 如果验证失败，返回403错误
        response = NextResponse.json(
          { error: 'CSRF token validation failed' },
          { status: 403 }
        );
        return response;
      }
    }
    
    // 克隆请求对象
    const nextRequest = request.clone();
    
    // XSS过滤
    if (this.options.enableXSS && request.body) {
      try {
        // 获取请求体
        const contentType = request.headers.get('content-type') || '';
        
        // 处理JSON请求体
        if (contentType.includes('application/json')) {
          const body = await request.json();
          const sanitizedBody = this.sanitizeObject(body);
          
          // 创建新的请求对象
          const newRequest = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: JSON.stringify(sanitizedBody),
            cache: request.cache,
            credentials: request.credentials,
            integrity: request.integrity,
            keepalive: request.keepalive,
            mode: request.mode,
            redirect: request.redirect,
            referrer: request.referrer,
            referrerPolicy: request.referrerPolicy,
            signal: request.signal,
          });
          
          // 继续处理请求
          response = await NextResponse.next(newRequest);
        } else {
          // 对于非JSON请求，直接继续处理
          response = await NextResponse.next(nextRequest);
        }
      } catch (error) {
        // 如果解析请求体失败，直接继续处理原始请求
        console.error('Failed to parse request body for XSS sanitization:', error);
        response = await NextResponse.next(nextRequest);
      }
    } else {
      // 如果不需要XSS过滤，直接继续处理请求
      response = await NextResponse.next(nextRequest);
    }
    
    // 设置安全头部
    if (this.options.enableSecureHeaders) {
      this.setSecurityHeaders(response);
    }
    
    // 如果是GET请求且启用了CSRF保护，设置CSRF令牌
    if (this.options.enableCSRF && request.method === 'GET') {
      // 生成新的CSRF令牌
      const csrfToken = this.generateCSRFToken();
      
      // 设置CSRF令牌Cookie
      response.cookies.set({
        name: CSRF_TOKEN_COOKIE,
        value: csrfToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: CSRF_TOKEN_EXPIRY / 1000, // 转换为秒
        path: '/'
      });
      
      // 在响应头中也设置CSRF令牌，前端可以从中获取
      response.headers.set(CSRF_TOKEN_HEADER, csrfToken);
    }
    
    return response;
  }

  /**
   * 创建中间件处理函数
   * @returns 中间件处理函数
   */
  public createMiddleware() {
    return async (request: NextRequest) => {
      return this.middleware(request);
    };
  }
}

// 创建默认的安全中间件实例
export const securityMiddleware = new SecurityMiddleware();

// 导出中间件处理函数
export const middleware = securityMiddleware.createMiddleware();

export default securityMiddleware; 