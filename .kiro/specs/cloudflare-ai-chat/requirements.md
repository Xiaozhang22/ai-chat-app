# Requirements Document

## Introduction

本项目旨在将一个基于 Flask 的 AI 对话应用迁移到 Cloudflare + GitHub 的无服务器架构。应用包含以下核心功能：
- 用户登录认证（使用 Cloudflare KV 存储用户凭证）
- AI 对话配置管理（API 端点、模型、API 密钥）
- AI 对话功能（转发请求到 OpenAI 兼容 API）

技术栈：
- 前端：纯静态 HTML/CSS/JavaScript
- 后端：Cloudflare Workers (JavaScript)
- 存储：Cloudflare KV
- 部署：Cloudflare Pages + GitHub

## Requirements

### Requirement 1: 用户登录认证

**User Story:** As a 用户, I want 通过账号密码登录系统, so that 只有授权用户才能访问 AI 对话功能

#### Acceptance Criteria

1. WHEN 用户访问应用首页 AND 未登录 THEN 系统 SHALL 显示登录界面
2. WHEN 用户输入正确的账号(root)和密码(password) AND 点击登录 THEN 系统 SHALL 验证凭证并跳转到对话界面
3. WHEN 用户输入错误的账号或密码 THEN 系统 SHALL 显示错误提示"账号或密码错误"
4. WHEN 用户登录成功 THEN 系统 SHALL 在浏览器存储登录状态（session/token）
5. WHEN 用户已登录 AND 刷新页面 THEN 系统 SHALL 保持登录状态并直接显示对话界面
6. WHEN 用户点击退出登录 THEN 系统 SHALL 清除登录状态并返回登录界面
7. IF 用户未登录 THEN 系统 SHALL 阻止访问 /api/config 和 /api/chat 接口

### Requirement 2: API 配置管理

**User Story:** As a 已登录用户, I want 配置 AI API 的端点、模型和密钥, so that 我可以使用自己的 API 服务

#### Acceptance Criteria

1. WHEN 用户登录成功 THEN 系统 SHALL 显示配置面板，包含 API 端点、模型、API 密钥输入框
2. WHEN 用户首次访问 THEN 系统 SHALL 显示默认配置（端点：https://api.openai.com/v1，模型：gpt-3.5-turbo）
3. WHEN 用户修改配置并点击保存 THEN 系统 SHALL 将配置持久化存储到 Cloudflare KV
4. WHEN 用户刷新页面 THEN 系统 SHALL 从 KV 加载已保存的配置
5. WHEN 配置保存成功 THEN 系统 SHALL 显示"配置已保存"提示

### Requirement 3: AI 对话功能

**User Story:** As a 已登录用户, I want 与 AI 进行对话, so that 我可以获得 AI 的回复

#### Acceptance Criteria

1. WHEN 用户输入消息并发送 THEN 系统 SHALL 在聊天区域显示用户消息
2. WHEN 用户发送消息 AND API 密钥已配置 THEN 系统 SHALL 转发请求到配置的 AI API 端点
3. WHEN AI 返回响应 THEN 系统 SHALL 在聊天区域显示 AI 回复
4. WHEN 等待 AI 响应时 THEN 系统 SHALL 显示"正在思考..."加载状态
5. IF API 密钥未配置 THEN 系统 SHALL 返回错误"请先设置API密钥"
6. IF API 请求失败 THEN 系统 SHALL 显示具体错误信息
7. WHEN 用户按下回车键 THEN 系统 SHALL 发送消息（等同于点击发送按钮）

### Requirement 4: Cloudflare Workers 后端

**User Story:** As a 开发者, I want 使用 Cloudflare Workers 处理后端逻辑, so that 应用可以无服务器运行

#### Acceptance Criteria

1. WHEN 收到 GET /api/config 请求 AND 用户已认证 THEN Workers SHALL 从 KV 读取并返回配置
2. WHEN 收到 POST /api/config 请求 AND 用户已认证 THEN Workers SHALL 将配置写入 KV
3. WHEN 收到 POST /api/chat 请求 AND 用户已认证 THEN Workers SHALL 转发请求到 AI API 并返回响应
4. WHEN 收到 POST /api/login 请求 THEN Workers SHALL 验证用户凭证并返回认证 token
5. WHEN 收到 POST /api/logout 请求 THEN Workers SHALL 使当前 token 失效
6. IF 请求未携带有效 token（除 /api/login 外）THEN Workers SHALL 返回 401 未授权错误
7. WHEN 发生错误 THEN Workers SHALL 返回适当的 HTTP 状态码和错误信息

### Requirement 5: 项目结构与部署

**User Story:** As a 开发者, I want 项目结构符合 Cloudflare Pages 规范, so that 可以通过 GitHub 自动部署

#### Acceptance Criteria

1. WHEN 项目部署 THEN 目录结构 SHALL 包含 index.html（前端）、functions/api/（Workers 代码）、wrangler.toml（配置）
2. WHEN 推送代码到 GitHub THEN Cloudflare Pages SHALL 自动构建和部署
3. WHEN 部署完成 THEN 应用 SHALL 可通过 Cloudflare 分配的域名访问
4. WHEN 配置 KV 绑定 THEN wrangler.toml SHALL 正确关联 KV 命名空间
