/**
 * 小米备份文件解密工具 - 主入口
 * 
 * @author NNNNzs
 * @version 2.2.0
 */

const { decryptBakFile } = require('./lib/decrypt');
const { extractAndroidBackup, unpackBackup, extractTarWithProgress } = require('./lib/extract');

/**
 * 一键解密并解压小米备份文件
 * 
 * @param {string} inputFilePath - 输入文件路径
 * @param {string} outputDir - 输出目录
 * @param {Object} options - 选项
 * @param {string} [options.password] - 备份文件密码（如果有）
 * @param {boolean} [options.keepTemp=false] - 是否保留临时文件
 * @returns {Promise<void>}
 */
async function processBackupFile(inputFilePath, outputDir, options = {}) {
  const fs = require('fs');
  const path = require('path');
  
  // 创建临时解密文件路径
  const parsedPath = path.parse(inputFilePath);
  const decryptedFilePath = path.join(
    parsedPath.dir,
    `${parsedPath.name}_decrypted${parsedPath.ext}`
  );
  
  // 步骤1: 解密
  await decryptBakFile(inputFilePath, decryptedFilePath);
  
  // 步骤2: 解压
  await extractAndroidBackup(decryptedFilePath, outputDir, options.password, options.keepTemp);
  
  // 清理临时文件（除非指定保留）
  if (!options.keepTemp && fs.existsSync(decryptedFilePath)) {
    fs.unlinkSync(decryptedFilePath);
  }
}

module.exports = {
  decryptBakFile,
  extractAndroidBackup,
  unpackBackup,
  extractTarWithProgress,
  processBackupFile
};
