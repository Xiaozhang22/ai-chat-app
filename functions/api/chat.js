// AI 对话接口 - POST /api/chat

// 默认配置
const DEFAULT_CONFIG = {
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  selected_api_key: ''
};

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

    // 转发请求到 AI API
    const aiResponse = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: userMessage }],
        stream: false,
      }),
    });

    // 处理 AI 响应
    if (aiResponse.ok) {
      const result = await aiResponse.json();
      const assistantMessage = result.choices[0].message.content;

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
