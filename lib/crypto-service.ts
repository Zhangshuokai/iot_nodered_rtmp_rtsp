/**
 * 加密服务 - 提供数据加密、解密、哈希和签名功能
 * 
 * 该服务实现了以下功能：
 * 1. 对称加密（AES）
 * 2. 非对称加密（RSA）
 * 3. 哈希函数（SHA-256、SHA-512、MD5）
 * 4. 数字签名
 * 5. 安全密钥管理
 */

import crypto from 'crypto';

/**
 * 加密算法类型
 */
export enum EncryptionAlgorithm {
  AES_256_CBC = 'aes-256-cbc',
  AES_256_GCM = 'aes-256-gcm',
  AES_128_CBC = 'aes-128-cbc',
  AES_128_GCM = 'aes-128-gcm'
}

/**
 * 哈希算法类型
 */
export enum HashAlgorithm {
  SHA256 = 'sha256',
  SHA512 = 'sha512',
  MD5 = 'md5'
}

/**
 * 加密服务类
 */
export class CryptoService {
  private static instance: CryptoService;

  /**
   * 获取单例实例
   */
  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * 生成随机密钥
   * @param size 密钥大小（字节）
   * @returns 随机密钥
   */
  public generateKey(size: number = 32): Buffer {
    return crypto.randomBytes(size);
  }

  /**
   * 生成随机初始化向量
   * @param size 初始化向量大小（字节）
   * @returns 随机初始化向量
   */
  public generateIV(size: number = 16): Buffer {
    return crypto.randomBytes(size);
  }

  /**
   * 使用对称加密算法加密数据
   * @param data 待加密数据
   * @param key 加密密钥
   * @param iv 初始化向量
   * @param algorithm 加密算法
   * @returns 加密后的数据
   */
  public encrypt(
    data: string | Buffer,
    key: string | Buffer,
    iv: string | Buffer,
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_CBC
  ): { encrypted: Buffer, authTag?: Buffer } {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key) : key;
    const ivBuffer = typeof iv === 'string' ? Buffer.from(iv) : iv;
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, ivBuffer);
    
    let encrypted = cipher.update(dataBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // 如果使用GCM模式，返回认证标签
    let authTag: Buffer | undefined;
    if (algorithm.includes('gcm')) {
      authTag = (cipher as crypto.CipherGCM).getAuthTag();
    }
    
    return { encrypted, authTag };
  }

  /**
   * 使用对称加密算法解密数据
   * @param encryptedData 加密数据
   * @param key 解密密钥
   * @param iv 初始化向量
   * @param algorithm 加密算法
   * @param authTag GCM模式的认证标签（可选）
   * @returns 解密后的数据
   */
  public decrypt(
    encryptedData: Buffer,
    key: string | Buffer,
    iv: string | Buffer,
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_CBC,
    authTag?: Buffer
  ): Buffer {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key) : key;
    const ivBuffer = typeof iv === 'string' ? Buffer.from(iv) : iv;
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    
    // 如果使用GCM模式，设置认证标签
    if (algorithm.includes('gcm') && authTag) {
      (decipher as crypto.DecipherGCM).setAuthTag(authTag);
    }
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  /**
   * 计算数据的哈希值
   * @param data 待哈希数据
   * @param algorithm 哈希算法
   * @returns 哈希值
   */
  public hash(
    data: string | Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): string {
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    const hash = crypto.createHash(algorithm);
    hash.update(dataBuffer);
    return hash.digest('hex');
  }

  /**
   * 生成HMAC签名
   * @param data 待签名数据
   * @param key 签名密钥
   * @param algorithm 哈希算法
   * @returns HMAC签名
   */
  public hmac(
    data: string | Buffer,
    key: string | Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): string {
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    const keyBuffer = typeof key === 'string' ? Buffer.from(key) : key;
    
    const hmac = crypto.createHmac(algorithm, keyBuffer);
    hmac.update(dataBuffer);
    return hmac.digest('hex');
  }

  /**
   * 生成RSA密钥对
   * @param modulusLength 模数长度（位）
   * @returns RSA密钥对
   */
  public generateRSAKeyPair(modulusLength: number = 2048): { publicKey: string, privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return { publicKey, privateKey };
  }

  /**
   * 使用RSA公钥加密数据
   * @param data 待加密数据
   * @param publicKey 公钥
   * @returns 加密后的数据
   */
  public rsaEncrypt(data: string | Buffer, publicKey: string): Buffer {
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
      },
      dataBuffer
    );
  }

  /**
   * 使用RSA私钥解密数据
   * @param encryptedData 加密数据
   * @param privateKey 私钥
   * @returns 解密后的数据
   */
  public rsaDecrypt(encryptedData: Buffer, privateKey: string): Buffer {
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
      },
      encryptedData
    );
  }

  /**
   * 使用RSA私钥签名数据
   * @param data 待签名数据
   * @param privateKey 私钥
   * @returns 数字签名
   */
  public sign(data: string | Buffer, privateKey: string): Buffer {
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    const sign = crypto.createSign('SHA256');
    sign.update(dataBuffer);
    return sign.sign(privateKey);
  }

  /**
   * 使用RSA公钥验证签名
   * @param data 原始数据
   * @param signature 数字签名
   * @param publicKey 公钥
   * @returns 签名是否有效
   */
  public verify(data: string | Buffer, signature: Buffer, publicKey: string): boolean {
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    const verify = crypto.createVerify('SHA256');
    verify.update(dataBuffer);
    return verify.verify(publicKey, signature);
  }

  /**
   * 生成安全随机字符串
   * @param length 字符串长度
   * @returns 随机字符串
   */
  public generateRandomString(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * 使用PBKDF2派生密钥
   * @param password 密码
   * @param salt 盐值
   * @param iterations 迭代次数
   * @param keylen 密钥长度
   * @param digest 摘要算法
   * @returns 派生密钥
   */
  public deriveKey(
    password: string,
    salt: string | Buffer,
    iterations: number = 10000,
    keylen: number = 32,
    digest: string = 'sha256'
  ): Buffer {
    const saltBuffer = typeof salt === 'string' ? Buffer.from(salt) : salt;
    return crypto.pbkdf2Sync(password, saltBuffer, iterations, keylen, digest);
  }
}

// 导出单例实例
export const cryptoService = CryptoService.getInstance();

export default cryptoService; 