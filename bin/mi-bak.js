#!/usr/bin/env node

/**
 * 小米备份文件解密工具 - 命令行入口
 * 
 * @author NNNNzs
 * @version 2.2.0
 */

const { program } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const { decryptBakFile } = require('../lib/decrypt');
const { extractAndroidBackup } = require('../lib/extract');
const path = require('path');
const fs = require('fs');
const packageJson = require('../package.json');

// 显示工具标题
console.log(
  chalk.cyan(
    figlet.textSync('MI-BAK', { horizontalLayout: 'full' })
  )
);
console.log(chalk.cyan(`小米备份文件解密工具 v${packageJson.version}\n`));

// 配置命令行程序
program
  .name('mi-bak')
  .description('小米备份文件解密和解压工具')
  .version(packageJson.version);

// 解密命令
program
  .command('decrypt')
  .description('解密小米备份文件，移除文件开头的加密数据')
  .argument('<input>', '输入文件路径')
  .argument('[output]', '输出文件路径 (可选)')
  .option('-f, --force', '如果输出文件已存在，强制覆盖')
  .action(async (input, output, options) => {
    try {
      // 检查输入文件是否存在
      if (!fs.existsSync(input)) {
        console.error(chalk.red(`错误: 输入文件 "${input}" 不存在`));
        process.exit(1);
      }
      
      // 如果未提供输出文件路径，则自动生成
      if (!output) {
        const parsedPath = path.parse(input);
        output = path.join(
          parsedPath.dir,
          `${parsedPath.name}_decrypted${parsedPath.ext}`
        );
      }
      
      // 检查输出文件是否已存在
      if (fs.existsSync(output) && !options.force) {
        console.error(chalk.yellow(`警告: 输出文件 "${output}" 已存在。使用 --force 选项覆盖。`));
        process.exit(1);
      }
      
      console.log(chalk.blue(`开始解密: ${input} -> ${output}`));
      
      // 执行解密
      await decryptBakFile(input, output);
      
      console.log(chalk.green('✓ 解密处理完成'));
    } catch (err) {
      console.error(chalk.red(`解密失败: ${err.message}`));
      process.exit(1);
    }
  });

// 解压命令
program
  .command('extract')
  .description('解压安卓备份文件')
  .argument('<input>', '备份文件路径')
  .argument('[output]', '输出目录 (可选)')
  .option('-p, --password <password>', '备份文件密码 (如果有)')
  .option('-f, --force', '如果输出目录已存在，强制覆盖')
  .option('-k, --keep-tar', '保留临时TAR文件')
  .action(async (input, output, options) => {
    try {
      // 检查输入文件是否存在
      if (!fs.existsSync(input)) {
        console.error(chalk.red(`错误: 备份文件 "${input}" 不存在`));
        process.exit(1);
      }
      
      // 如果未提供输出目录，则自动生成
      if (!output) {
        const parsedPath = path.parse(input);
        output = path.join(parsedPath.dir, `${parsedPath.name}_extracted`);
      }
      
      // 检查输出目录是否已存在
      if (fs.existsSync(output) && !options.force) {
        console.error(chalk.yellow(`警告: 输出目录 "${output}" 已存在。使用 --force 选项覆盖。`));
        process.exit(1);
      }
      
      console.log(chalk.blue(`开始解压: ${input} -> ${output}`));
      
      // 执行解压
      await extractAndroidBackup(input, output, options.password, options.keepTar);
      
      console.log(chalk.green('✓ 解压处理完成'));
    } catch (err) {
      console.error(chalk.red(`解压失败: ${err.message}`));
      process.exit(1);
    }
  });

// 新增：一键解密并解压命令
program
  .command('process')
  .description('一键解密并解压小米备份文件')
  .argument('<input>', '输入文件路径')
  .argument('[output]', '输出目录 (可选)')
  .option('-p, --password <password>', '备份文件密码 (如果有)')
  .option('-f, --force', '如果输出文件/目录已存在，强制覆盖')
  .option('-k, --keep-temp', '保留临时文件（解密后的文件和TAR文件）')
  .action(async (input, output, options) => {
    try {
      // 检查输入文件是否存在
      if (!fs.existsSync(input)) {
        console.error(chalk.red(`错误: 输入文件 "${input}" 不存在`));
        process.exit(1);
      }
      
      // 如果未提供输出目录，则自动生成
      if (!output) {
        const parsedPath = path.parse(input);
        output = path.join(parsedPath.dir, `${parsedPath.name}_processed`);
      }
      
      // 检查输出目录是否已存在
      if (fs.existsSync(output) && !options.force) {
        console.error(chalk.yellow(`警告: 输出目录 "${output}" 已存在。使用 --force 选项覆盖。`));
        process.exit(1);
      }
      
      console.log(chalk.blue(`开始处理: ${input}`));
      
      // 创建临时解密文件路径
      const parsedPath = path.parse(input);
      const decryptedFilePath = path.join(
        parsedPath.dir,
        `${parsedPath.name}_decrypted${parsedPath.ext}`
      );
      
      // 检查临时文件是否已存在
      if (fs.existsSync(decryptedFilePath) && !options.force) {
        console.error(chalk.yellow(`警告: 临时文件 "${decryptedFilePath}" 已存在。使用 --force 选项覆盖。`));
        process.exit(1);
      }
      
      // 步骤1: 解密
      console.log(chalk.blue(`步骤1: 解密文件 -> ${decryptedFilePath}`));
      await decryptBakFile(input, decryptedFilePath);
      console.log(chalk.green('✓ 解密完成'));
      
      // 步骤2: 解压
      console.log(chalk.blue(`步骤2: 解压文件 -> ${output}`));
      await extractAndroidBackup(decryptedFilePath, output, options.password, options.keepTemp);
      console.log(chalk.green('✓ 解压完成'));
      
      // 清理临时文件（除非指定保留）
      if (!options.keepTemp && fs.existsSync(decryptedFilePath)) {
        fs.unlinkSync(decryptedFilePath);
        console.log(chalk.gray(`已删除临时文件: ${decryptedFilePath}`));
      }
      
      console.log(chalk.green(`✓ 处理完成！文件已提取到: ${output}`));
    } catch (err) {
      console.error(chalk.red(`处理失败: ${err.message}`));
      process.exit(1);
    }
  });

// 显示帮助信息
program
  .addHelpText('after', `
示例:
  $ mi-bak decrypt backup.bak                    # 解密备份文件
  $ mi-bak decrypt backup.bak output.ab          # 解密并指定输出文件
  $ mi-bak extract backup.ab                     # 解压备份文件
  $ mi-bak extract backup.ab ./extracted_files   # 解压到指定目录
  $ mi-bak extract backup.ab -p mypassword       # 使用密码解压加密备份
  $ mi-bak process backup.bak                    # 一键解密并解压
  $ mi-bak process backup.bak -p mypassword      # 一键解密并解压（带密码）
  $ mi-bak process backup.bak -k                 # 保留临时文件
  `);

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 