# AI Terminal

基于 Cloudflare Pages + Workers + KV 的无服务器 AI 对话应用，支持多端点切换（Gemini / AnyRouter / CPA Codex）和 API Key 自动绑定。

> 本项目使用 **Cloudflare Pages Functions**，`functions/` 目录下的代码会自动部署为 Workers。只需部署到 Pages，无需单独创建 Workers 项目。

## 功能特性

- 用户登录认证（Token，24小时有效期）
- 多 API 端点预设（Gemini / AnyRouter / CPA Codex）
- 端点与 API Key 自动绑定，切换端点自动匹配密钥
- 支持 OpenAI 兼容格式和 Anthropic 格式
- 流式输出（SSE）
- 配置持久化（Cloudflare KV）
- 深色科技风 UI（霓虹发光 + 网格动画 + 毛玻璃）

## 项目结构

```
ai-chat-app/
├── index.html                  # 前端页面（登录 + 对话界面）
├── wrangler.toml               # Cloudflare Workers 配置
├── README.md
├── DEPLOY_GUIDE.md
├── SECURITY.md
└── functions/api/
    ├── _middleware.js           # 认证中间件（Token 验证）
    ├── login.js                 # POST /api/login
    ├── logout.js                # POST /api/logout
    ├── config.js                # GET/POST /api/config
    ├── chat.js                  # POST /api/chat（流式对话）
    ├── keys.js                  # DELETE /api/keys/:id
    ├── config/models.js         # GET /api/config/models
    └── config/keys.js           # GET /api/config/keys
```

## 端点与 API Key 映射

系统内置三个 API 端点预设，每个端点绑定固定的 API Key 槽位：

| 端点 | 地址 | 协议格式 | 绑定 Key |
|------|------|----------|----------|
| **AnyRouter** | Anthropic 兼容路由 | Anthropic | Key 1（自动） |
| **Gemini** | gemini.zx1993.top | OpenAI | Key 2 / 3 / 4 / 5（手动选择） |
| **CPA Codex** | cpa.zx1993.top | OpenAI | Key 6（自动） |

- 选择 AnyRouter 或 CPA Codex 时，API Key 自动分配，无需手动选择
- 选择 Gemini 时，从 Key 2-5 中手动选择
- 切换端点后，如果当前 Key 不在允许范围内，后端会自动回退到该端点的第一个可用 Key

## 部署步骤

### 1. 创建 Cloudflare KV 命名空间

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 左侧菜单「Workers 和 Pages」→「KV」
3. 创建命名空间（如 `AI_CHAT_KEYS`），记录 ID

### 2. 配置项目

编辑 `wrangler.toml`，替换 KV 命名空间 ID：

```toml
[[kv_namespaces]]
binding = "AI_CHAT_KEYS"
id = "你的KV命名空间ID"
```

### 3. 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/ai-chat-app.git
git push -u origin main
```

### 4. 部署到 Cloudflare Pages

1. Cloudflare 控制台 →「Workers 和 Pages」→「创建」→「Pages」→「连接到 Git」
2. 选择仓库，框架预设 `None`，构建命令和输出目录留空
3. 部署完成后进入项目设置 →「Functions」→「KV 命名空间绑定」
4. 添加绑定：变量名 `AI_CHAT_KEYS`，选择对应命名空间
5. 重新部署使绑定生效

## 默认登录凭证

| 账号 | 密码 |
|------|------|
| root | password |

> 生产环境请修改 `functions/api/login.js` 中的用户凭证。

## API 接口

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/login` | POST | 用户登录 | 否 |
| `/api/logout` | POST | 退出登录 | 是 |
| `/api/config` | GET | 获取配置（含 `allowed_keys`） | 是 |
| `/api/config` | POST | 保存配置（含 Key 合法性验证） | 是 |
| `/api/config/models` | GET | 获取端点可用模型列表 | 是 |
| `/api/config/keys` | GET | 获取 Key 槽位状态 | 是 |
| `/api/keys/:id` | DELETE | 删除指定 Key | 是 |
| `/api/chat` | POST | AI 对话（SSE 流式） | 是 |

## KV 存储结构

| Key | 内容 |
|-----|------|
| `user_config` | JSON：endpoint、model、selected_api_key 等 |
| `api_key_1` ~ `api_key_6` | API 密钥明文 |
| `sessions:{token}` | 登录会话（24h TTL） |
| `models:gemini` / `models:anyrouter` / `models:cpa` | 各端点可用模型列表 |

## 自定义修改

### 修改登录凭证

```javascript
// functions/api/login.js
const USERS = {
  root: 'your_password',
  admin: 'admin123',
};
```

### 修改端点预设或 Key 映射

```javascript
// functions/api/config.js
const ENDPOINT_KEY_MAP = {
  anyrouter: ['1'],
  gemini: ['2', '3', '4', '5'],
  cpa: ['6'],
};
```

前端 `index.html` 中也有对应的 `ENDPOINT_KEY_MAP`，需同步修改。

### 修改 Token 有效期

```javascript
// functions/api/login.js
const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
```

## 免费额度

| 服务 | 免费额度 |
|------|---------|
| Pages | 无限流量、无限请求 |
| Workers | 每天 10 万次请求 |
| KV | 1GB 存储、100万次读取/月、10万次写入/月 |

## License

MIT License
