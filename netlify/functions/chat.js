export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = await req.json();
    const apiKey = Netlify.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers });
    }

    const messages = [];
    if (body.system) {
      messages.push({ role: 'system', content: body.system });
    }
    for (const msg of (body.messages || [])) {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        const imageParts = msg.content.filter(c => c.type === 'image');
        if (imageParts.length > 0) {
          const imgNote = `[用户上传了${imageParts.length}张图片，请根据文字内容作答]`;
          messages.push({ role: msg.role, content: (textParts + '\n' + imgNote).trim() });
        } else {
          messages.push({ role: msg.role, content: textParts });
        }
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const dsBody = {
      model: 'deepseek-chat',
      messages,
      max_tokens: body.max_tokens || 2000,
      temperature: 0.7,
    };

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(dsBody),
    });

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      const converted = {
        content: [{ type: 'text', text: data.choices[0].message.content }]
      };
      return new Response(JSON.stringify(converted), { status: 200, headers });
    }

    return new Response(JSON.stringify(data), { status: response.status, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: '/api/chat' };
