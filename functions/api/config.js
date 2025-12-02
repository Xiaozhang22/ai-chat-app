// 配置管理接口 - GET/POST /api/config

// 默认配置
const DEFAULT_CONFIG = {
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  selected_api_key: ''  // 当前选择的API密钥编号�?-5�?
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

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

  // GET /api/config/keys - 获取API密钥状�?
  if (method === 'GET' && url.pathname === '/api/config/keys') {
    try {
      const keysStatus = {};
      for (let i = 1; i <= 5; i++) {
        const key = await env.AI_CHAT_KEYS.get(`api_key_${i}`);
        keysStatus[`key${i}`] = !!key;
      }

      return new Response(JSON.stringify({
        keys_status: keysStatus
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '获取密钥状态失�? ' + error.message }),
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

  // GET 请求：获取配�?
  if (method === 'GET') {
    try {
      const storedConfig = await env.AI_CHAT_KEYS.get('user_config');
      const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

      // 🔒 安全加固：不返回真实�?API Key
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

  // POST 请求：保存配�?
  if (method === 'POST') {
    try {
      const data = await request.json();

      // 获取当前配置
      const storedConfig = await env.AI_CHAT_KEYS.get('user_config');
      const currentConfig = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

      // 处理API密钥
      let selectedKey = currentConfig.selected_api_key;

      // 如果选择了预设的密钥�?-5�?
      if (data.selected_api_key && data.selected_api_key >= '1' && data.selected_api_key <= '5') {
        selectedKey = data.selected_api_key;
      }
      // 如果提供了新的API密钥，保存到下一个可用位置或更新现有位置
      else if (data.new_api_key && data.new_api_key.trim() !== '') {
        const newKey = data.new_api_key.trim();
        
        // 找到第一个空位置，如果都满了则使用位�?
        let targetSlot = '1';
        for (let i = 1; i <= 5; i++) {
          const existingKey = await env.AI_CHAT_KEYS.get(`api_key_${i}`);
          if (!existingKey) {
            targetSlot = i.toString();
            break;
          }
        }
        
        // 保存新密�?
        await env.AI_CHAT_KEYS.put(`api_key_${targetSlot}`, newKey);
        selectedKey = targetSlot;
      }

      // 合并新配�?
      const newConfig = {
        endpoint: data.endpoint || currentConfig.endpoint,
        model: data.model || currentConfig.model,
        selected_api_key: selectedKey,
      };

      // 写入 KV
      await env.AI_CHAT_KEYS.put('user_config', JSON.stringify(newConfig));

      // 🔒 返回时不包含真实�?API Key
      return new Response(
        JSON.stringify({
          status: 'success',
          config: {
            endpoint: newConfig.endpoint,
            model: newConfig.model,
            selected_api_key: newConfig.selected_api_key,
            api_key_set: !!newConfig.selected_api_key
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
