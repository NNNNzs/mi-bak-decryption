# 小米备份文件解密工具

这是一个用于处理小米备份文件(.bak)的命令行工具，可以移除文件开头的加密数据并解压安卓备份文件。

## 功能特点

- **解密备份文件**：移除小米备份文件开头的加密十六进制数据
- **解压备份文件**：将解密后的备份文件解压为可读取的文件结构
- **一键处理**：支持一步完成解密和解压操作
- **流式处理**：支持处理超大文件（>2GB），不受内存限制
- **进度显示**：实时显示解密和解压进度
- **用户友好**：美观的命令行界面和详细的错误提示
- **多种解压方式**：支持处理各种格式的安卓备份文件

## 安装

### 全局安装

```bash
npm install -g mi-bak-decryption
```

### 使用 npx 运行

无需安装，直接使用 npx 运行：

```bash
npx mi-bak-decryption decrypt <输入文件路径>
```

### 从源码安装

```bash
git clone https://github.com/yourusername/mi-bak-decryption.git
cd mi-bak-decryption
npm install
npm link  # 可选，创建全局命令链接
```

## 使用方法

### 解密备份文件

将小米备份文件(.bak)解密，移除文件开头的加密数据：

```bash
mi-bak decrypt <输入文件路径> [输出文件路径] [选项]
```

选项：
- `-f, --force` - 如果输出文件已存在，强制覆盖

示例：
```bash
mi-bak decrypt backup.bak                    # 解密到默认输出文件
mi-bak decrypt backup.bak output.ab          # 解密到指定文件
mi-bak decrypt backup.bak output.ab --force  # 强制覆盖已存在的文件
```

### 解压备份文件

将解密后的备份文件解压到指定目录：

```bash
mi-bak extract <备份文件路径> [输出目录] [选项]
```

选项：
- `-p, --password <password>` - 备份文件密码（如果有）
- `-f, --force` - 如果输出目录已存在，强制覆盖
- `-k, --keep-tar` - 保留临时TAR文件

示例：
```bash
mi-bak extract backup.ab                     # 解压到默认目录
mi-bak extract backup.ab ./extracted_files   # 解压到指定目录
mi-bak extract backup.ab -p mypassword       # 使用密码解压加密备份
mi-bak extract backup.ab -k                  # 保留临时TAR文件
```

### 一键解密并解压

一步完成解密和解压操作：

```bash
mi-bak process <输入文件路径> [输出目录] [选项]
```

选项：
- `-p, --password <password>` - 备份文件密码（如果有）
- `-f, --force` - 如果输出文件/目录已存在，强制覆盖
- `-k, --keep-temp` - 保留临时文件（解密后的文件和TAR文件）

示例：
```bash
mi-bak process backup.bak                    # 一键解密并解压
mi-bak process backup.bak ./processed_files  # 指定输出目录
mi-bak process backup.bak -p mypassword      # 使用密码解压
mi-bak process backup.bak -k                 # 保留临时文件
```

## 工作原理

### 解密过程

1. 读取加密的备份文件
2. 查找文件中的 "41 4E" 标记（ASCII 中的 "AN"）
3. 从该标记位置开始截取数据（包含标记本身）
4. 将截取的数据保存为新文件

### 解压过程

1. 读取并解析备份文件头部
2. 检测文件是否加密，如果加密则使用提供的密码解密
3. 检测文件是否压缩，如果压缩则解压缩
4. 将解压后的数据保存为TAR文件
5. 使用纯JavaScript实现的TAR解压器提取TAR文件内容

## 技术细节

- **模块化设计**：将功能拆分为多个模块，便于维护和扩展
- **流式处理**：使用Node.js的流API处理大文件，避免内存溢出
- **转换流**：自定义Transform流用于查找加密标记
- **进度显示**：使用cli-progress库实现进度条
- **命令行界面**：使用commander库实现友好的命令行界面
- **错误处理**：详细的错误提示和故障排除建议

## 项目结构

```
mi-bak-decryption/
├── bin/
│   └── mi-bak.js       # 命令行入口
├── lib/
│   ├── decrypt.js      # 解密功能
│   ├── extract.js      # 解压功能
│   ├── utils.js        # 工具函数
│   └── constants.js    # 常量定义
├── index.js            # 主入口
├── package.json        # 包配置
└── README.md           # 文档
```

## 注意事项

- 此工具专为小米备份文件设计，可能不适用于其他类型的备份文件
- 解压功能支持标准的安卓备份格式（.ab 文件）
- 对于非常大的文件，解密和解压过程可能需要较长时间
- 如果备份文件有密码保护，必须提供正确的密码才能解压
- 文件路径中的特殊字符（如 `< > : " / \ | ? *`）会被自动替换为下划线，以避免文件系统错误

## 常见问题

### 解压失败

如果遇到解压失败的情况，可能是因为：
- 备份文件格式不兼容
- 文件损坏
- 密码错误（如果是加密备份）
- 文件路径中包含特殊字符或过长

解决方法：
- 使用 `--keep-tar` 或 `--keep-temp` 选项保留临时文件，然后使用其他工具手动解压
- 检查是否有足够的磁盘空间
- 确保提供正确的密码（如果需要）

### 密码错误

如果提供的密码不正确，程序会显示"密码错误或主密钥解密失败"或"主密钥校验失败"的错误信息。请确保提供正确的密码。

### 文件路径问题

Windows系统对文件路径有长度限制（通常为260个字符）。如果解压后的文件路径过长，可能会导致错误。此时可以：
- 将备份文件移动到路径较短的位置
- 使用较短的输出目录名称
- 使用Windows的长路径支持（需要系统配置）

## 许可证

MIT