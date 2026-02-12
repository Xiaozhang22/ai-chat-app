// 配置管理接口 - GET/POST /api/config
// 模型列表接口 - GET /api/config/models?endpoint=gemini|anyrouter

// 默认配置
const DEFAULT_CONFIG = {
  endpoint: 'https://api.openai.com/v1',
  endpoint_type: 'openai',
  selected_endpoint: '',
  model: 'gpt-3.5-turbo',
  selected_api_key: ''
};

// 端点预设映射
const ENDPOINT_PRESETS = {
  gemini: {
    url: 'https://gemini.zx1993.top/v1',
    type: 'openai',
    modelsKey: 'models:gemini',
  },
  anyrouter: {
    url: 'https://a-ocnfniawgw.cn-shanghai.fcapp.run',
    type: 'anthropic',
    modelsKey: 'models:anyrouter',
  }
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

  // GET /api/config — 获取配置
  if (method === 'GET') {
    try {
      const storedConfig = await env.AI_CHAT_KEYS.get('user_config');
      const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

      return new Response(JSON.stringify({
        endpoint: config.endpoint,
        endpoint_type: config.endpoint_type || 'openai',
        selected_endpoint: config.selected_endpoint || '',
        model: config.model,
        selected_api_key: config.selected_api_key || '',
        api_key_set: !!config.selected_api_key
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '获取配置失败: ' + error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }
  }

  // POST /api/config — 保存配置
  if (method === 'POST') {
    try {
      const data = await request.json();
      const storedConfig = await env.AI_CHAT_KEYS.get('user_config');
      const currentConfig = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

      // 处理端点选择
      let endpoint = currentConfig.endpoint;
      let endpointType = currentConfig.endpoint_type || 'openai';
      let selectedEndpoint = currentConfig.selected_endpoint || '';

      if (data.selected_endpoint) {
        selectedEndpoint = data.selected_endpoint;
        const preset = ENDPOINT_PRESETS[selectedEndpoint];
        if (preset) {
          endpoint = preset.url;
          endpointType = preset.type;
        } else if (selectedEndpoint === 'custom') {
          endpoint = data.endpoint || currentConfig.endpoint;
          endpointType = 'openai'; // 自定义端点默认 OpenAI 格式
        }
      }

      // 处理API密钥
      let selectedKey = currentConfig.selected_api_key;
      if (data.selected_api_key && data.selected_api_key >= '1' && data.selected_api_key <= '5') {
        selectedKey = data.selected_api_key;
      } else if (data.new_api_key && data.new_api_key.trim() !== '') {
        const newKey = data.new_api_key.trim();
        let targetSlot = '1';
        for (let i = 1; i <= 5; i++) {
          const existingKey = await env.AI_CHAT_KEYS.get(`api_key_${i}`);
          if (!existingKey) {
            targetSlot = i.toString();
            break;
          }
        }
        await env.AI_CHAT_KEYS.put(`api_key_${targetSlot}`, newKey);
        selectedKey = targetSlot;
      }

      // 合并新配置
      const newConfig = {
        endpoint: endpoint,
        endpoint_type: endpointType,
        selected_endpoint: selectedEndpoint,
        model: data.model || currentConfig.model,
        selected_api_key: selectedKey,
      };

      await env.AI_CHAT_KEYS.put('user_config', JSON.stringify(newConfig));

      return new Response(
        JSON.stringify({
          status: 'success',
          config: {
            endpoint: newConfig.endpoint,
            endpoint_type: newConfig.endpoint_type,
            selected_endpoint: newConfig.selected_endpoint,
            model: newConfig.model,
            selected_api_key: newConfig.selected_api_key,
            api_key_set: !!newConfig.selected_api_key
          }
        }),
        {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '保存配置失败: ' + error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: '不支持的请求方法' }),
    {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    }
  );
}
