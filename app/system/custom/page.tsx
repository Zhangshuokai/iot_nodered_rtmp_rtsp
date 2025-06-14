'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { FormError } from '@/app/components/ui/form-error';
import { FormLabel } from '@/app/components/ui/form-label';

// 平台定制表单验证模式
const customizationSchema = z.object({
  companyName: z.string().min(1, { message: '公司名称不能为空' }),
  companyShortName: z.string().min(1, { message: '公司简称不能为空' }),
  website: z.string().url({ message: '请输入有效的网站URL' }).optional().or(z.literal('')),
  email: z.string().email({ message: '请输入有效的电子邮件地址' }).optional().or(z.literal('')),
  description: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactInfo: z.string().optional(),
  logo: z.string().url({ message: '请输入有效的Logo URL' }).optional().or(z.literal('')),
  favicon: z.string().url({ message: '请输入有效的网站图标URL' }).optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: '请输入有效的十六进制颜色值' }).optional().or(z.literal('')),
});

type CustomizationFormValues = z.infer<typeof customizationSchema>;

export default function PlatformCustomizationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CustomizationFormValues>({
    resolver: zodResolver(customizationSchema),
    defaultValues: {
      companyName: '',
      companyShortName: '',
      website: '',
      email: '',
      description: '',
      country: '',
      city: '',
      address: '',
      contactPerson: '',
      contactPhone: '',
      contactInfo: '',
      logo: '',
      favicon: '',
      primaryColor: '#1890ff',
    },
  });
  
  // 监听表单字段值
  const logo = watch('logo');
  const favicon = watch('favicon');
  const primaryColor = watch('primaryColor');
  
  // 获取平台定制信息
  useEffect(() => {
    const fetchCustomization = async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/platform/customization', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('获取平台定制信息失败');
        }
        
        const result = await response.json();
        
        // 更新表单数据
        reset(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取平台定制信息失败');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCustomization();
  }, [reset]);
  
  // 提交表单
  const onSubmit = async (data: CustomizationFormValues) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/platform/customization', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '更新平台定制信息失败');
      }
      
      setSuccess('平台定制信息更新成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新平台定制信息失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">平台定制</h1>
        <p className="text-secondary-500">自定义平台的品牌和外观</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>公司信息</CardTitle>
          <CardDescription>
            设置公司的基本信息，这些信息将显示在平台的各个位置
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form id="customizationForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <FormLabel htmlFor="companyName" required>公司名称</FormLabel>
                <Input
                  id="companyName"
                  placeholder="请输入公司名称"
                  {...register('companyName')}
                  disabled={isLoading}
                />
                <FormError message={errors.companyName?.message} />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="companyShortName" required>公司简称</FormLabel>
                <Input
                  id="companyShortName"
                  placeholder="请输入公司简称"
                  {...register('companyShortName')}
                  disabled={isLoading}
                />
                <FormError message={errors.companyShortName?.message} />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="website">公司官网</FormLabel>
                <Input
                  id="website"
                  placeholder="请输入公司官网"
                  {...register('website')}
                  disabled={isLoading}
                />
                <FormError message={errors.website?.message} />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="email">公司邮箱</FormLabel>
                <Input
                  id="email"
                  placeholder="请输入公司邮箱"
                  {...register('email')}
                  disabled={isLoading}
                />
                <FormError message={errors.email?.message} />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <FormLabel htmlFor="description">公司简介</FormLabel>
                <Input
                  id="description"
                  placeholder="请输入公司简介"
                  {...register('description')}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="country">国家/地区</FormLabel>
                <Input
                  id="country"
                  placeholder="请输入国家/地区"
                  {...register('country')}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="city">所在城市</FormLabel>
                <Input
                  id="city"
                  placeholder="请输入所在城市"
                  {...register('city')}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <FormLabel htmlFor="address">详细地址</FormLabel>
                <Input
                  id="address"
                  placeholder="请输入详细地址"
                  {...register('address')}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="contactPerson">联系人</FormLabel>
                <Input
                  id="contactPerson"
                  placeholder="请输入联系人"
                  {...register('contactPerson')}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="contactPhone">联系电话</FormLabel>
                <Input
                  id="contactPhone"
                  placeholder="请输入联系电话"
                  {...register('contactPhone')}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <FormLabel htmlFor="contactInfo">联系我们信息</FormLabel>
                <Input
                  id="contactInfo"
                  placeholder="请输入联系我们信息"
                  {...register('contactInfo')}
                  disabled={isLoading}
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>平台外观</CardTitle>
          <CardDescription>
            自定义平台的外观，包括Logo、图标和主题色
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <FormLabel htmlFor="logo">Logo URL</FormLabel>
              <Input
                id="logo"
                placeholder="请输入Logo URL"
                {...register('logo')}
                disabled={isLoading}
              />
              <FormError message={errors.logo?.message} />
              {logo && (
                <div className="mt-2 p-4 border border-secondary-200 rounded-md">
                  <p className="text-sm text-secondary-500 mb-2">预览:</p>
                  <img
                    src={logo}
                    alt="Logo预览"
                    className="h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x50?text=Logo';
                    }}
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <FormLabel htmlFor="favicon">网站图标URL</FormLabel>
              <Input
                id="favicon"
                placeholder="请输入网站图标URL"
                {...register('favicon')}
                disabled={isLoading}
              />
              <FormError message={errors.favicon?.message} />
              {favicon && (
                <div className="mt-2 p-4 border border-secondary-200 rounded-md">
                  <p className="text-sm text-secondary-500 mb-2">预览:</p>
                  <img
                    src={favicon}
                    alt="图标预览"
                    className="h-8 w-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32?text=Icon';
                    }}
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <FormLabel htmlFor="primaryColor">主题色</FormLabel>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  placeholder="#1890ff"
                  {...register('primaryColor')}
                  disabled={isLoading}
                />
                <input
                  type="color"
                  value={primaryColor || '#1890ff'}
                  onChange={(e) => {
                    setValue('primaryColor', e.target.value);
                  }}
                  className="h-10 w-10 p-0 border border-secondary-300 rounded-md"
                />
              </div>
              <FormError message={errors.primaryColor?.message} />
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <div>
            {error && (
              <div className="bg-danger-50 text-danger p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-success-50 text-success p-3 rounded-md text-sm">
                {success}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={isLoading}
            >
              重置
            </Button>
            
            <Button
              type="submit"
              form="customizationForm"
              disabled={isLoading}
            >
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 