# Design Document

## Overview

本项目是一个基于 Cloudflare Pages + Workers + KV 的无服务器 AI 对话应用。用户需要先登录（root/password），然后可以配置 AI API 参数并进行对话。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                       │
├─────────────────────────────────────────────────────────────┤
│  index.html          - 前端页面（登录 + 对话界面）           │
│  functions/api/      - Cloudflare Workers 函数               │
│    ├── login.js      - 登录认证                              │
│    ├── logout.js     - 退出登录                              │
│    ├── config.js     - 配置管理                              │
│    └── chat.js       - AI 对话转发                           │
│  wrangler.toml       - Workers 配置（KV 绑定）               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                          │
│  - 托管静态前端文件                                          │
│  - 自动部署 GitHub 代码                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                         │
│  - 处理 /api/* 请求                                          │
│  - 验证用户 token                                            │
│  - 转发 AI API 请求                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare KV                             │
│  - AI_CHAT_CONFIG 命名空间                                   │
│    ├── user_config    - 用户 API 配置                        │
│    ├── users          - 用户凭证 {"root": "password"}        │
│    └── sessions:{id}  - 登录会话 token                       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 前端组件 (index.html)

#### 页面结构
- **登录界面**: 账号/密码输入框 + 登录按钮
- **主界面**: 配置面板 + 聊天区域 + 输入框
- **状态管理**: localStorage 存储 token

#### JavaScript 函数
```javascript
// 登录相关
async function login()           // 发送登录请求
async function logout()          // 退出登录
function checkAuth()             // 检查登录状态
function showLoginPage()         // 显示登录界面
function showChatPage()          // 显示对话界面

// 配置相关
async function loadConfig()      // 加载配置
async function saveConfig()      // 保存配置

// 对话相关
async function sendMessage()     // 发送消息
function addMessage()            // 添加消息到界面
function handleKeyPress()        // 处理回车键
```

### 2. Workers API 接口

#### POST /api/login
- **请求**: `{ "username": "root", "password": "password" }`
- **响应成功**: `{ "status": "success", "token": "xxx" }`
- **响应失败**: `{ "error": "账号或密码错误" }` (401)

#### POST /api/logout
- **请求头**: `Authorization: Bearer {token}`
- **响应**: `{ "status": "success" }`

#### GET /api/config
- **请求头**: `Authorization: Bearer {token}`
- **响应**: `{ "endpoint": "...", "model": "...", "api_key": "..." }`

#### POST /api/config
- **请求头**: `Authorization: Bearer {token}`
- **请求**: `{ "endpoint": "...", "model": "...", "api_key": "..." }`
- **响应**: `{ "status": "success", "config": {...} }`

#### POST /api/chat
- **请求头**: `Authorization: Bearer {token}`
- **请求**: `{ "message": "用户消息" }`
- **响应**: `{ "response": "AI回复", "timestamp": "..." }`

### 3. 认证中间件 (_middleware.js)

统一处理 token 验证，保护 /api/config 和 /api/chat 接口。

```javascript
// 验证流程
1. 从 Authorization header 提取 token
2. 在 KV 中查找 sessions:{token}
3. 验证通过则继续，否则返回 401
```

## Data Models

### KV 存储结构

```javascript
// 用户凭证 (key: "users")
{
  "root": "password"
}

// 用户配置 (key: "user_config")
{
  "endpoint": "https://api.openai.com/v1",
  "model": "gpt-3.5-turbo",
  "api_key": ""
}

// 会话 token (key: "sessions:{token}")
{
  "username": "root",
  "created_at": "2025-01-01T00:00:00.000Z",
  "expires_at": "2025-01-02T00:00:00.000Z"
}
```

### Token 生成

使用 crypto.randomUUID() 生成唯一 token，有效期 24 小时。

## Error Handling

| 场景 | HTTP 状态码 | 错误信息 |
|------|------------|---------|
| 未登录访问受保护接口 | 401 | 未授权，请先登录 |
| 账号或密码错误 | 401 | 账号或密码错误 |
| API 密钥未配置 | 400 | 请先设置API密钥 |
| AI API 请求失败 | 对应状态码 | API错误: {status} - {message} |
| 网络错误 | 500 | 网络错误: {message} |
| 请求方法不支持 | 405 | 不支持的请求方法 |

## Testing Strategy

### 手动测试清单

1. **登录功能**
   - 正确账号密码登录成功
   - 错误账号密码显示错误提示
   - 刷新页面保持登录状态
   - 退出登录返回登录界面

2. **配置功能**
   - 保存配置成功提示
   - 刷新后配置保留
   - 未登录无法访问配置接口

3. **对话功能**
   - 发送消息显示在界面
   - AI 响应正确显示
   - 未配置 API 密钥提示错误
   - 网络错误正确处理

## 项目文件结构

```
ai-chat-app/
├── index.html              # 前端页面（登录 + 对话）
├── wrangler.toml           # Workers 配置
└── functions/
    └── api/
        ├── _middleware.js  # 认证中间件
        ├── login.js        # POST /api/login
        ├── logout.js       # POST /api/logout
        ├── config.js       # GET/POST /api/config
        └── chat.js         # POST /api/chat
```
