const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { pdf, lang } = req.body;
    if (!pdf) return res.status(200).json({ text: JSON.stringify(fallback('No PDF recibido')) });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const langMap = { es: 'español', en: 'English', pt: 'português', fr: 'français', hi: 'Hindi', zh: '中文' };
    const langName = langMap[lang] || 'español';

    const sys = 'You are a clinical lab interpreter. You MUST respond with ONLY a JSON object. No markdown. No backticks. No explanation. No text before or after the JSON. Start your response with { and end with }.\n\nJSON structure:\n{"resumen":"summary in ' + langName + '","vital_insight":"top action in ' + langName + '","plan_accion":[{"titulo":"title","descripcion":"detail","plazo":"when"}],"categorias":[{"nombre":"category in ' + langName + '","parametros":[{"nombre":"test","valor":"result","referencia":"range","estado":"Óptimo|Aceptable|Atención|Crítico","nota":"explanation in ' + langName + '"}]}],"alerta_medica":null}\n\nRules:\n- estado must be exactly one of: Óptimo, Aceptable, Atención, Crítico\n- Include ALL parameters from the document\n- For pediatric patients, use age-appropriate reference ranges\n- alerta_medica is null or a short string\n- plan_accion has 4-5 steps\n- Write ALL descriptive text in ' + langName;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: sys,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdf }
          },
          {
            type: 'text',
            text: 'Analyze this clinical lab report. Respond with JSON only — start with { end with }.'
          }
        ]
      }]
    });

    const apiResponse = await new Promise(function(resolve, reject) {
      const opts = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };
      const r = https.request(opts, function(resp) {
        let d = '';
        resp.on('data', function(c) { d += c; });
        resp.on('end', function() {
          try { resolve(JSON.parse(d)); }
          catch(e) { reject(new Error('Anthropic parse failed: ' + d.slice(0, 400))); }
        });
      });
      r.on('error', reject);
      r.write(requestBody);
      r.end();
    });

    if (apiResponse.error) {
      return res.status(200).json({ text: JSON.stringify(fallback('API Error: ' + apiResponse.error.message)) });
    }

    let raw = '';
    if (apiResponse.content && apiResponse.content[0] && apiResponse.content[0].text) {
      raw = apiResponse.content[0].text;
    } else {
      return res.status(200).json({ text: JSON.stringify(fallback('Respuesta inesperada del modelo')) });
    }

    // Stage 1: strip markdown fences
    let cleaned = raw
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim();

    // Stage 2: find outermost { ... }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return res.status(200).json({ text: JSON.stringify(fallback('No JSON en respuesta. Fragmento: ' + raw.slice(0, 120))) });
    }
    cleaned = cleaned.slice(start, end + 1);

    // Stage 3: parse — with sanitization fallback
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch(e1) {
      try {
        const sanitized = cleaned.replace(/[\u0000-\u001F\u007F]/g, function(c) {
          if (c === '\n') return '\\n';
          if (c === '\r') return '\\r';
          if (c === '\t') return '\\t';
          return '';
        });
        parsed = JSON.parse(sanitized);
      } catch(e2) {
        return res.status(200).json({ text: JSON.stringify(fallback('Parse error: ' + e2.message + ' | ' + cleaned.slice(0, 150))) });
      }
    }

    // Stage 4: ensure shape
    parsed.resumen = parsed.resumen || '';
    parsed.vital_insight = parsed.vital_insight || '';
    parsed.plan_accion = parsed.plan_accion || [];
    parsed.categorias = parsed.categorias || [];
    if (parsed.alerta_medica === undefined) parsed.alerta_medica = null;

    return res.status(200).json({ text: JSON.stringify(parsed) });

  } catch(err) {
    return res.status(200).json({ text: JSON.stringify(fallback('Error interno: ' + err.message)) });
  }
};

function fallback(msg) {
  return {
    resumen: msg || 'Error al procesar el documento.',
    vital_insight: 'Por favor intenta nuevamente o contacta soporte.',
    plan_accion: [],
    categorias: [],
    alerta_medica: null
  };
}

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
