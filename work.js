export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // 统一 CORS 头（所有响应都需要）
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // 1. 处理 OPTIONS 预检请求（必须最先处理，不校验 token）
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2. 只允许 GET 请求
    if (method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // 3. 校验 Token
    const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token !== env.API_TOKEN) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const path = url.pathname;

    // 路由：映射到 Gitee 仓库文件路径
    let filePath = '';
    if (path === '/homework.json') {
      filePath = 'homework.json';
    } else if (path === '/answer.json') {
      filePath = 'Answer.json';
    } else if (path.startsWith('/images/')) {
      filePath = path.substring(1); // 例如 images/xxx.png
    } else {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    // 从 Gitee 获取文件
    const owner = env.GITEE_OWNER;
    const repo = env.GITEE_REPO;
    const branch = env.GITEE_BRANCH;
    const accessToken = env.GITEE_ACCESS_TOKEN;
    const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}&access_token=${accessToken}`;

    const resp = await fetch(apiUrl);
    if (!resp.ok) {
      return new Response(`Gitee API error: ${resp.status}`, { status: resp.status, headers: corsHeaders });
    }

    const data = await resp.json();
    if (!data.content) {
      return new Response('File content missing', { status: 500, headers: corsHeaders });
    }

    // 解码 base64
    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filePath);
    if (isImage) {
      const ext = filePath.split('.').pop().toLowerCase();
      const mimeTypes = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml'
      };
      const mime = mimeTypes[ext] || 'application/octet-stream';
      return new Response(bytes, {
        headers: {
          'Content-Type': mime,
          ...corsHeaders,
        }
      });
    } else {
      const text = new TextDecoder('utf-8').decode(bytes);
      return new Response(text, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders,
        }
      });
    }
  }
};