# 需求文档：API端点选择器与模型列表

## 概述
将 AI 对话界面的 API 端点从手动输入改为下拉选择，支持不同 API 格式（OpenAI 兼容 / Anthropic 格式），并添加按端点分类的模型列表查看与选择功能。所有数据存储在同一个 KV 命名空间 `AI_CHAT_KEYS` 中。

## 用户故事

### 1. API 端点选择
作为用户，我希望能从预设的 API 端点列表中选择，而不是手动输入，以减少出错。

#### 验收标准
- 1.1 API 端点输入框替换为下拉选择框，包含以下选项：
  - `https://gemini.zx1993.top/v1`（Gemini 端点，OpenAI 兼容格式）
  - `https://a-ocnfniawgw.cn-shanghai.fcapp.run`（AnyRouter 端点，Anthropic 格式）
  - "重新输入"（显示文本输入框，用户自定义端点）
- 1.2 选择"重新输入"时，显示文本输入框让用户手动填写端点 URL
- 1.3 选中的端点保存到 KV 配置中，页面刷新后保持选择状态
- 1.4 端点选择变化时，模型列表应联动更新（见需求 3）

### 2. AnyRouter 端点特殊处理（Anthropic API 格式）
作为用户，当我选择 AnyRouter 端点时，系统应自动使用 Anthropic API 格式发送请求，无需我关心底层差异。

#### 验收标准
- 2.1 选择 AnyRouter 端点时，chat.js 使用 Anthropic Messages API 格式：
  - 请求路径: `/v1/messages`（而非 `/chat/completions`）
  - 请求体包含 `system` 数组、`metadata.user_id`、`messages` 使用 Anthropic 格式
  - 请求头包含 `anthropic-version: 2023-06-01`、`anthropic-beta` 等必要头
- 2.2 正确解析 Anthropic 格式的响应：从 `content[0].text` 提取回复内容（而非 `choices[0].message.content`）
- 2.3 选择 Gemini 端点或自定义端点时，保持现有 OpenAI 兼容格式不变
- 2.4 端点类型（openai / anthropic）存储在 KV 配置中，chat.js 根据类型决定请求格式
- 2.5 AnyRouter 请求需要伪装 Claude Code 请求头（参考 anyrouter-bridge.py 中的 CLAUDE_CODE_HEADERS）

### 3. 模型列表查看与选择
作为用户，我希望能查看当前端点可用的模型列表，并从中选择模型，而不是手动输入模型名。

#### 验收标准
- 3.1 模型输入框旁添加一个"查看模型"按钮
- 3.2 点击按钮后，根据当前选中的端点，从 KV 中读取对应的模型列表并展示
- 3.3 KV 存储结构（使用同一个 `AI_CHAT_KEYS` 命名空间）：
  - `models:gemini` → 存储 Gemini 端点可用模型列表（JSON 数组）
  - `models:anyrouter` → 存储 AnyRouter 端点可用模型列表（JSON 数组）
- 3.4 用户可以从模型列表中点击选择一个模型，自动填入模型输入框
- 3.5 选择"重新输入"自定义端点时，模型列表按钮不可用或提示无预设模型
- 3.6 模型列表为空时，显示"暂无预设模型"提示

## KV 存储设计（统一使用 AI_CHAT_KEYS）

| Key | 用途 | 值格式 |
|-----|------|--------|
| `user_config` | 用户配置（端点、模型、选中的密钥等） | JSON 对象 |
| `api_key_1` ~ `api_key_5` | 预存 API 密钥 | 字符串 |
| `models:gemini` | Gemini 端点可用模型 | JSON 数组，如 `["xx1","xx2","xx3"]` |
| `models:anyrouter` | AnyRouter 端点可用模型 | JSON 数组，如 `["yy1","yy2","yy3"]` |
| `sessions:{token}` | 用户会话 | JSON 对象 |

## 端点与 API 格式映射

| 端点 | 格式 | 请求路径 | 模型 KV Key |
|------|------|----------|-------------|
| `https://gemini.zx1993.top/v1` | OpenAI 兼容 | `/chat/completions` | `models:gemini` |
| `https://a-ocnfniawgw.cn-shanghai.fcapp.run` | Anthropic | `/v1/messages` | `models:anyrouter` |
| 自定义 | OpenAI 兼容（默认） | `/chat/completions` | 无 |
