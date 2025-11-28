# API Key 安全性分析与加固方案

## 当前问题：为什么 API Key 可以被获取？

### 问题根源

当前设计中，API Key 的完整值会在前端和后端之间传输：

1. **保存配置时**：前端 POST 请求将 API Key 明文发送到 `/api/config`
2. **加载配置时**：后端 GET 响应将 API Key 明文返回给前端
3. **存储位置**：API Key 存储在 Cloudflare KV 中（这部分是安全的）

### 三种获取 API Key 的方法

| 方法 | 操作步骤 | 原理 |
|------|---------|------|
| F12 Network 抓包 | 保存配置 → Network → config → Payload/Response | 拦截 HTTP 请求/响应 |
| Console 请求 | 执行 `fetch('/api/config', {headers...})` | 模拟前端请求 |
| curl 命令 | `curl -H "Authorization: Bearer {token}" /api/config` | 直接调用 API |

### 为什么 `type="password"` 没用？

`<input type="password">` 只是视觉上隐藏输入内容（显示为 `•••••`），但：
- 数据仍以明文存在于 DOM 中
- 网络传输仍是明文
- JavaScript 可以直接读取 `input.value`

这是 UI 层面的遮挡，不是安全措施。

---

## 加固方案：API Key 只存不取

### 核心思路

**API Key 永远不返回给前端**，只在 Workers 后端使用。

```
当前流程（不安全）：
前端 ←→ API Key ←→ KV 存储

加固后流程（安全）：
前端 → API Key → KV 存储（保存）
前端 ← "***" ← KV 存储（读取时隐藏）
Workers 内部读取 KV 中的真实 Key 发送 AI 请求
```

### 需要修改的文件

#### 1. 修改 `functions/api/config.js`

GET 请求返回时隐藏 API Key：

```javascript
// GET 请求：获取配置
if (method === 'GET') {
  try {
    const storedConfig = await env.AI_CHAT_CONFIG.get('user_config');
    const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

    // 🔒 安全加固：不返回真实的 API Key
    return new Response(JSON.stringify({
      endpoint: config.endpoint,
      model: config.model,
      api_key: config.api_key ? '******已设置******' : ''  // 隐藏真实值
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    // ...
  }
}
```

#### 2. 修改 `functions/api/config.js` POST 逻辑

保存时，如果前端传来的是占位符，保留原有的 Key：

```javascript
// POST 请求：保存配置
if (method === 'POST') {
  try {
    const data = await request.json();
    const storedConfig = await env.AI_CHAT_CONFIG.get('user_config');
    const currentConfig = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

    // 🔒 安全加固：如果传入的是占位符或空值，保留原有 Key
    let newApiKey = currentConfig.api_key;
    if (data.api_key && data.api_key !== '******已设置******') {
      newApiKey = data.api_key;  // 只有传入新值才更新
    }

    const newConfig = {
      endpoint: data.endpoint || currentConfig.endpoint,
      model: data.model || currentConfig.model,
      api_key: newApiKey,
    };

    await env.AI_CHAT_CONFIG.put('user_config', JSON.stringify(newConfig));

    // 返回时也隐藏 Key
    return new Response(
      JSON.stringify({
        status: 'success',
        config: {
          endpoint: newConfig.endpoint,
          model: newConfig.model,
          api_key: newConfig.api_key ? '******已设置******' : ''
        }
      }),
      // ...
    );
  }
}
```

#### 3. 修改 `index.html` 前端逻辑

加载配置时，如果是占位符就不填充到输入框：

```javascript
async function loadConfig() {
  // ...
  const config = await response.json();
  document.getElementById('endpoint').value = config.endpoint || '';
  document.getElementById('model').value = config.model || '';
  
  // 🔒 如果是占位符，显示为空让用户知道已设置但不显示真实值
  if (config.api_key === '******已设置******') {
    document.getElementById('apiKey').placeholder = '已设置（重新输入将覆盖）';
    document.getElementById('apiKey').value = '';
  } else {
    document.getElementById('apiKey').value = config.api_key || '';
  }
}
```

---

## 加固后的效果

| 攻击方式 | 加固前 | 加固后 |
|---------|--------|--------|
| F12 Network 查看 GET 响应 | 看到真实 Key | 看到 `******已设置******` |
| F12 Network 查看 POST 请求 | 看到真实 Key | 只有首次设置时能看到 |
| Console fetch 请求 | 返回真实 Key | 返回 `******已设置******` |
| curl 调用 API | 返回真实 Key | 返回 `******已设置******` |
| 直接访问 KV 存储 | 需要 Cloudflare 账号权限 | 需要 Cloudflare 账号权限 |

---

## 进一步加固（可选）

### 方案 A：API Key 完全不经过前端

将 API Key 直接配置在 Cloudflare 环境变量中，而不是通过网页设置：

1. Cloudflare Pages → 设置 → 环境变量
2. 添加 `OPENAI_API_KEY = 你的Key`
3. Workers 代码直接读取 `env.OPENAI_API_KEY`

优点：Key 完全不经过网络传输
缺点：修改 Key 需要去 Cloudflare 控制台

### 方案 B：加密存储

使用 Web Crypto API 在 Workers 中加密存储：

```javascript
// 加密后存储
const encrypted = await crypto.subtle.encrypt(...);
await env.AI_CHAT_CONFIG.put('api_key_encrypted', encrypted);
```

优点：即使 KV 数据泄露也无法直接使用
缺点：实现复杂，密钥管理是新问题

---

## 总结

| 安全级别 | 方案 | 复杂度 | 推荐场景 |
|---------|------|--------|---------|
| 基础 | 当前方案 | 低 | 个人使用、信任所有登录用户 |
| 中等 | API Key 只存不取 | 低 | 多用户、防止意外泄露 |
| 高级 | 环境变量存储 | 中 | 生产环境、Key 不常变更 |
| 最高 | 加密存储 | 高 | 高安全要求场景 |

对于你的场景，建议实施「API Key 只存不取」方案，改动小、效果明显。
