/**
 * 小米备份文件解密工具 - 解压功能
 * 基于 android-backup-extractor 项目实现
 * @see https://github.com/nelenkov/android-backup-extractor
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const tar = require('tar-stream');
const mkdirp = require('mkdirp');
const crypto = require('crypto');
const constants = require('./constants');
const { 
  getFileSize, 
  createProgressBar, 
  readHeaderLine, 
  hexToBuffer, 
  buildPasswordKey, 
  makeKeyChecksum,
  ensureDirectoryExists
} = require('./utils');

/**
 * 解压安卓备份文件
 * 
 * @param {string} backupFilePath - 备份文件路径
 * @param {string} outputDir - 输出目录
 * @param {string} password - 备份文件密码（如果有）
 * @param {boolean} keepTar - 是否保留临时TAR文件
 * @returns {Promise<void>}
 */
async function extractAndroidBackup(backupFilePath, outputDir, password = null, keepTar = false) {
  // 确保输出目录存在
  ensureDirectoryExists(outputDir);
  
  console.log('开始解压安卓备份文件...');
  
  // 创建临时TAR文件路径
  const tempTarPath = path.join(
    path.dirname(backupFilePath),
    `${path.basename(backupFilePath, path.extname(backupFilePath))}.tar`
  );
  
  try {
    // 先解包为TAR文件
    await unpackBackup(backupFilePath, tempTarPath, password);
    
    // 然后解压TAR文件
    console.log('正在提取TAR文件内容...');
    await extractTarWithProgress(tempTarPath, outputDir);
    
    // 解压成功后删除临时文件（除非指定保留）
    if (!keepTar) {
      fs.unlinkSync(tempTarPath);
    } else {
      console.log(`临时TAR文件已保留: ${tempTarPath}`);
    }
    
    console.log(`文件已成功提取到: ${outputDir}`);
  } catch (error) {
    throw new Error(`解压安卓备份文件失败: ${error.message}`);
  }
}

/**
 * 直接解压备份文件到TAR文件（不解压TAR）
 * 
 * @param {string} backupFilePath - 备份文件路径
 * @param {string} tarFilePath - 输出TAR文件路径
 * @param {string} password - 备份文件密码（如果有）
 * @returns {Promise<void>}
 */
async function unpackBackup(backupFilePath, tarFilePath, password = null) {
  console.log('开始解压备份文件到TAR...');
  
  try {
    // 打开备份文件
    const fileStream = fs.createReadStream(backupFilePath);
    
    // 读取文件头
    const magic = await readHeaderLine(fileStream);
    if (magic !== constants.BACKUP_FILE_HEADER_MAGIC.trim()) {
      throw new Error(`无效的备份文件头: ${magic}`);
    }
    
    const versionStr = await readHeaderLine(fileStream);
    const version = parseInt(versionStr, 10);
    if (version < constants.BACKUP_FILE_V1 || version > constants.BACKUP_FILE_V5) {
      throw new Error(`不支持的备份文件版本: ${version}`);
    }
    
    const compressedStr = await readHeaderLine(fileStream);
    const isCompressed = parseInt(compressedStr, 10) === 1;
    
    const encryptionAlg = await readHeaderLine(fileStream);
    const isEncrypted = encryptionAlg === constants.ENCRYPTION_ALGORITHM_NAME;
    
    console.log(`备份文件信息:`);
    console.log(`- 版本: ${version}`);
    console.log(`- 压缩: ${isCompressed ? '是' : '否'}`);
    console.log(`- 加密: ${isEncrypted ? '是' : '否'}`);
    
    let dataStream = fileStream;
    
    // 如果加密，解密数据
    if (isEncrypted) {
      if (!password) {
        throw new Error('备份文件已加密，但未提供密码');
      }
      
      console.log('正在解密备份文件...');
      
      const userSaltHex = await readHeaderLine(fileStream);
      const userSalt = hexToBuffer(userSaltHex);
      
      const ckSaltHex = await readHeaderLine(fileStream);
      const ckSalt = hexToBuffer(ckSaltHex);
      
      const rounds = parseInt(await readHeaderLine(fileStream), 10);
      
      const userIvHex = await readHeaderLine(fileStream);
      const userIv = hexToBuffer(userIvHex);
      
      const masterKeyBlobHex = await readHeaderLine(fileStream);
      const masterKeyBlob = hexToBuffer(masterKeyBlobHex);
      
      // 生成用户密钥
      const useUtf8 = version >= constants.BACKUP_FILE_V2;
      const userKey = buildPasswordKey(password, userSalt, rounds, useUtf8);
      
      // 解密主密钥
      const decipher = crypto.createDecipheriv(constants.ENCRYPTION_MECHANISM, userKey, userIv);
      let mkBlob;
      try {
        mkBlob = Buffer.concat([
          decipher.update(masterKeyBlob),
          decipher.final()
        ]);
      } catch (e) {
        throw new Error('密码错误或主密钥解密失败');
      }
      
      // 解析主密钥数据
      let offset = 0;
      const ivLen = mkBlob[offset++];
      const iv = mkBlob.slice(offset, offset + ivLen);
      offset += ivLen;
      
      const mkLen = mkBlob[offset++];
      const mk = mkBlob.slice(offset, offset + mkLen);
      offset += mkLen;
      
      const checksumLen = mkBlob[offset++];
      const mkChecksum = mkBlob.slice(offset, offset + checksumLen);
      
      // 验证主密钥校验和
      const calculatedCk = makeKeyChecksum(mk, ckSalt, rounds, useUtf8);
      
      if (!calculatedCk.equals(mkChecksum)) {
        // 尝试反向验证
        const altCalculatedCk = makeKeyChecksum(mk, ckSalt, rounds, !useUtf8);
        if (!altCalculatedCk.equals(mkChecksum)) {
          throw new Error('主密钥校验失败，密码可能不正确');
        }
      }
      
      // 创建解密流
      const decipherStream = crypto.createDecipheriv(constants.ENCRYPTION_MECHANISM, mk, iv);
      dataStream = dataStream.pipe(decipherStream);
    }
    
    // 如果压缩，解压数据
    if (isCompressed) {
      console.log('正在解压缩数据...');
      dataStream = dataStream.pipe(zlib.createGunzip());
    }
    
    // 创建进度条
    const fileSize = await getFileSize(backupFilePath);
    const progressBar = createProgressBar('解包进度', fileSize);
    
    progressBar.start(fileSize, 0);
    let processedBytes = 0;
    
    // 写入TAR文件
    const tarFile = fs.createWriteStream(tarFilePath);
    
    dataStream.on('data', (chunk) => {
      processedBytes += chunk.length;
      progressBar.update(Math.min(processedBytes, fileSize));
    });
    
    await new Promise((resolve, reject) => {
      dataStream.pipe(tarFile);
      
      tarFile.on('finish', resolve);
      tarFile.on('error', reject);
      dataStream.on('error', (err) => {
        progressBar.stop();
        reject(new Error(`解压数据错误: ${err.message}`));
      });
    });
    
    progressBar.stop();
    console.log(`备份文件已成功解压为TAR格式: ${tarFilePath}`);
    
  } catch (error) {
    throw new Error(`解压备份文件失败: ${error.message}`);
  }
}

/**
 * 使用进度条解压TAR文件
 * 
 * @param {string} tarFilePath - TAR文件路径
 * @param {string} outputDir - 输出目录
 * @returns {Promise<void>}
 */
async function extractTarWithProgress(tarFilePath, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      // 获取TAR文件大小用于进度条
      const tarSize = fs.statSync(tarFilePath).size;
      const progressBar = createProgressBar('解压进度', tarSize);
      progressBar.start(tarSize, 0);
      
      let processedBytes = 0;
      const extract = tar.extract();
      
      // 处理每个文件条目
      extract.on('entry', (header, stream, next) => {
        // 处理文件路径中的特殊字符
        const normalizedName = header.name.replace(/[\/:*?"<>|]/g, '_');
        const filePath = path.join(outputDir, normalizedName);
        
        // 根据条目类型处理
        if (header.type === 'directory') {
          // 创建目录
          ensureDirectoryExists(filePath);
          stream.resume();
          next();
        } else if (header.type === 'file') {
          // 确保父目录存在
          ensureDirectoryExists(path.dirname(filePath));
          
          try {
            // 创建写入流
            const writeStream = fs.createWriteStream(filePath);
            
            // 处理错误
            stream.on('error', (err) => {
              console.error(`解压文件错误: ${err.message}, 文件: ${filePath}`);
              stream.resume(); // 继续处理下一个文件
              next();
            });
            
            writeStream.on('error', (err) => {
              console.error(`写入文件错误: ${err.message}, 文件: ${filePath}`);
              stream.resume(); // 继续处理下一个文件
              next();
            });
            
            // 完成写入
            writeStream.on('finish', () => {
              // 设置文件权限
              if (header.mode) {
                try {
                  fs.chmodSync(filePath, header.mode);
                } catch (e) {
                  // 忽略权限设置错误
                }
              }
              next();
            });
            
            // 写入文件
            stream.pipe(writeStream);
          } catch (err) {
            console.error(`创建文件错误: ${err.message}, 文件: ${filePath}`);
            stream.resume(); // 继续处理下一个文件
            next();
          }
        } else {
          // 跳过其他类型
          stream.resume();
          next();
        }
      });
      
      // 更新进度条
      extract.on('data', (chunk) => {
        processedBytes += chunk.length;
        progressBar.update(Math.min(processedBytes, tarSize));
      });
      
      // 处理完成
      extract.on('finish', () => {
        progressBar.stop();
        resolve();
      });
      
      // 处理错误
      extract.on('error', (err) => {
        progressBar.stop();
        console.error(`解压TAR文件错误: ${err.message}`);
        // 不中断整个解压过程，尝试继续
        resolve();
      });
      
      // 开始解压
      fs.createReadStream(tarFilePath)
        .on('data', (chunk) => {
          processedBytes += chunk.length;
          progressBar.update(Math.min(processedBytes, tarSize));
        })
        .on('error', (err) => {
          progressBar.stop();
          reject(new Error(`读取TAR文件错误: ${err.message}`));
        })
        .pipe(extract);
        
    } catch (error) {
      reject(new Error(`解压TAR文件失败: ${error.message}`));
    }
  });
}

module.exports = {
  extractAndroidBackup,
  unpackBackup,
  extractTarWithProgress
}; 