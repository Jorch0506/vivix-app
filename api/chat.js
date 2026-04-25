export const config = { runtime: ‘edge’ };

export default async function handler(req) {
if (req.method === ‘OPTIONS’) {
return new Response(null, {
status: 200,
headers: {
‘Access-Control-Allow-Origin’: ‘*’,
‘Access-Control-Allow-Methods’: ‘POST, OPTIONS’,
‘Access-Control-Allow-Headers’: ‘Content-Type’,
},
});
}

if (req.method !== ‘POST’) {
return new Response(‘Method not allowed’, { status: 405 });
}

try {
const { message } = await req.json();

```
if (!message) {
  return new Response('No message provided', { status: 400 });
}

const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    stream: true,
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  }),
});

if (!anthropicResponse.ok) {
  const error = await anthropicResponse.text();
  return new Response(`Anthropic error: ${error}`, { status: 500 });
}

return new Response(anthropicResponse.body, {
  status: 200,
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  },
});
```

} catch (err) {
return new Response(`Error: ${err.message}`, { status: 500 });
}
}