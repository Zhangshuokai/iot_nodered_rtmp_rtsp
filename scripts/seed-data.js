// 准望物联监测平台测试数据生成脚本
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('开始生成测试数据...');

  try {
    // 清除现有数据
    await cleanDatabase();

    // 1. 创建组织
    const rootOrg = await createRootOrganization();
    const subOrg1 = await createSubOrganization(rootOrg.id, '研发部', 'RD001');
    const subOrg2 = await createSubOrganization(rootOrg.id, '测试部', 'TEST001');
    
    // 2. 创建角色和权限
    const { adminRole, orgAdminRole, normalRole, deviceRole } = await createRolesAndPermissions();
    
    // 3. 创建用户
    const adminUser = await createUser('admin', '系统管理员', adminRole.id, rootOrg.id);
    const orgAdminUser = await createUser('orgadmin', '组织管理员', orgAdminRole.id, subOrg1.id);
    const normalUser = await createUser('user', '普通用户', normalRole.id, subOrg2.id);
    
    // 4. 创建设备类
    const gatewayClass = await createDeviceClass('智能网关', 'gateway', 'DIRECT_DEVICE', 'MQTT', rootOrg.id);
    const sensorClass = await createDeviceClass('温湿度传感器', 'sensor', 'GATEWAY_CHILD', 'MQTT', subOrg1.id);
    const cameraClass = await createDeviceClass('监控摄像头', 'camera', 'DIRECT_DEVICE', 'HTTP', subOrg2.id);
    
    // 5. 创建设备
    const gateway = await createDevice('网关设备001', gatewayClass.id, rootOrg.id);
    const sensor1 = await createDevice('温湿度传感器001', sensorClass.id, subOrg1.id, gateway.id);
    const sensor2 = await createDevice('温湿度传感器002', sensorClass.id, subOrg1.id, gateway.id);
    const camera = await createDevice('监控摄像头001', cameraClass.id, subOrg2.id);

    // 6. 创建设备命令
    await createDeviceCommand(gateway.id, '重启设备', 'restart', { action: 'restart' });
    await createDeviceCommand(sensor1.id, '设置采集频率', 'setFrequency', { frequency: 60 });

    // 7. 创建设备事件
    await createDeviceEvent(gateway.id, 'online', '设备上线', 'status', { status: 'online', time: new Date() });
    await createDeviceEvent(sensor1.id, 'data', '数据上报', 'data', { temperature: 25.5, humidity: 60.2, time: new Date() });

    // 8. 创建设备告警
    await createDeviceAlarm(gateway.id, 'WARNING', '网关连接不稳定');
    await createDeviceAlarm(sensor1.id, 'SEVERE', '传感器温度过高', adminUser.id);

    console.log('测试数据生成完成！');
  } catch (error) {
    console.error('生成测试数据失败:', error);
  }
}

async function cleanDatabase() {
  // 按照依赖关系顺序删除数据
  await prisma.apiAccessLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.reportConfig.deleteMany();
  await prisma.taskExecution.deleteMany();
  await prisma.task.deleteMany();
  await prisma.trigger.deleteMany();
  await prisma.deviceAlarm.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.deviceConnection.deleteMany();
  await prisma.deviceEvent.deleteMany();
  await prisma.deviceCommand.deleteMany();
  await prisma.device.deleteMany();
  await prisma.deviceClass.deleteMany();
  await prisma.dashboard.deleteMany();
  await prisma.videoConfig.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.platformCustomization.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.organization.deleteMany();
}

async function createRootOrganization() {
  return await prisma.organization.create({
    data: {
      name: '准望科技有限公司',
      code: 'ZW001',
      level: 1,
      description: '总公司'
    }
  });
}

async function createSubOrganization(parentId, name, code) {
  return await prisma.organization.create({
    data: {
      name,
      code,
      level: 2,
      parentId,
      description: `${name}部门`
    }
  });
}

async function createRolesAndPermissions() {
  // 创建权限
  const permissions = await Promise.all([
    prisma.permission.create({
      data: {
        name: '系统管理',
        code: 'SYSTEM_MANAGE',
        description: '系统管理权限'
      }
    }),
    prisma.permission.create({
      data: {
        name: '设备管理',
        code: 'DEVICE_MANAGE',
        description: '设备管理权限'
      }
    }),
    prisma.permission.create({
      data: {
        name: '设备查看',
        code: 'DEVICE_VIEW',
        description: '设备查看权限'
      }
    })
  ]);

  // 创建角色
  const adminRole = await prisma.role.create({
    data: {
      name: '系统管理员',
      description: '系统管理员角色'
    }
  });

  const orgAdminRole = await prisma.role.create({
    data: {
      name: '组织管理员',
      description: '组织管理员角色'
    }
  });

  const normalRole = await prisma.role.create({
    data: {
      name: '普通用户',
      description: '普通用户角色'
    }
  });

  const deviceRole = await prisma.role.create({
    data: {
      name: '设备用户',
      description: '设备用户角色'
    }
  });

  // 分配权限
  // 系统管理员拥有所有权限
  await Promise.all(permissions.map(permission => 
    prisma.rolePermission.create({
      data: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    })
  ));

  // 组织管理员拥有除系统管理外的所有权限
  await Promise.all(permissions.slice(1).map(permission => 
    prisma.rolePermission.create({
      data: {
        roleId: orgAdminRole.id,
        permissionId: permission.id
      }
    })
  ));

  // 普通用户拥有查看权限
  await prisma.rolePermission.create({
    data: {
      roleId: normalRole.id,
      permissionId: permissions[2].id // 设备查看权限
    }
  });

  // 设备用户拥有设备查看权限
  await prisma.rolePermission.create({
    data: {
      roleId: deviceRole.id,
      permissionId: permissions[2].id // 设备查看权限
    }
  });

  return { adminRole, orgAdminRole, normalRole, deviceRole };
}

async function createUser(username, name, roleId, organizationId) {
  const hashedPassword = await bcrypt.hash('123456', 10);
  return await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      email: `${username}@example.com`,
      name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      phone: '13800138000',
      isActive: true,
      lastLogin: new Date(),
      organizationId,
      roleId
    }
  });
}

async function createDeviceClass(name, category, type, protocol, organizationId) {
  return await prisma.deviceClass.create({
    data: {
      name,
      image: `/images/devices/${category}.png`,
      category,
      type,
      configType: 'DEFAULT',
      protocol,
      defaultConfig: {
        topic: `/${category}/+/data`,
        qos: 1,
        clientId: `${category}_{{deviceId}}`,
        username: '{{username}}',
        password: '{{password}}'
      },
      description: `${name}设备类`,
      isDefault: category === 'gateway',
      isPublic: true,
      organizationId
    }
  });
}

async function createDevice(name, deviceClassId, organizationId, parentId = null) {
  return await prisma.device.create({
    data: {
      name,
      alias: `${name}-别名`,
      deviceClassId,
      status: 'OFFLINE',
      config: {
        topic: '/device/data',
        clientId: `device_${Date.now()}`,
        username: 'device',
        password: 'password'
      },
      organizationId,
      parentId,
      isPublic: false,
      isFeatured: false,
      lastConnected: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1天前
      lastDisconnected: new Date(Date.now() - 23 * 60 * 60 * 1000) // 23小时前
    }
  });
}

async function createDeviceCommand(deviceId, name, identifier, params) {
  return await prisma.deviceCommand.create({
    data: {
      type: identifier,
      content: params,
      status: 'SENT',
      responseType: null,
      responseContent: null,
      deviceId
    }
  });
}

async function createDeviceEvent(deviceId, identifier, name, type, params) {
  return await prisma.deviceEvent.create({
    data: {
      identifier,
      name,
      type,
      params,
      deviceId
    }
  });
}

async function createDeviceAlarm(deviceId, level, content, confirmedBy = null) {
  return await prisma.deviceAlarm.create({
    data: {
      level,
      content,
      isConfirmed: confirmedBy !== null,
      confirmedAt: confirmedBy !== null ? new Date() : null,
      confirmedBy,
      deviceId
    }
  });
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