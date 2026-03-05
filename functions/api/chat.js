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
  'Accept': 'text/event-stream',
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

// 构造 OpenAI 兼容请求（流式）
function buildOpenAIRequest(endpoint, model, apiKey, messages) {
  return {
    url: `${endpoint}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
    }),
  };
}

// 构造 Anthropic 请求（流式）
function buildAnthropicRequest(endpoint, model, apiKey, messages) {
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
      messages: messages,
      system: CLAUDE_CODE_SYSTEM,
      metadata: {
        user_id: `user_${fakeUserHash}_account__session_${sessionId}`
      },
      stream: true,
    }),
  };
}

// 将 OpenAI SSE 流转换为统一的文本 SSE 流
function transformOpenAIStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: content })}\n\n`));
            }
          } catch (e) {
            // skip unparseable lines
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    }
  });
}

// 将 Anthropic SSE 流转换为统一的文本 SSE 流
function transformAnthropicStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const text = parsed.delta.text;
              if (text) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } else if (parsed.type === 'message_stop') {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
          } catch (e) {
            // skip unparseable lines
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    }
  });
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

    // 解析请求体
    const data = await request.json();
    const messages = data.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
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
      reqConfig = buildAnthropicRequest(endpoint, model, apiKey, messages);
    } else {
      reqConfig = buildOpenAIRequest(endpoint, model, apiKey, messages);
    }

    // 发送请求到 AI API
    const aiResponse = await fetch(reqConfig.url, {
      method: 'POST',
      headers: reqConfig.headers,
      body: reqConfig.body,
    });

    // 处理响应
    if (aiResponse.ok) {
      let stream;
      if (endpointType === 'anthropic') {
        stream = transformAnthropicStream(aiResponse);
      } else {
        stream = transformOpenAIStream(aiResponse);
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
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
