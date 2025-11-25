# 🤖 轻量 AI 对话应用

基于 Cloudflare Pages + Workers + KV 的无服务器 AI 对话应用，支持自定义 API 端点和模型配置。

## ✨ 功能特性

- 🔐 用户登录认证（基于 Token，24小时有效期）
- ⚙️ 自定义 API 配置（端点、模型、API 密钥）
- 💬 AI 对话功能（支持 OpenAI 兼容 API）
- 💾 配置持久化存储（Cloudflare KV）
- 🌍 全球 CDN 加速（Cloudflare 边缘网络）
- 🆓 完全免费部署

## 📁 项目结构

```
ai-chat-app/
├── index.html              # 前端页面（登录 + 对话界面）
├── wrangler.toml           # Cloudflare Workers 配置
├── README.md               # 项目说明文档
└── functions/
    └── api/
        ├── _middleware.js  # 认证中间件（Token 验证）
        ├── login.js        # POST /api/login - 登录接口
        ├── logout.js       # POST /api/logout - 退出登录
        ├── config.js       # GET/POST /api/config - 配置管理
        └── chat.js         # POST /api/chat - AI 对话
```

## 🚀 部署步骤

### 第一步：创建 Cloudflare KV 命名空间

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 左侧菜单选择「Workers 和 Pages」→「KV」
3. 点击「创建命名空间」
4. 输入名称（如 `AI_CHAT_CONFIG`），点击创建
5. **记录命名空间的 ID**（后续配置需要）

### 第二步：配置项目

编辑 `wrangler.toml` 文件，将 KV 命名空间 ID 替换为你的实际 ID：

```toml
[[kv_namespaces]]
binding = "AI_CHAT_CONFIG"
id = "你的KV命名空间ID"  # ← 替换这里
```

### 第三步：推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/ai-chat-app.git
git push -u origin main
```

### 第四步：部署到 Cloudflare Pages

1. 登录 Cloudflare 控制台
2. 选择「Workers 和 Pages」→「创建」→「Pages」→「连接到 Git」
3. 选择你的 GitHub 仓库
4. 配置部署参数：
   - 框架预设：`None`
   - 构建命令：留空
   - 构建输出目录：留空
5. 点击「保存并部署」

### 第五步：绑定 KV 命名空间

1. 部署完成后，进入项目设置
2. 选择「Functions」→「KV 命名空间绑定」
3. 添加绑定：
   - 变量名称：`AI_CHAT_CONFIG`
   - KV 命名空间：选择你创建的命名空间
4. 重新部署项目使绑定生效

## 🔑 默认登录凭证

| 账号 | 密码 |
|------|------|
| root | password |

> ⚠️ 生产环境请修改 `functions/api/login.js` 中的用户凭证

## 📖 使用说明

1. 访问部署后的域名（如 `https://ai-chat-app.pages.dev`）
2. 使用账号密码登录
3. 配置 API 设置：
   - API 端点：OpenAI 兼容的 API 地址
   - 模型：如 `gpt-3.5-turbo`、`gpt-4` 等
   - API 密钥：你的 API Key
4. 点击「保存配置」
5. 开始与 AI 对话

## 🔧 API 接口说明

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/login` | POST | 用户登录 | 否 |
| `/api/logout` | POST | 退出登录 | 是 |
| `/api/config` | GET | 获取配置 | 是 |
| `/api/config` | POST | 保存配置 | 是 |
| `/api/chat` | POST | AI 对话 | 是 |

## 💰 免费额度

Cloudflare 免费套餐完全够用：

| 服务 | 免费额度 |
|------|---------|
| Pages | 无限流量、无限请求 |
| Workers | 每天 10 万次请求 |
| KV | 1GB 存储、100万次读取/月、10万次写入/月 |

## 🛠️ 自定义修改

### 修改登录凭证

编辑 `functions/api/login.js`：

```javascript
const USERS = {
  root: 'password',      // 修改密码
  admin: 'admin123',     // 添加新用户
};
```

### 修改默认 API 配置

编辑 `functions/api/config.js` 和 `functions/api/chat.js`：

```javascript
const DEFAULT_CONFIG = {
  endpoint: 'https://api.openai.com/v1',  // 默认端点
  model: 'gpt-3.5-turbo',                  // 默认模型
  api_key: ''
};
```

### 修改 Token 有效期

编辑 `functions/api/login.js`：

```javascript
// 修改 24 * 60 * 60 * 1000 为你想要的毫秒数
const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
```

## 📝 常见问题

### Q: 部署后提示 KV 命名空间未找到？

确保：
1. `wrangler.toml` 中的 KV ID 正确
2. 在 Cloudflare Pages 设置中绑定了 KV 命名空间
3. 重新部署项目

### Q: 登录后刷新页面需要重新登录？

检查浏览器是否禁用了 localStorage，Token 存储在 localStorage 中。

### Q: API 请求返回 CORS 错误？

所有 Workers 接口已添加 CORS 头，如果仍有问题，检查是否有浏览器插件拦截。

## 📄 License

MIT License
