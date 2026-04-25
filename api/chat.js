export const config = { runtime: ‘edge’ };

export default async function handler(req) {
if (req.method === ‘OPTIONS’) {
return new Response(null, {
headers: {
‘Access-Control-Allow-Origin’: ‘*’,
‘Access-Control-Allow-Methods’: ‘POST’,
‘Access-Control-Allow-Headers’: ‘Content-Type’,
},
});
}

try {
const { message } = await req.json();

```
const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    messages: [{ role: 'user', content: message }],
  }),
});

return new Response(response.body, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  },
});
```

} catch (err) {
return new Response(JSON.stringify({ error: err.message }), {
status: 500,
headers: { ‘Content-Type’: ‘application/json’ },
});
}
}