// 配置管理接口 - GET/POST /api/config

// 默认配置
const DEFAULT_CONFIG = {
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  api_key: ''
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  // 处理 OPTIONS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // GET 请求：获取配置
  if (method === 'GET') {
    try {
      const storedConfig = await env.AI_CHAT_CONFIG.get('user_config');
      const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

      return new Response(JSON.stringify(config), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '获取配置失败: ' + error.message }),
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

  // POST 请求：保存配置
  if (method === 'POST') {
    try {
      const data = await request.json();

      // 获取当前配置
      const storedConfig = await env.AI_CHAT_CONFIG.get('user_config');
      const currentConfig = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

      // 合并新配置
      const newConfig = {
        endpoint: data.endpoint || currentConfig.endpoint,
        model: data.model || currentConfig.model,
        api_key: data.api_key !== undefined ? data.api_key : currentConfig.api_key,
      };

      // 写入 KV
      await env.AI_CHAT_CONFIG.put('user_config', JSON.stringify(newConfig));

      return new Response(
        JSON.stringify({ status: 'success', config: newConfig }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '保存配置失败: ' + error.message }),
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

  // 其他请求方法返回 405
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
