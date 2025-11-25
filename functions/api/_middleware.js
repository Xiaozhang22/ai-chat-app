// 认证中间件 - 验证所有 /api/* 请求的 token（除了 /api/login）

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // /api/login 不需要认证
  if (url.pathname === '/api/login') {
    return next();
  }

  // 处理 OPTIONS 预检请求（CORS）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // 从 Authorization header 提取 token
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

  // 验证 token 是否存在于 KV
  try {
    const session = await env.AI_CHAT_CONFIG.get(`sessions:${token}`);
    if (!session) {
      return new Response(
        JSON.stringify({ error: '登录已过期，请重新登录' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 检查 token 是否过期
    const sessionData = JSON.parse(session);
    if (new Date(sessionData.expires_at) < new Date()) {
      // 删除过期的 session
      await env.AI_CHAT_CONFIG.delete(`sessions:${token}`);
      return new Response(
        JSON.stringify({ error: '登录已过期，请重新登录' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 验证通过，继续处理请求
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
