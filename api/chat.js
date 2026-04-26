const https = require(‘https’);

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();

try {
const { message } = req.body;
const apiKey = process.env.ANTHROPIC_API_KEY;

```
if (!apiKey) {
  return res.status(500).json({ error: 'API key not configured', text: 'API key missing' });
}

const body = JSON.stringify({
  model: 'claude-opus-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: message }]
});

const data = await new Promise((resolve, reject) => {
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const request = https.request(options, (response) => {
    let rawData = '';
    response.on('data', chunk => rawData += chunk);
    response.on('end', () => {
      try {
        resolve(JSON.parse(rawData));
      } catch(e) {
        reject(new Error('Parse error: ' + rawData));
      }
    });
  });

  request.on('error', reject);
  request.write(body);
  request.end();
});

// Return full response for debugging
if (data.error) {
  return res.status(200).json({ text: 'API Error: ' + JSON.stringify(data.error) });
}

const text = data.content?.[0]?.text || 'Empty: ' + JSON.stringify(data);
return res.status(200).json({ text });
```

} catch(err) {
return res.status(200).json({ text: ’Catch error: ’ + err.message });
}
};