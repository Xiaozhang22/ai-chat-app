// AI 对话接口 - POST /api/chat

// 默认配置
const DEFAULT_CONFIG = {
  endpoint: 'https://api.openai.com/v1',
  endpoint_type: 'openai',
  selected_endpoint: '',
  model: 'gpt-3.5-turbo',
  selected_api_key: ''
};

// 端点预设
const ENDPOINT_PRESETS = {
  gemini: {
    url: 'https://gemini.zx1993.top/v1',
    type: 'openai',
  },
  anyrouter: {
    url: 'https://a-ocnfniawgw.cn-shanghai.fcapp.run',
    type: 'anthropic',
  }
};

// 完整的 Claude Code 伪装请求头（参考 anyrouter-bridge.py）
const ANTHROPIC_HEADERS = {
  'User-Agent': 'claude-cli/2.1.39 (external, cli)',
  'X-Stainless-Lang': 'js',
  'X-Stainless-Package-Version': '0.73.0',
  'X-Stainless-OS': 'Linux',
  'X-Stainless-Arch': 'x64',
  'X-Stainless-Runtime': 'node',
  'X-Stainless-Runtime-Version': 'v22.13.1',
  'X-Stainless-Timeout': '600',
  'anthropic-dangerous-direct-browser-access': 'true',
  'anthropic-version': '2023-06-01',
  'x-app': 'cli',
  'anthropic-beta': 'interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05',
  'accept-language': '*',
  'sec-fetch-mode': 'cors',
  'Accept': 'application/json',
};

// Claude Code system prompt（AnyRouter 验证需要）
const CLAUDE_CODE_SYSTEM = [
  {
    type: 'text',
    text: 'You are Claude Code, Anthropic\'s official CLI for Claude.',
    cache_control: { type: 'ephemeral' }
  },
  {
    type: 'text',
    text: 'You are a helpful AI assistant.'
  }
];

// 构造 OpenAI 兼容请求
function buildOpenAIRequest(endpoint, model, apiKey, userMessage) {
  return {
    url: `${endpoint}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: userMessage }],
      stream: false,
    }),
  };
}

// 构造 Anthropic 请求（完整伪装 Claude Code 请求）
function buildAnthropicRequest(endpoint, model, apiKey, userMessage) {
  // 生成伪装的 user_id（参考 anyrouter-bridge.py 格式）
  const sessionId = crypto.randomUUID();
  const fakeUserHash = 'webchat-bridge-user-hash';

  return {
    url: `${endpoint}/v1/messages?beta=true`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...ANTHROPIC_HEADERS,
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: userMessage }],
      system: CLAUDE_CODE_SYSTEM,
      metadata: {
        user_id: `user_${fakeUserHash}_account__session_${sessionId}`
      },
      stream: false,
    }),
  };
}

// 解析 OpenAI 响应
function parseOpenAIResponse(result) {
  return result.choices?.[0]?.message?.content || '无法解析响应';
}

// 解析 Anthropic 响应
function parseAnthropicResponse(result) {
  if (result.content && Array.isArray(result.content)) {
    const textBlock = result.content.find(b => b.type === 'text');
    if (textBlock) return textBlock.text;
  }
  return '无法解析响应';
}

export async function onRequest(context) {
  const { request, env } = context;

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: '不支持的请求方法' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    // 获取用户配置
    const storedConfig = await env.AI_CHAT_KEYS.get('user_config');
    const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

    // 检查是否选择了API密钥
    if (!config.selected_api_key) {
      return new Response(
        JSON.stringify({ error: '请先选择或设置API密钥' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 从KV中获取实际的API密钥
    const apiKey = await env.AI_CHAT_KEYS.get(`api_key_${config.selected_api_key}`);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥不存在，请重新设置' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 解析用户消息
    const data = await request.json();
    const userMessage = data.message?.trim();

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: '消息不能为空' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 根据端点类型构造请求
    const endpointType = config.endpoint_type || 'openai';
    const endpoint = config.endpoint || DEFAULT_CONFIG.endpoint;
    const model = config.model || DEFAULT_CONFIG.model;

    let reqConfig;
    if (endpointType === 'anthropic') {
      reqConfig = buildAnthropicRequest(endpoint, model, apiKey, userMessage);
    } else {
      reqConfig = buildOpenAIRequest(endpoint, model, apiKey, userMessage);
    }

    // 发送请求到 AI API
    const aiResponse = await fetch(reqConfig.url, {
      method: 'POST',
      headers: reqConfig.headers,
      body: reqConfig.body,
    });

    // 处理响应
    if (aiResponse.ok) {
      const result = await aiResponse.json();
      let assistantMessage;

      if (endpointType === 'anthropic') {
        assistantMessage = parseAnthropicResponse(result);
      } else {
        assistantMessage = parseOpenAIResponse(result);
      }

      return new Response(
        JSON.stringify({
          response: assistantMessage,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } else {
      const errorText = await aiResponse.text();
      return new Response(
        JSON.stringify({ error: `API错误: ${aiResponse.status} - ${errorText}` }),
        {
          status: aiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `网络错误: ${error.message}` }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
