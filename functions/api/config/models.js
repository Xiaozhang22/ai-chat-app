// 模型列表接口 - GET /api/config/models?endpoint=gemini|anyrouter

const ENDPOINT_PRESETS = {
  gemini: { modelsKey: 'models:gemini' },
  anyrouter: { modelsKey: 'models:anyrouter' },
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: '不支持的请求方法' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const endpointId = url.searchParams.get('endpoint');
    const preset = ENDPOINT_PRESETS[endpointId];

    if (!preset) {
      return new Response(JSON.stringify({ models: [], message: '无预设模型' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const modelsJson = await env.AI_CHAT_KEYS.get(preset.modelsKey);
    const models = modelsJson ? JSON.parse(modelsJson) : [];

    return new Response(JSON.stringify({ models }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: '获取模型列表失败: ' + error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
