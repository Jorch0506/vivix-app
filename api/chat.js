export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) {
return res.status(200).end();
}

if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const { message } = req.body;

if (!message) {
return res.status(400).json({ error: ‘No message provided’ });
}

try {
const response = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: process.env.ANTHROPIC_API_KEY,
‘anthropic-version’: ‘2023-06-01’,
},
body: JSON.stringify({
model: ‘claude-sonnet-4-20250514’,
max_tokens: 1024,
stream: true,
messages: [{ role: ‘user’, content: message }],
}),
});

```
if (!response.ok) {
  const error = await response.text();
  return res.status(500).json({ error });
}

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  res.write(chunk);
}

res.end();
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
}