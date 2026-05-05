const https = require(‘https’);

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();

try {
const { pdf, lang } = req.body;
if (!pdf) return res.status(200).json({ text: ‘Error: No PDF received’ });

```
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) return res.status(200).json({ text: 'Error: No API key' });

const langMap = {
  es: 'Responde en español.',
  en: 'Respond in English.',
  pt: 'Responda em português.',
  fr: 'Répondez en français.',
  hi: 'हिंदी में जवाब दें।',
  zh: '请用中文回答。'
};
const langInstruction = langMap[lang] || langMap['es'];

const systemPrompt = `You are VIVIX lab interpreter. Analyze clinical lab results clearly for non-medical users. ${langInstruction} Respond ONLY with this exact JSON, no extra text: {"resumen":"summary","vital_insight":"1 action","categorias":[{"nombre":"category","parametros":[{"nombre":"name","valor":"value+unit","referencia":"normal range","estado":"Óptimo|Aceptable|Atención|Crítico","nota":"plain explanation"}]}],"alerta_medica":null}`;

const payload = JSON.stringify({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 2000,
  system: systemPrompt,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdf }
      },
      {
        type: 'text',
        text: 'Analyze these lab results and respond with JSON only.'
      }
    ]
  }]
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
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const request = https.request(options, (response) => {
    let raw = '';
    response.on('data', chunk => raw += chunk);
    response.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch(e) { reject(new Error('Parse failed: ' + raw.slice(0, 100))); }
    });
  });

  request.on('error', reject);
  request.write(payload);
  request.end();
});

if (data.error) return res.status(200).json({ text: 'API Error: ' + data.error.message });

const text = data.content?.[0]?.text || JSON.stringify(data);
return res.status(200).json({ text });
```

} catch(err) {
return res.status(200).json({ text: ’Error: ’ + err.message });
}
};

module.exports.config = {
api: { bodyParser: { sizeLimit: ‘10mb’ } }
};