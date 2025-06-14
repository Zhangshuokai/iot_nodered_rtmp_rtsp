'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { FormError } from '@/app/components/ui/form-error';
import { FormLabel } from '@/app/components/ui/form-label';
import { Logo } from '@/app/components/ui/logo';

// 登录表单验证模式
const loginSchema = z.object({
  username: z.string().min(1, { message: '请输入用户名' }),
  password: z.string().min(1, { message: '请输入密码' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });
  
  const onSubmit = async (data: LoginFormValues) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '登录失败');
      }
      
      // 登录成功，保存令牌到本地存储
      localStorage.setItem('token', result.data.accessToken);
      localStorage.setItem('refreshToken', result.data.refreshToken);
      
      // 重定向到仪表板
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-100 dark:bg-secondary-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">登录系统</CardTitle>
            <CardDescription className="text-center">
              输入您的用户名和密码登录
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <FormLabel htmlFor="username" required>用户名</FormLabel>
                <Input
                  id="username"
                  placeholder="请输入用户名"
                  {...register('username')}
                  disabled={isLoading}
                />
                <FormError message={errors.username?.message} />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="password" required>密码</FormLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  {...register('password')}
                  disabled={isLoading}
                />
                <FormError message={errors.password?.message} />
              </div>
              
              {error && (
                <div className="bg-danger-50 text-danger p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                fullWidth={true}
                disabled={isLoading}
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex justify-center">
            <p className="text-sm text-secondary-500">
              准望物联监测平台 &copy; {new Date().getFullYear()}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 