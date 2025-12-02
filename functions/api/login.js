// 登录接口 - POST /api/login

// 预设用户凭证
const USERS = {
  root: 'password'
};

export async function onRequest(context) {
  const { request, env } = context;

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 只允�?POST 请求
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
    const data = await request.json();
    const { username, password } = data;

    // 验证用户名和密码
    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: '请输入账号和密码' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 检查凭证是否正�?
    if (USERS[username] !== password) {
      return new Response(
        JSON.stringify({ error: '账号或密码错�? }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 生成 token
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后过�?

    // 存储 session �?KV
    const sessionData = {
      username: username,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    await env.AI_CHAT_KEYS.put(
      `sessions:${token}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 } // 24小时后自动删�?
    );

    return new Response(
      JSON.stringify({
        status: 'success',
        token: token,
        expires_at: expiresAt.toISOString(),
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
      JSON.stringify({ error: '登录失败: ' + error.message }),
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
