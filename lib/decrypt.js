/**
 * 小米备份文件解密工具 - 解密功能
 * 
 * @author NNNNzs
 */

const fs = require('fs');
const { Transform } = require('stream');
const { getFileSize, createProgressBar } = require('./utils');

/**
 * 创建一个转换流，用于查找并移除文件开头的加密数据
 * 
 * @param {Function} onProgress - 进度回调函数
 * @param {number} totalSize - 文件总大小
 * @returns {Transform} 转换流对象
 */
function createDecryptTransform(onProgress, totalSize) {
  let foundMarker = false;
  let buffer = Buffer.alloc(0);
  const markerBytes = Buffer.from([0x41, 0x4E]); // "41 4E" 对应 ASCII 中的 "AN"
  let processedBytes = 0;
  
  return new Transform({
    transform(chunk, encoding, callback) {
      processedBytes += chunk.length;
      
      // 更新进度
      if (onProgress && totalSize) {
        onProgress(processedBytes, totalSize);
      }
      
      if (foundMarker) {
        // 如果已经找到标记，直接传递数据
        this.push(chunk);
        callback();
        return;
      }
      
      // 将新的数据块与之前的缓冲区合并
      buffer = Buffer.concat([buffer, chunk]);
      
      // 在合并后的缓冲区中查找标记
      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i] === markerBytes[0] && buffer[i + 1] === markerBytes[1]) {
          // 找到标记，推送从标记开始的所有数据
          foundMarker = true;
          this.push(buffer.slice(i));
          buffer = null; // 释放内存
          callback();
          return;
        }
      }
      
      // 如果没有找到标记，保留最后一个字节（可能是标记的一部分）
      if (buffer.length > 1) {
        buffer = buffer.slice(buffer.length - 1);
      }
      
      callback();
    },
    flush(callback) {
      // 如果到达文件末尾仍未找到标记，输出警告
      if (!foundMarker && buffer.length > 0) {
        console.warn('警告: 未找到 "41 4E" 标记，输出可能不正确');
        this.push(buffer);
      }
      callback();
    }
  });
}

/**
 * 使用流式处理解密小米备份文件
 * 
 * @param {string} inputFilePath - 输入文件路径
 * @param {string} outputFilePath - 输出文件路径
 * @returns {Promise<void>}
 */
async function decryptBakFile(inputFilePath, outputFilePath) {
  // 获取文件大小用于进度计算
  const fileSize = await getFileSize(inputFilePath);
  
  // 创建进度条
  const progressBar = createProgressBar('解密进度', fileSize);
  progressBar.start(fileSize, 0);
  
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(inputFilePath);
    const writeStream = fs.createWriteStream(outputFilePath);
    const decryptTransform = createDecryptTransform((processed, total) => {
      progressBar.update(processed);
    }, fileSize);
    
    // 处理错误
    readStream.on('error', (err) => {
      progressBar.stop();
      reject(new Error(`读取文件错误: ${err.message}`));
    });
    
    writeStream.on('error', (err) => {
      progressBar.stop();
      reject(new Error(`写入文件错误: ${err.message}`));
    });
    
    decryptTransform.on('error', (err) => {
      progressBar.stop();
      reject(new Error(`处理数据错误: ${err.message}`));
    });
    
    // 完成处理
    writeStream.on('finish', () => {
      progressBar.stop();
      console.log(`解密成功！解密后的文件已保存为: ${outputFilePath}`);
      resolve();
    });
    
    // 连接流
    readStream
      .pipe(decryptTransform)
      .pipe(writeStream);
  });
}

module.exports = {
  decryptBakFile
}; 