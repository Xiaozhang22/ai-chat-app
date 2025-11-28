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

      // 🔒 安全加固：不返回真实的 API Key
      return new Response(JSON.stringify({
        endpoint: config.endpoint,
        model: config.model,
        api_key_set: !!config.api_key  // 只返回是否已设置，不返回真实值
      }), {
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

      // 🔒 安全加固：只有传入非空的新 API Key 才更新，否则保留原有值
      let newApiKey = currentConfig.api_key;
      if (data.api_key && data.api_key.trim() !== '') {
        newApiKey = data.api_key.trim();
      }

      // 合并新配置
      const newConfig = {
        endpoint: data.endpoint || currentConfig.endpoint,
        model: data.model || currentConfig.model,
        api_key: newApiKey,
      };

      // 写入 KV
      await env.AI_CHAT_CONFIG.put('user_config', JSON.stringify(newConfig));

      // 🔒 返回时不包含真实的 API Key
      return new Response(
        JSON.stringify({
          status: 'success',
          config: {
            endpoint: newConfig.endpoint,
            model: newConfig.model,
            api_key_set: !!newConfig.api_key
          }
        }),
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
