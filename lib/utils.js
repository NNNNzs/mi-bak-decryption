/**
 * 小米备份文件解密工具 - 工具函数
 */

const fs = require('fs');
const crypto = require('crypto');
const cliProgress = require('cli-progress');
const constants = require('./constants');

/**
 * 获取文件大小
 * 
 * @param {string} filePath - 文件路径
 * @returns {Promise<number>} 文件大小（字节）
 */
function getFileSize(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats.size);
      }
    });
  });
}

/**
 * 创建进度条
 * 
 * @param {string} title - 进度条标题
 * @param {number} total - 总大小
 * @returns {cliProgress.SingleBar} 进度条对象
 */
function createProgressBar(title, total) {
  return new cliProgress.SingleBar({
    format: `${title} [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} 字节`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);
}

/**
 * 从流中读取一行（以换行符结束）
 * 
 * @param {fs.ReadStream} stream - 读取流
 * @returns {Promise<string>} 读取的行内容
 */
function readHeaderLine(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    
    function onReadable() {
      let chunk;
      while (null !== (chunk = stream.read(1))) {
        const char = chunk.toString();
        if (char === '\n') {
          cleanup();
          resolve(data);
          return;
        }
        data += char;
      }
    }
    
    function onEnd() {
      cleanup();
      if (data.length > 0) {
        resolve(data);
      } else {
        reject(new Error('流结束，未找到换行符'));
      }
    }
    
    function onError(err) {
      cleanup();
      reject(err);
    }
    
    function cleanup() {
      stream.removeListener('readable', onReadable);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    }
    
    stream.on('readable', onReadable);
    stream.on('end', onEnd);
    stream.on('error', onError);
    
    // 触发首次读取
    onReadable();
  });
}

/**
 * 将十六进制字符串转换为Buffer
 * 
 * @param {string} hex - 十六进制字符串
 * @returns {Buffer} 转换后的Buffer
 */
function hexToBuffer(hex) {
  return Buffer.from(hex, 'hex');
}

/**
 * 构建密码密钥
 * 
 * @param {string} password - 用户密码
 * @param {Buffer} salt - 盐值
 * @param {number} rounds - 迭代次数
 * @param {boolean} useUtf8 - 是否使用UTF-8编码
 * @returns {Buffer} 生成的密钥
 */
function buildPasswordKey(password, salt, rounds, useUtf8 = true) {
  const encoding = useUtf8 ? 'utf8' : 'binary';
  const pwBytes = Buffer.from(password, encoding);
  
  return crypto.pbkdf2Sync(
    pwBytes,
    salt,
    rounds,
    constants.PBKDF2_KEY_SIZE,
    constants.PBKDF2_HASH_ALGORITHM
  );
}

/**
 * 生成密钥校验和
 * 
 * @param {Buffer} key - 密钥
 * @param {Buffer} salt - 盐值
 * @param {number} rounds - 迭代次数
 * @param {boolean} useUtf8 - 是否使用UTF-8编码
 * @returns {Buffer} 校验和
 */
function makeKeyChecksum(key, salt, rounds, useUtf8 = true) {
  const encoding = useUtf8 ? 'utf8' : 'binary';
  const keyBytes = Buffer.from(key);
  
  return crypto.pbkdf2Sync(
    keyBytes,
    salt,
    rounds,
    constants.PBKDF2_KEY_SIZE,
    constants.PBKDF2_HASH_ALGORITHM
  );
}

/**
 * 确保目录存在
 * 
 * @param {string} dirPath - 目录路径
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  getFileSize,
  createProgressBar,
  readHeaderLine,
  hexToBuffer,
  buildPasswordKey,
  makeKeyChecksum,
  ensureDirectoryExists
}; 