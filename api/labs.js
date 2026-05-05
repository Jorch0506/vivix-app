const https = require(‘https’);

module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const { pdf, system } = req.body;
if (!pdf) return res.status(400).json({ error: ‘No PDF data provided’ });

const payload = JSON.stringify({
model: ‘claude-sonnet-4-5-20251015’,
max_tokens: 4000,
system: system || ‘You are a medical lab interpreter. Respond only with valid JSON.’,
messages: [
{
role: ‘user’,
content: [
{
type: ‘document’,
source: {
type: ‘base64’,
media_type: ‘application/pdf’,
data: pdf
}
},
{
type: ‘text’,
text: ‘Analiza estos resultados de laboratorio y responde ÚNICAMENTE con el JSON estructurado solicitado, sin texto adicional, sin markdown, sin backticks.’
}
]
}
]
});

const options = {
hostname: ‘api.anthropic.com’,
path: ‘/v1/messages’,
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: process.env.ANTHROPIC_API_KEY,
‘anthropic-version’: ‘2023-06-01’,
‘Content-Length’: Buffer.byteLength(payload)
}
};

return new Promise((resolve) => {
const apiReq = https.request(options, (apiRes) => {
let data = ‘’;
apiRes.on(‘data’, chunk => data += chunk);
apiRes.on(‘end’, () => {
try {
const parsed = JSON.parse(data);
if (parsed.error) {
res.status(500).json({ error: parsed.error.message });
return resolve();
}
const text = parsed.content?.[0]?.text || ‘’;
res.status(200).json({ text });
} catch (e) {
res.status(500).json({ error: ‘Parse error’ });
}
resolve();
});
});

```
apiReq.on('error', (e) => {
  res.status(500).json({ error: e.message });
  resolve();
});

apiReq.write(payload);
apiReq.end();
```

});
};