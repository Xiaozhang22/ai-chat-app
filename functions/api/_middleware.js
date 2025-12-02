// 认证中间�?- 验证所�?/api/* 请求�?token（除�?/api/login�?

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // /api/login 不需要认�?
  if (url.pathname === '/api/login') {
    return next();
  }

  // 处理 OPTIONS 预检请求（CORS�?
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // �?Authorization header 提取 token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: '未授权，请先登录' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const token = authHeader.substring(7); // 去掉 "Bearer " 前缀

  // 验证 token 是否存在�?KV
  try {
    const session = await env.AI_CHAT_KEYS.get(`sessions:${token}`);
    if (!session) {
      return new Response(
        JSON.stringify({ error: '登录已过期，请重新登�? }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 检�?token 是否过期
    const sessionData = JSON.parse(session);
    if (new Date(sessionData.expires_at) < new Date()) {
      // 删除过期�?session
      await env.AI_CHAT_KEYS.delete(`sessions:${token}`);
      return new Response(
        JSON.stringify({ error: '登录已过期，请重新登�? }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 验证通过，继续处理请�?
    return next();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: '认证失败: ' + error.message }),
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
