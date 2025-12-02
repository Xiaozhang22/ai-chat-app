// API密钥管理接口 - DELETE /api/keys/:id

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  // 处理 OPTIONS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // 解析密钥ID（1-5）
  const pathParts = url.pathname.split('/');
  const keyId = pathParts[pathParts.length - 1];

  if (!keyId || keyId < '1' || keyId > '5') {
    return new Response(
      JSON.stringify({ error: '无效的密钥ID，必须是1-5之间' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // DELETE 请求：删除指定的API密钥
  if (method === 'DELETE') {
    try {
      await env.AI_CHAT_KEYS.delete(`api_key_${keyId}`);

      // 如果当前配置使用的是这个密钥，清除选择
      const storedConfig = await env.AI_CHAT_KEYS.get('user_config');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        if (config.selected_api_key === keyId) {
          config.selected_api_key = '';
          await env.AI_CHAT_KEYS.put('user_config', JSON.stringify(config));
        }
      }

      return new Response(
        JSON.stringify({ status: 'success', message: `API密钥 ${keyId} 已删除` }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '删除密钥失败: ' + error.message }),
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
