import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db-prisma';
import { validateRequest } from '@/lib/api-middleware';
import { z } from 'zod';

// 平台定制更新验证模式
const updateCustomizationSchema = z.object({
  companyName: z.string().min(1, '公司名称不能为空').optional(),
  companyShortName: z.string().min(1, '公司简称不能为空').optional(),
  website: z.string().url('请输入有效的网站URL').optional().nullable(),
  email: z.string().email('请输入有效的电子邮件地址').optional().nullable(),
  description: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  logo: z.string().url('请输入有效的Logo URL').optional().nullable(),
  favicon: z.string().url('请输入有效的网站图标URL').optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '请输入有效的十六进制颜色值').optional().nullable(),
});

// 获取平台定制信息
export async function GET(req: NextRequest) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['platform:read']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 查询平台定制信息
    const customization = await prisma.platformCustomization.findFirst();

    // 如果不存在，返回默认值
    if (!customization) {
      return NextResponse.json({
        data: {
          companyName: '准望物联监测平台',
          companyShortName: '准望物联',
          primaryColor: '#1890ff',
        },
      });
    }

    return NextResponse.json({ data: customization });
  } catch (error) {
    console.error('获取平台定制信息失败:', error);
    return NextResponse.json({ error: '获取平台定制信息失败' }, { status: 500 });
  }
}

// 更新平台定制信息
export async function PUT(req: NextRequest) {
  try {
    const { isAuthorized, error } = await validateRequest(req, ['platform:update']);

    if (!isAuthorized) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 解析请求体
    const body = await req.json();

    // 验证请求数据
    const validationResult = updateCustomizationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const data = validationResult.data;

    // 查询现有的平台定制信息
    const existingCustomization = await prisma.platformCustomization.findFirst();

    let customization;
    if (existingCustomization) {
      // 更新现有的平台定制信息
      customization = await prisma.platformCustomization.update({
        where: { id: existingCustomization.id },
        data,
      });
    } else {
      // 创建新的平台定制信息
      customization = await prisma.platformCustomization.create({
        data: {
          ...data,
          companyName: data.companyName || '准望物联监测平台',
          companyShortName: data.companyShortName || '准望物联',
        },
      });
    }

    return NextResponse.json({ data: customization });
  } catch (error) {
    console.error('更新平台定制信息失败:', error);
    return NextResponse.json({ error: '更新平台定制信息失败' }, { status: 500 });
  }
} 