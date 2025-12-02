# API Key 安全性分析与加固方案

## ✅ 已实施的安全加固

### 多密钥管理系统

当前版本已实施「API Key 只存不取」的安全方案：

1. **多密钥存储**：支持保存最多5个API密钥，存储在独立的KV键中（`api_key_1` 到 `api_key_5`）
2. **密钥不下发**：前端永远不会接收到真实的API密钥值
3. **状态标记**：只返回密钥是否已设置的布尔值和选择的密钥编号
4. **服务器端使用**：Workers在发送AI请求时直接从KV读取密钥

### 安全流程

```
保存新密钥：
前端 → 新密钥 → Workers → KV存储（api_key_1到api_key_5）

加载配置：
前端 ← 密钥编号 + 状态标记 ← Workers ← KV存储
（不返回真实密钥）

AI对话：
前端 → 用户消息 → Workers → 从KV读取真实密钥 → AI API
```

## 历史问题：为什么旧版本 API Key 可以被获取？

### 问题根源（已修复）

旧版本设计中，API Key 的完整值会在前端和后端之间传输：

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

## ✅ 已实施的加固方案：多密钥管理

### 核心思路

**API Key 永远不返回给前端**，只在 Workers 后端使用。支持管理多个密钥。

```
当前流程（安全）：
保存密钥：
前端 → 新密钥 → Workers → KV存储（api_key_1到api_key_5）

选择密钥：
前端 → 密钥编号（1-5）→ Workers → 更新配置

读取配置：
前端 ← 密钥编号 + 状态 ← Workers
（不返回真实密钥）

AI对话：
Workers 内部读取 KV 中的真实 Key 发送 AI 请求
```

### 已实施的代码改动

#### 1. `functions/api/config.js` - 多密钥管理

**GET /api/config** - 只返回密钥编号和状态：

```javascript
// 🔒 安全加固：不返回真实的 API Key
return new Response(JSON.stringify({
  endpoint: config.endpoint,
  model: config.model,
  selected_api_key: config.selected_api_key || '',
  api_key_set: !!config.selected_api_key
}), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
});
```

**GET /api/config/keys** - 返回所有密钥槽位状态：

```javascript
const keysStatus = {};
for (let i = 1; i <= 5; i++) {
  const key = await env.AI_CHAT_KEYS.get(`api_key_${i}`);
  keysStatus[`key${i}`] = !!key;  // 只返回是否存在
}
```

**POST /api/config** - 保存密钥到独立槽位：

```javascript
// 如果提供了新的API密钥，保存到第一个可用位置
if (data.new_api_key && data.new_api_key.trim() !== '') {
  const newKey = data.new_api_key.trim();
  
  // 找到第一个空位置
  let targetSlot = '1';
  for (let i = 1; i <= 5; i++) {
    const existingKey = await env.AI_CHAT_KEYS.get(`api_key_${i}`);
    if (!existingKey) {
      targetSlot = i.toString();
      break;
    }
  }
  
  // 保存新密钥到独立的KV键
  await env.AI_CHAT_KEYS.put(`api_key_${targetSlot}`, newKey);
  selectedKey = targetSlot;
}
```

#### 2. `functions/api/chat.js` - 从KV读取密钥

```javascript
// 检查是否选择了API密钥
if (!config.selected_api_key) {
  return new Response(
    JSON.stringify({ error: '请先选择或设置API密钥' }),
    { status: 400, ... }
  );
}

// 从KV中获取实际的API密钥
const apiKey = await env.AI_CHAT_KEYS.get(`api_key_${config.selected_api_key}`);
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'API密钥不存在，请重新设置' }),
    { status: 400, ... }
  );
}

// 使用密钥发送请求
const aiResponse = await fetch(`${config.endpoint}/chat/completions`, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
  },
  ...
});
```

#### 3. `index.html` - 密钥选择界面

```html
<select id="apiKeySelect" onchange="handleApiKeySelectChange()">
  <option value="">-- 选择API密钥 --</option>
  <option value="1">API Key 1</option>
  <option value="2">API Key 2</option>
  <option value="3">API Key 3</option>
  <option value="4">API Key 4</option>
  <option value="5">API Key 5</option>
  <option value="custom">重新输入新密钥</option>
</select>
<input type="password" id="apiKey" style="display: none;">
```

```javascript
// 加载密钥状态，标记已设置的密钥
async function loadApiKeyStatus() {
  const response = await fetch('/api/config/keys', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const data = await response.json();
  
  // 更新选项显示
  for (let i = 1; i <= 5; i++) {
    const option = apiKeySelect.querySelector(`option[value="${i}"]`);
    const isSet = data.keys_status[`key${i}`];
    option.textContent = `API Key ${i}${isSet ? ' ✓' : ''}`;
  }
}
```

---

## 加固后的效果

| 攻击方式 | 旧版本 | 当前版本（已加固） |
|---------|--------|------------------|
| F12 Network 查看 GET 响应 | 看到真实 Key | 只看到密钥编号（如 `"selected_api_key": "1"`） |
| F12 Network 查看 POST 请求 | 看到真实 Key | 只有首次设置时能看到，切换密钥时只传编号 |
| Console fetch 请求 | 返回真实 Key | 返回密钥编号和状态标记 |
| curl 调用 API | 返回真实 Key | 返回密钥编号和状态标记 |
| 直接访问 KV 存储 | 需要 Cloudflare 账号权限 | 需要 Cloudflare 账号权限 |

### 多密钥管理的额外安全优势

1. **密钥隔离**：每个密钥独立存储在不同的KV键中
2. **选择性使用**：可以快速切换密钥而无需重新输入
3. **状态可见**：可以看到哪些槽位已设置密钥（✓标记）
4. **最小暴露**：只有在添加新密钥时才需要传输真实密钥值

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
await env.AI_CHAT_KEYS.put('api_key_encrypted', encrypted);
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
