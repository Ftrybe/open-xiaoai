# Open-XiaoAI x MiGPT-Next

[Open-XiaoAI](https://github.com/idootop/open-xiaoai) 的 Node.js 版 Server 端，用来演示小爱音箱接入[MiGPT](https://github.com/idootop/mi-gpt)（完美版）。

相比原版的 `MiGPT` 和 `MiGPT-Next` 项目，该版本可以完美打断小爱音箱的回复，响应延迟更低，效果更完美 👍

## ✨ 新功能

### 🎯 Web 可视化管理界面

- **可视化规则管理**：通过Web界面轻松管理自定义消息处理规则
- **多种触发方式**：支持精确匹配、包含、开始于、结束于等匹配模式
- **丰富的响应类型**：
  - 📝 文字回复
  - 🎵 音频播放
  - 💻 本地代码执行
  - 🔒 沙盒代码执行
  - ⚡ 终端命令执行（支持SSH远程执行）
  - 🌐 API接口调用
  - 🐍 Python远程执行
  - 📦 Node.js远程执行
- **实时配置**：规则修改后立即生效，无需重启服务
- **搜索过滤**：支持按关键词、描述、响应类型搜索规则

### 🔧 访问Web管理界面

服务启动后，访问以下地址来管理配置：

- **Web管理界面**: <http://localhost:3001>
- **默认端口**: 3001（可在配置中修改）

## 快速开始

> [!NOTE]
> 继续下面的操作之前，你需要先在小爱音箱上启动运行 Rust 补丁程序 [👉 教程](../../packages/client-rust/README.md)

首先，克隆仓库代码到本地。

```shell
# 克隆代码
git clone https://github.com/idootop/open-xiaoai.git

# 进入当前项目根目录
cd examples/migpt
```

然后把 `config.ts` 文件里的配置修改成你自己的。

```typescript
export const kOpenXiaoAIConfig = {
  openai: {
    model: "gpt-4.1-mini",
    baseURL: "https://api.openai.com/v1",
    apiKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  prompt: {
    system: "你是一个智能助手，请根据用户的问题给出回答。",
  },
  // Web管理界面配置（可选）
  webServer: {
    port: 3001,        // Web管理界面端口，默认3001
    enabled: true      // 是否启用Web管理界面，默认启用
  },
  async onMessage(engine, { text }) {
    // 使用动态配置处理自定义规则
    const result = await dynamicConfig.handleCustomMessage(engine, { text });
    if (result) return result;
    
    // 传统的硬编码规则（可选保留）
    if (text === "测试") {
      return { text: "你好，很高兴认识你！" };
    }
  },
};
```

### 📝 配置说明

#### 基础配置

- `openai`: OpenAI API配置
  - `model`: 使用的模型名称
  - `baseURL`: API基础URL
  - `apiKey`: API密钥

#### Web管理界面配置

- `webServer.port`: Web管理界面端口（默认：3001）
- `webServer.enabled`: 是否启用Web管理界面（默认：启用）

#### 自定义规则处理

项目集成了动态配置系统，支持通过Web界面管理自定义规则，无需修改代码：

1. **访问管理界面**: 启动服务后访问 <http://localhost:3001>
2. **添加规则**: 点击"新增规则"按钮
3. **配置触发条件**: 选择匹配方式和关键词
4. **设置响应**: 选择响应类型并配置相应参数
5. **实时生效**: 保存后规则立即生效，无需重启

#### 匹配方式说明

系统支持多种关键词匹配方式，满足不同的使用需求：

##### 1. 精确匹配 (exact)

用户输入必须完全等于关键词才会触发。

- **适用场景**: 特定命令、开关控制
- **示例**: 关键词"开灯" → 只有说"开灯"才会触发

##### 2. 包含匹配 (contains)

用户输入包含关键词即可触发（不区分大小写）。

- **适用场景**: 模糊查询、内容检索
- **示例**: 关键词"天气" → "今天天气怎么样"、"查询天气"都会触发

##### 3. 正则表达式 (regex)

使用正则表达式进行复杂模式匹配。

- **适用场景**: 复杂模式、参数提取
- **示例**: 关键词`播放(.+)` → "播放周杰伦的歌"会提取"周杰伦的歌"

##### 4. 关键词匹配 (keywords)

检查输入是否包含任意一个关键词。

- **适用场景**: 多个同义词、相关词汇
- **示例**: 关键词["你好", "hello", "hi"] → 任意一个都会触发

#### SSH远程执行配置

终端命令支持SSH远程执行，配置包括：

- **主机信息**: IP地址、端口、用户名
- **认证方式**:
  - 密钥认证（推荐）：指定私钥文件路径
  - 密码认证：需要安装`sshpass`工具
- **执行选项**: 工作目录、超时时间、是否返回输出

#### 响应类型详细说明

系统支持多种响应类型，每种类型都有其特定的用途和配置方式：

##### 1. 文本回复 (text)

直接返回预设的文本内容给用户。

**配置说明**：

- `text`: 要返回的文本内容
- 支持多行文本，可包含换行符
- 适用于固定回复、帮助信息、快捷回复等场景

**示例**：

- 触发词："帮助"
- 响应：显示功能使用说明

##### 2. API调用 (api)

调用外部API接口并返回结果。

**配置说明**：

- `url`: API接口地址
- `method`: 请求方法（GET、POST、PUT、DELETE）
- `headers`: 请求头信息（JSON格式）
- `body`: 请求体数据（JSON格式）
- 自动解析JSON响应，支持复杂数据结构

**使用场景**：

- 查询天气信息
- 获取股票价格
- 调用智能家居API
- 第三方服务集成

##### 3. 终端命令 (terminal)

执行系统命令或脚本，支持本地和SSH远程执行。

**配置说明**：

- `command`: 要执行的命令（支持多行）
- `workingDirectory`: 命令执行目录
- `timeout`: 超时时间（毫秒）
- `returnOutput`: 是否返回执行结果
- **SSH配置**（可选）：
  - `host`: 远程主机地址
  - `port`: SSH端口（默认22）
  - `username`: 登录用户名
  - `privateKeyPath`: 私钥文件路径（推荐）
  - `password`: 登录密码（需要sshpass）

**使用场景**：

- 系统监控和状态查询
- 远程服务器管理
- 自动化脚本执行
- 文件操作和数据处理

**输出处理**：

- 优先返回标准输出(stdout)
- 如果stdout为空，返回错误输出(stderr)
- 支持实时输出显示
- 自动处理命令执行超时

#### 配置示例

以下是一些实用的规则配置示例：

##### 示例1：天气查询API

```json
{
  "keyword": "天气",
  "matchType": "contains",
  "responseType": "api",
  "response": {
    "url": "https://api.openweathermap.org/data/2.5/weather",
    "method": "GET",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "q": "Beijing",
      "appid": "your-api-key"
    }
  }
}
```

##### 示例2：系统状态检查

```json
{
  "keyword": "系统状态",
  "matchType": "exact",
  "responseType": "terminal",
  "response": {
    "command": "uptime && df -h && free -m",
    "workingDirectory": "/",
    "timeout": 10000,
    "returnOutput": true
  }
}
```

##### 示例3：SSH远程重启服务

```json
{
  "keyword": "重启nginx",
  "matchType": "exact",
  "responseType": "terminal",
  "response": {
    "command": "sudo systemctl restart nginx && sudo systemctl status nginx",
    "host": "192.168.1.100",
    "port": 22,
    "username": "admin",
    "privateKeyPath": "/path/to/private/key",
    "workingDirectory": "/var/log",
    "timeout": 30000,
    "returnOutput": true
  }
}
```

### Docker 运行

[![Docker Image Version](https://img.shields.io/docker/v/idootop/open-xiaoai-migpt?color=%23086DCD&label=docker%20image)](https://hub.docker.com/r/idootop/open-xiaoai-migpt)

推荐使用以下命令，直接 Docker 一键运行。

```shell
docker run -it --rm -p 4399:4399 -v $(pwd)/config.ts:/app/config.ts idootop/open-xiaoai-migpt:latest
```

### 编译运行

> [!TIP]
> 如果你是一名开发者，想要修改源代码实现自己想要的功能，可以按照下面的步骤，自行编译运行该项目。

为了能够正常编译运行该项目，你需要安装以下依赖环境：

- Node.js v22.x: <https://nodejs.org/zh-cn/download>
- Rust: <https://www.rust-lang.org/learn/get-started>

准备好开发环境后，按以下步骤即可正常启动该项目。

```bash
# 启用 PNPM 包管理工具
corepack enable && corepack install

# 安装依赖
pnpm install

# 编译运行
pnpm dev
```

## 注意事项

1. 默认 Server 服务端口为 `4399`（比如 ws://192.168.31.227:4399），运行前请确保该端口未被其他程序占用。

2. 默认 Rust Server 在启动时，并没有开启小爱音箱的录音能力。
   如果你需要在 Node.js 端正常接收音频输入流，或者播放音频输出流，请将 `src/server.rs` 文件中被注释掉的 `start_recording` 和 `start_play` 代码加回来，然后重新编译运行。

> [!NOTE]
> 本项目只是一个简单的演示程序，抛砖引玉。如果你想要更多的功能，比如唤醒词识别、语音转文字、连续对话等（甚至是对接 OpenAI 的 [Realtime API](https://platform.openai.com/docs/guides/realtime)），可参考本项目代码自行实现。
