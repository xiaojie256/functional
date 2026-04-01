// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 校验 Token
    const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token !== env.API_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 根据路径决定获取哪个文件
    let filePath = '';
    if (path === '/homework.json') filePath = 'homework.json';
    else if (path === '/answer.json') filePath = 'Answer.json';
    else if (path.startsWith('/images/')) filePath = path.substring(1); // 去掉前导 /
    else return new Response('Not Found', { status: 404 });

    // 从 Gitee API 获取文件内容
    const owner = env.GITEE_OWNER;
    const repo = env.GITEE_REPO;
    const branch = env.GITEE_BRANCH;
    const accessToken = env.GITEE_ACCESS_TOKEN;
    const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}&access_token=${accessToken}`;

    const resp = await fetch(apiUrl);
    if (!resp.ok) {
      return new Response(`Gitee API error: ${resp.status}`, { status: resp.status });
    }

    const data = await resp.json();
    if (!data.content) {
      return new Response('File content missing', { status: 500 });
    }

    // 解码 base64
    const binary = atob(data.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // 判断是否为图片
    const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filePath);
    if (isImage) {
      const ext = filePath.split('.').pop().toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
      return new Response(bytes, {
        headers: { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' }
      });
    } else {
      const text = new TextDecoder('utf-8').decode(bytes);
      return new Response(text, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};