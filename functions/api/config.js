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

// 端点→API Key 映射
const ENDPOINT_KEY_MAP = {
  anyrouter: ['1'],
  gemini: ['2', '3', '4', '5'],
  cpa: ['6'],
};

// 端点预设映射
const ENDPOINT_PRESETS = {
  gemini: {
    url: 'https://gemini.zx1993.top/v1',
    type: 'openai',
    modelsKey: 'models:gemini',
  },
  anyrouter: {
    url: 'http://anyrouter.zx1993.top:2083',
    type: 'anthropic',
    modelsKey: 'models:anyrouter',
  },
  cpa: {
    url: 'http://cpa.zx1993.top:8317/v1',
    type: 'openai',
    modelsKey: 'models:cpa',
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

      const selectedEp = config.selected_endpoint || '';
      const allowedKeys = ENDPOINT_KEY_MAP[selectedEp] || [];

      return new Response(JSON.stringify({
        endpoint: config.endpoint,
        endpoint_type: config.endpoint_type || 'openai',
        selected_endpoint: selectedEp,
        model: config.model,
        selected_api_key: config.selected_api_key || '',
        api_key_set: !!config.selected_api_key,
        allowed_keys: allowedKeys,
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
      const allowedKeys = ENDPOINT_KEY_MAP[selectedEndpoint] || [];

      if (data.selected_api_key && data.selected_api_key >= '1' && data.selected_api_key <= '6') {
        if (allowedKeys.length > 0 && !allowedKeys.includes(data.selected_api_key)) {
          selectedKey = allowedKeys[0];
        } else {
          selectedKey = data.selected_api_key;
        }
      } else if (data.new_api_key && data.new_api_key.trim() !== '') {
        const newKey = data.new_api_key.trim();
        let targetSlot = '1';
        for (let i = 1; i <= 6; i++) {
          const existingKey = await env.AI_CHAT_KEYS.get(`api_key_${i}`);
          if (!existingKey) {
            targetSlot = i.toString();
            break;
          }
        }
        await env.AI_CHAT_KEYS.put(`api_key_${targetSlot}`, newKey);
        selectedKey = targetSlot;
      }

      // 如果当前 key 不在允许范围内，自动选第一个允许的 key
      if (allowedKeys.length > 0 && !allowedKeys.includes(selectedKey)) {
        selectedKey = allowedKeys[0];
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
