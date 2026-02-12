# 设计文档：API端点选择器与模型列表

## 概述
本设计涵盖三个核心变更：API 端点下拉选择、AnyRouter Anthropic 格式适配、按端点分类的模型列表功能。

## 架构设计

### 端点类型系统

在 `chat.js` 中引入端点类型概念，根据端点 URL 决定请求格式：

```
ENDPOINT_PRESETS = {
  "gemini": {
    url: "https://gemini.zx1993.top/v1",
    type: "openai",
    modelsKey: "models:gemini"
  },
  "anyrouter": {
    url: "https://a-ocnfniawgw.cn-shanghai.fcapp.run",
    type: "anthropic",
    modelsKey: "models:anyrouter"
  }
}
```

### 请求格式分支（chat.js）

```
if (endpoint_type === "anthropic") {
  → POST {endpoint}/v1/messages
  → Anthropic 请求头 + 请求体
  → 解析 content[0].text
} else {
  → POST {endpoint}/chat/completions（现有逻辑）
  → OpenAI 请求头 + 请求体
  → 解析 choices[0].message.content
}
```

### Anthropic 请求构造（参考 anyrouter-bridge.py）

请求头：
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {apiKey}",
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "interleaved-thinking-2025-05-14",
  "User-Agent": "claude-cli/2.1.39 (external, cli)",
  "x-app": "cli",
  "anthropic-dangerous-direct-browser-access": "true"
}
```

请求体：
```json
{
  "model": "{model}",
  "max_tokens": 4096,
  "messages": [{"role": "user", "content": "{userMessage}"}],
  "system": [{"type": "text", "text": "You are a helpful assistant."}],
  "metadata": {"user_id": "webchat-user"},
  "stream": false
}
```

响应解析：
```
response.content[0].text → 提取文本回复
```

## KV 数据变更

### user_config 结构扩展

```json
{
  "endpoint": "https://gemini.zx1993.top/v1",
  "endpoint_type": "openai",
  "selected_endpoint": "gemini",
  "model": "xx1",
  "selected_api_key": "1"
}
```

新增字段：
- `endpoint_type`: `"openai"` 或 `"anthropic"`，决定 chat.js 的请求格式
- `selected_endpoint`: `"gemini"` / `"anyrouter"` / `"custom"`，记录用户选择的端点标识

### 模型列表 KV

- `models:gemini` → `["xx1", "xx2", "xx3"]`
- `models:anyrouter` → `["yy1", "yy2", "yy3"]`

## 文件变更清单

### 1. `index.html` — 前端 UI 变更
- API 端点：`<input>` → `<select>` + 隐藏的 `<input>`（用于自定义输入）
- 模型行：添加"查看模型"按钮，点击弹出模型列表弹窗/下拉
- 新增 JS 函数：`handleEndpointSelectChange()`、`loadModels()`、`selectModel()`
- 端点选择联动：切换端点时自动加载对应模型列表

### 2. `functions/api/chat.js` — 后端对话逻辑
- 引入 `ENDPOINT_PRESETS` 常量
- 根据 `endpoint_type` 分支构造请求（OpenAI / Anthropic）
- Anthropic 分支：构造正确的请求头、请求体、解析响应
- 提取公共函数：`buildOpenAIRequest()`、`buildAnthropicRequest()`、`parseOpenAIResponse()`、`parseAnthropicResponse()`

### 3. `functions/api/config.js` — 配置管理
- POST 处理：保存 `selected_endpoint`、`endpoint_type` 字段
- GET 处理：返回 `selected_endpoint`、`endpoint_type` 字段
- 新增 GET `/api/config/models?endpoint={gemini|anyrouter}` 接口，从 KV 读取模型列表

### 4. 无需新增文件
所有变更在现有文件中完成。

## 正确性属性

### Property 1: 端点类型决定请求格式
对于任意用户消息和端点配置：
- 当 `endpoint_type === "anthropic"` 时，请求必须发送到 `{endpoint}/v1/messages`，请求体包含 `system` 数组和 `metadata`，请求头包含 `anthropic-version`
- 当 `endpoint_type === "openai"` 时，请求必须发送到 `{endpoint}/chat/completions`，请求体包含 `messages` 数组，请求头包含 `Authorization: Bearer`

**Validates: Requirements 2.1, 2.3**

### Property 2: Anthropic 响应解析正确性
对于任意有效的 Anthropic API 响应（包含 `content` 数组，其中至少有一个 `type: "text"` 的元素）：
- 解析结果必须等于 `content` 数组中第一个 `type: "text"` 元素的 `text` 字段

**Validates: Requirements 2.2**

### Property 3: 配置持久化往返一致性
对于任意有效的端点选择（gemini / anyrouter / custom）：
- 保存配置后再加载，`selected_endpoint`、`endpoint`、`endpoint_type` 必须与保存时一致

**Validates: Requirements 1.3**

### Property 4: 模型列表与端点对应
对于任意端点标识（gemini / anyrouter）：
- 从 KV 读取的模型列表必须对应正确的 KV key（`models:{endpoint_id}`）
- 返回的模型列表必须是 JSON 数组

**Validates: Requirements 3.2, 3.3**

## 测试框架
- 单元测试和属性测试使用 Vitest + fast-check
- 测试文件放在 `ai-chat-app/tests/` 目录下
