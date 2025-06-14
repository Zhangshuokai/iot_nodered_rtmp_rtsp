import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * HTTP客户端类
 * 提供HTTP请求功能，支持请求拦截、响应处理和错误处理
 */
export class HttpClient {
  private client: AxiosInstance;
  private static instance: HttpClient | null = null;

  /**
   * 构造函数
   * @param baseURL 基础URL
   * @param timeout 超时时间（毫秒）
   */
  constructor(baseURL: string = '', timeout: number = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * 获取HttpClient单例
   * @param baseURL 基础URL
   * @param timeout 超时时间（毫秒）
   * @returns HttpClient实例
   */
  static getInstance(baseURL: string = '', timeout: number = 30000): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient(baseURL, timeout);
    }
    return HttpClient.instance;
  }

  /**
   * 设置请求和响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 在发送请求之前做些什么
        return config;
      },
      (error) => {
        // 对请求错误做些什么
        console.error('请求错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        // 对响应数据做点什么
        return response;
      },
      (error) => {
        // 对响应错误做点什么
        console.error('响应错误:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置认证令牌
   * @param token JWT令牌
   */
  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 清除认证令牌
   */
  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  /**
   * 发送GET请求
   * @param url 请求URL
   * @param params 请求参数
   * @param config 请求配置
   * @returns 响应数据
   */
  async get<T = any>(
    url: string,
    params?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.get<T>(url, {
        params,
        ...config,
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * 发送POST请求
   * @param url 请求URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应数据
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * 发送PUT请求
   * @param url 请求URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应数据
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * 发送PATCH请求
   * @param url 请求URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应数据
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * 发送DELETE请求
   * @param url 请求URL
   * @param config 请求配置
   * @returns 响应数据
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * 处理请求错误
   * @param error 错误对象
   */
  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (response) {
        console.error(`HTTP错误: ${response.status} - ${response.statusText}`);
        console.error('响应数据:', response.data);
      } else {
        console.error('请求失败:', error.message);
      }
    } else {
      console.error('未知错误:', error);
    }
  }

  /**
   * 发送带重试的请求
   * @param requestFn 请求函数
   * @param retries 重试次数
   * @param delay 重试延迟（毫秒）
   * @returns 响应数据
   */
  async withRetry<T>(
    requestFn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i <= retries; i++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        if (i < retries) {
          console.warn(`请求失败，${delay}ms后重试 (${i + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // 指数退避
          delay *= 2;
        }
      }
    }

    throw lastError;
  }

  /**
   * 批量发送请求
   * @param requests 请求配置数组
   * @returns 响应数组
   */
  async batchRequests<T = any>(
    requests: AxiosRequestConfig[]
  ): Promise<AxiosResponse<T>[]> {
    try {
      return await Promise.all(
        requests.map(request => this.client.request<T>(request))
      );
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
} 