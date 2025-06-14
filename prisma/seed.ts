// 准望物联监测平台测试数据生成脚本
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始生成测试数据...');
  
  // 1. 创建组织
  const rootOrg = await prisma.organization.create({
    data: {
      name: '准望科技有限公司',
      code: 'ZW001',
      level: 1,
      description: '总公司'
    }
  });

  // 2. 创建角色
  const adminRole = await prisma.role.create({
    data: {
      name: '系统管理员',
      description: '系统管理员角色'
    }
  });

  // 3. 创建用户
  await prisma.user.create({
    data: {
      username: 'admin',
      password: await bcrypt.hash('123456', 10),
      email: 'admin@example.com',
      name: '系统管理员',
      isActive: true,
      organization: {
        connect: { id: rootOrg.id }
      },
      role: {
        connect: { id: adminRole.id }
      }
    }
  });
  
  console.log('测试数据生成完成！');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
