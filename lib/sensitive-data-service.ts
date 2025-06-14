/**
 * 敏感数据保护服务 - 处理敏感数据的加密和脱敏
 * 
 * 该服务实现了以下功能：
 * 1. 敏感数据字段级加密
 * 2. 数据脱敏（如手机号、身份证、邮箱等）
 * 3. 敏感数据访问控制
 * 4. 数据泄露防护
 */

import { cryptoService, EncryptionAlgorithm } from './crypto-service';
import prisma from './db-prisma';
import { RolePermission } from '@prisma/client';

/**
 * 敏感数据类型
 */
export enum SensitiveDataType {
  PHONE = 'phone',
  EMAIL = 'email',
  ID_CARD = 'idCard',
  BANK_CARD = 'bankCard',
  PASSWORD = 'password',
  ADDRESS = 'address',
  NAME = 'name',
  CUSTOM = 'custom'
}

/**
 * 敏感数据脱敏选项
 */
export interface MaskingOptions {
  type: SensitiveDataType;
  showPrefix?: number;
  showSuffix?: number;
  maskChar?: string;
  customPattern?: RegExp;
  customReplacement?: string;
}

/**
 * 敏感数据加密选项
 */
export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  keyId?: string;
}

/**
 * 角色权限关联类型（包含权限信息）
 */
interface RolePermissionWithPermission extends RolePermission {
  permission: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
  }
}

/**
 * 敏感数据保护服务类
 */
export class SensitiveDataService {
  private static instance: SensitiveDataService;
  private encryptionKey: Buffer;
  private encryptionIV: Buffer;

  private constructor() {
    // 从环境变量或安全存储中获取加密密钥和IV
    // 在实际生产环境中，应该使用更安全的密钥管理系统
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-for-sensitive-data';
    const iv = process.env.ENCRYPTION_IV || 'default-iv-16byte';
    
    this.encryptionKey = Buffer.from(key);
    this.encryptionIV = Buffer.from(iv);
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SensitiveDataService {
    if (!SensitiveDataService.instance) {
      SensitiveDataService.instance = new SensitiveDataService();
    }
    return SensitiveDataService.instance;
  }

  /**
   * 加密敏感数据
   * @param data 敏感数据
   * @param options 加密选项
   * @returns 加密后的数据
   */
  public encryptSensitiveData(data: string, options?: EncryptionOptions): string {
    if (!data) return data;

    const algorithm = options?.algorithm || EncryptionAlgorithm.AES_256_CBC;
    
    try {
      const { encrypted } = cryptoService.encrypt(data, this.encryptionKey, this.encryptionIV, algorithm);
      return encrypted.toString('base64');
    } catch (error) {
      console.error('Failed to encrypt sensitive data:', error);
      return data; // 在加密失败的情况下返回原始数据
    }
  }

  /**
   * 解密敏感数据
   * @param encryptedData 加密数据
   * @param options 加密选项
   * @returns 解密后的数据
   */
  public decryptSensitiveData(encryptedData: string, options?: EncryptionOptions): string {
    if (!encryptedData) return encryptedData;

    const algorithm = options?.algorithm || EncryptionAlgorithm.AES_256_CBC;
    
    try {
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const decrypted = cryptoService.decrypt(encryptedBuffer, this.encryptionKey, this.encryptionIV, algorithm);
      return decrypted.toString();
    } catch (error) {
      console.error('Failed to decrypt sensitive data:', error);
      return encryptedData; // 在解密失败的情况下返回加密数据
    }
  }

  /**
   * 脱敏敏感数据
   * @param data 敏感数据
   * @param options 脱敏选项
   * @returns 脱敏后的数据
   */
  public maskSensitiveData(data: string, options: MaskingOptions): string {
    if (!data) return data;

    const { type, showPrefix = 0, showSuffix = 0, maskChar = '*' } = options;
    
    // 根据不同类型的敏感数据使用不同的脱敏规则
    switch (type) {
      case SensitiveDataType.PHONE:
        return this.maskPhone(data, showPrefix, showSuffix, maskChar);
      
      case SensitiveDataType.EMAIL:
        return this.maskEmail(data, maskChar);
      
      case SensitiveDataType.ID_CARD:
        return this.maskIdCard(data, showPrefix, showSuffix, maskChar);
      
      case SensitiveDataType.BANK_CARD:
        return this.maskBankCard(data, showPrefix, showSuffix, maskChar);
      
      case SensitiveDataType.PASSWORD:
        return maskChar.repeat(data.length);
      
      case SensitiveDataType.ADDRESS:
        return this.maskAddress(data, showPrefix, maskChar);
      
      case SensitiveDataType.NAME:
        return this.maskName(data, maskChar);
      
      case SensitiveDataType.CUSTOM:
        if (options.customPattern && options.customReplacement) {
          return data.replace(options.customPattern, options.customReplacement);
        }
        return this.maskGeneric(data, showPrefix, showSuffix, maskChar);
      
      default:
        return this.maskGeneric(data, showPrefix, showSuffix, maskChar);
    }
  }

  /**
   * 检查用户是否有权访问敏感数据
   * @param userId 用户ID
   * @param dataType 敏感数据类型
   * @param resourceId 资源ID
   * @returns 是否有权访问
   */
  public async canAccessSensitiveData(userId: string, dataType: SensitiveDataType, resourceId?: string): Promise<boolean> {
    // 实际实现中，应该根据用户角色和权限检查是否可以访问敏感数据
    // 这里简单实现，实际应用中应该与权限系统集成
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      if (!user) return false;

      // 系统管理员可以访问所有敏感数据
      if (user.role.name === 'SYSTEM_ADMIN') return true;

      // 检查是否有特定的敏感数据访问权限
      const hasPermission = user.role.rolePermissions.some((rp: RolePermissionWithPermission) => 
        rp.permission.code === `sensitive:${dataType}:read` ||
        rp.permission.code === 'sensitive:all:read'
      );

      return hasPermission;
    } catch (error) {
      console.error('Failed to check sensitive data access:', error);
      return false;
    }
  }

  /**
   * 记录敏感数据访问日志
   * @param userId 用户ID
   * @param dataType 敏感数据类型
   * @param resourceId 资源ID
   * @param action 操作类型
   */
  public async logSensitiveDataAccess(
    userId: string,
    dataType: SensitiveDataType,
    resourceId: string,
    action: 'read' | 'write' | 'export'
  ): Promise<void> {
    try {
      // 记录敏感数据访问日志
      // 实际应用中应该将日志写入数据库或安全审计系统
      console.log(`Sensitive data access: User ${userId} ${action} ${dataType} data for resource ${resourceId}`);
      
      // 如果有审计日志表，可以写入数据库
      // await prisma.auditLog.create({
      //   data: {
      //     userId,
      //     action,
      //     resourceType: 'sensitive_data',
      //     resourceId,
      //     details: { dataType }
      //   }
      // });
    } catch (error) {
      console.error('Failed to log sensitive data access:', error);
    }
  }

  /**
   * 脱敏手机号
   * @param phone 手机号
   * @param showPrefix 显示前几位
   * @param showSuffix 显示后几位
   * @param maskChar 掩码字符
   * @returns 脱敏后的手机号
   */
  private maskPhone(phone: string, showPrefix: number = 3, showSuffix: number = 4, maskChar: string = '*'): string {
    if (phone.length <= showPrefix + showSuffix) {
      return phone;
    }
    
    const maskLength = phone.length - showPrefix - showSuffix;
    return `${phone.substring(0, showPrefix)}${maskChar.repeat(maskLength)}${phone.substring(phone.length - showSuffix)}`;
  }

  /**
   * 脱敏邮箱
   * @param email 邮箱
   * @param maskChar 掩码字符
   * @returns 脱敏后的邮箱
   */
  private maskEmail(email: string, maskChar: string = '*'): string {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    
    const [username, domain] = parts;
    let maskedUsername = username;
    
    if (username.length > 2) {
      maskedUsername = `${username.substring(0, 1)}${maskChar.repeat(username.length - 2)}${username.substring(username.length - 1)}`;
    }
    
    return `${maskedUsername}@${domain}`;
  }

  /**
   * 脱敏身份证号
   * @param idCard 身份证号
   * @param showPrefix 显示前几位
   * @param showSuffix 显示后几位
   * @param maskChar 掩码字符
   * @returns 脱敏后的身份证号
   */
  private maskIdCard(idCard: string, showPrefix: number = 6, showSuffix: number = 4, maskChar: string = '*'): string {
    if (idCard.length <= showPrefix + showSuffix) {
      return idCard;
    }
    
    const maskLength = idCard.length - showPrefix - showSuffix;
    return `${idCard.substring(0, showPrefix)}${maskChar.repeat(maskLength)}${idCard.substring(idCard.length - showSuffix)}`;
  }

  /**
   * 脱敏银行卡号
   * @param bankCard 银行卡号
   * @param showPrefix 显示前几位
   * @param showSuffix 显示后几位
   * @param maskChar 掩码字符
   * @returns 脱敏后的银行卡号
   */
  private maskBankCard(bankCard: string, showPrefix: number = 4, showSuffix: number = 4, maskChar: string = '*'): string {
    if (bankCard.length <= showPrefix + showSuffix) {
      return bankCard;
    }
    
    const maskLength = bankCard.length - showPrefix - showSuffix;
    return `${bankCard.substring(0, showPrefix)}${maskChar.repeat(maskLength)}${bankCard.substring(bankCard.length - showSuffix)}`;
  }

  /**
   * 脱敏地址
   * @param address 地址
   * @param showPrefix 显示前几个字符
   * @param maskChar 掩码字符
   * @returns 脱敏后的地址
   */
  private maskAddress(address: string, showPrefix: number = 6, maskChar: string = '*'): string {
    if (address.length <= showPrefix) {
      return address;
    }
    
    return `${address.substring(0, showPrefix)}${maskChar.repeat(Math.min(10, address.length - showPrefix))}`;
  }

  /**
   * 脱敏姓名
   * @param name 姓名
   * @param maskChar 掩码字符
   * @returns 脱敏后的姓名
   */
  private maskName(name: string, maskChar: string = '*'): string {
    if (!name || name.length <= 1) {
      return name;
    }
    
    // 中文姓名：保留姓，其他用*代替
    // 英文姓名：保留首字母，其他用*代替
    const isChinese = /[\u4e00-\u9fa5]/.test(name);
    
    if (isChinese) {
      return `${name.substring(0, 1)}${maskChar.repeat(name.length - 1)}`;
    } else {
      // 假设是英文名，按空格分割
      const parts = name.split(' ');
      return parts.map(part => {
        if (part.length <= 1) return part;
        return `${part.substring(0, 1)}${maskChar.repeat(part.length - 1)}`;
      }).join(' ');
    }
  }

  /**
   * 通用脱敏方法
   * @param data 数据
   * @param showPrefix 显示前几位
   * @param showSuffix 显示后几位
   * @param maskChar 掩码字符
   * @returns 脱敏后的数据
   */
  private maskGeneric(data: string, showPrefix: number = 1, showSuffix: number = 1, maskChar: string = '*'): string {
    if (data.length <= showPrefix + showSuffix) {
      return data;
    }
    
    const maskLength = data.length - showPrefix - showSuffix;
    return `${data.substring(0, showPrefix)}${maskChar.repeat(maskLength)}${data.substring(data.length - showSuffix)}`;
  }
}

// 导出单例实例
export const sensitiveDataService = SensitiveDataService.getInstance();

export default sensitiveDataService; 