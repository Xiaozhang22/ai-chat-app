# 任务列表：API端点选择器与模型列表

## 任务

- [x] 1. 修改 chat.js — 支持 Anthropic 请求格式
  - [x] 1.1 添加 ENDPOINT_PRESETS 常量和端点类型判断逻辑
  - [x] 1.2 实现 Anthropic 请求构造（请求头、请求体、路径 /v1/messages）
  - [x] 1.3 实现 Anthropic 响应解析（从 content[0].text 提取回复）
  - [x] 1.4 保持 OpenAI 兼容格式作为默认分支

- [x] 2. 修改 config.js — 扩展配置管理
  - [x] 2.1 POST 处理：支持保存 selected_endpoint 和 endpoint_type 字段
  - [x] 2.2 GET 处理：返回 selected_endpoint 和 endpoint_type 字段
  - [x] 2.3 新增 GET /api/config/models 接口，根据 endpoint 参数从 KV 读取模型列表

- [x] 3. 修改 index.html — 前端 UI 与交互
  - [x] 3.1 API 端点：input 替换为 select 下拉框 + 隐藏 input（自定义输入）
  - [x] 3.2 模型行：添加"查看模型"按钮
  - [x] 3.3 实现 handleEndpointSelectChange() 函数（端点切换逻辑）
  - [x] 3.4 实现 loadModels() 和 selectModel() 函数（模型列表加载与选择）
  - [x] 3.5 更新 saveConfig() 和 loadConfig() 以支持新的端点选择字段
  - [x] 3.6 模型列表弹窗/下拉 UI 样式
