# Cloudflare 部署详细指南

## ⚠️ 重要提示

本项目应该使用 **Cloudflare Pages** 部署，而不是直接使用 Workers。

如果你看到的页面是让你配置 `Build command`、`Deploy command`、`npx wrangler versions upload` 这些选项，说明你进入了 **Workers** 的部署页面，这是错误的入口。

## 正确的部署方式：Cloudflare Pages

### 第一步：创建 KV 命名空间

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 左侧菜单点击「Workers 和 Pages」
3. 点击「KV」标签页
4. 点击「创建命名空间」按钮
5. 输入名称：`AI_CHAT_KEYS`
6. 点击「添加」
7. **复制并保存命名空间 ID**（类似 `a1b2c3d4e5f6...` 的字符串）

### 第二步：修改配置文件

在你的代码仓库中，编辑 `wrangler.toml` 文件：

```toml
name = "ai-chat-app"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "AI_CHAT_KEYS"
id = "把这里替换成你的KV命名空间ID"
```

将 `id` 的值替换为第一步复制的命名空间 ID。

### 第三步：推送代码到 GitHub

```bash
git add .
git commit -m "Update KV namespace ID"
git push
```

### 第四步：创建 Pages 项目（正确入口）

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 左侧菜单点击「Workers 和 Pages」
3. 点击蓝色按钮「创建」
4. **选择「Pages」标签页**（不是 Workers！）
5. 点击「连接到 Git」

![选择 Pages](https://developers.cloudflare.com/assets/pages-create-project.png)

### 第五步：连接 GitHub 仓库

1. 如果首次使用，需要授权 Cloudflare 访问你的 GitHub
2. 选择你的 GitHub 账号
3. 选择 `ai-chat-app` 仓库
4. 点击「开始设置」

### 第六步：配置构建设置

在「设置构建和部署」页面：

| 配置项 | 值 |
|--------|-----|
| 项目名称 | `ai-chat-app`（或你喜欢的名字） |
| 生产分支 | `main`（或你的主分支名） |
| 框架预设 | **None**（选择"无"） |
| 构建命令 | **留空**（不要填任何内容） |
| 构建输出目录 | **留空**（不要填任何内容） |

> ⚠️ 重要：构建命令和输出目录都要留空！因为我们是纯静态文件，不需要构建。

点击「保存并部署」。

### 第七步：绑定 KV 命名空间

部署完成后，需要手动绑定 KV：

1. 进入你的 Pages 项目
2. 点击「设置」标签
3. 左侧菜单选择「Functions」
4. 找到「KV 命名空间绑定」部分
5. 点击「添加绑定」
6. 填写：
   - **变量名称**：`AI_CHAT_KEYS`（必须和代码中一致）
   - **KV 命名空间**：选择你创建的 `AI_CHAT_KEYS`
7. 点击「保存」

### 第八步：重新部署

绑定 KV 后需要重新部署才能生效：

1. 进入 Pages 项目的「部署」标签
2. 找到最新的部署
3. 点击右侧的「...」菜单
4. 选择「重试部署」

或者直接推送一个新的 commit 触发自动部署。

### 第九步：访问应用

部署成功后，你会得到一个域名，格式类似：
```
https://ai-chat-app.pages.dev
```

访问这个域名，使用以下凭证登录：
- 账号：`root`
- 密码：`password`

---

## 常见错误排查

### 错误 1：进入了 Workers 部署页面

**症状**：看到 `Build command`、`Deploy command`、`npx wrangler` 等选项

**解决**：返回「Workers 和 Pages」页面，点击「创建」后选择「Pages」标签，不是 Workers。

### 错误 2：KV 命名空间未绑定

**症状**：登录或保存配置时报错 `AI_CHAT_KEYS is not defined`

**解决**：按照第七步绑定 KV 命名空间，然后重新部署。

### 错误 3：构建失败

**症状**：部署时显示构建错误

**解决**：确保「构建命令」和「构建输出目录」都是空的，框架预设选择「None」。

### 错误 4：Functions 不工作

**症状**：访问 `/api/login` 返回 404

**解决**：
1. 确保 `functions/` 目录在仓库根目录
2. 确保文件结构正确：`functions/api/login.js`
3. 检查 Pages 项目设置中「Functions」是否显示已检测到函数

---

## 项目结构说明

```
你的仓库/
├── index.html              ← Pages 托管的静态文件
├── wrangler.toml           ← KV 绑定配置（需要修改 ID）
├── README.md
└── functions/              ← Pages Functions（自动部署为 Workers）
    └── api/
        ├── _middleware.js  ← 认证中间件
        ├── login.js        ← /api/login
        ├── logout.js       ← /api/logout
        ├── config.js       ← /api/config
        ├── keys.js         ← /api/keys/:id（密钥管理）
        └── chat.js         ← /api/chat
```

Pages 会自动：
1. 将 `index.html` 作为静态网站托管
2. 将 `functions/` 目录下的文件部署为 Workers 函数
3. 路由 `/api/*` 请求到对应的函数

## KV 存储结构

系统在 Cloudflare KV 中存储以下数据：

| Key | 说明 |
|-----|------|
| `user_config` | 用户配置（端点、模型、选择的密钥编号） |
| `api_key_1` 到 `api_key_5` | 5个API密钥槽位 |
| `sessions:{token}` | 用户登录会话（24小时过期） |

所有API密钥都安全存储在Cloudflare KV中，前端永远不会接收到真实密钥值。

---

## 自定义域名（可选）

1. 进入 Pages 项目设置
2. 选择「自定义域」
3. 点击「设置自定义域」
4. 输入你的域名（如 `chat.example.com`）
5. 按提示添加 DNS 记录

Cloudflare 会自动配置 HTTPS 证书。
