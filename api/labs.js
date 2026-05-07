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

    const sys = 'You are a clinical lab interpreter. You MUST respond with ONLY a JSON object. No markdown. No backticks. No explanation. Start with { end with }.\n\nJSON structure:\n{"resumen":"2-3 sentence summary in ' + langName + '","vital_insight":"top action in ' + langName + '","plan_accion":[{"titulo":"title","descripcion":"detail","plazo":"when"}],"categorias":[{"nombre":"category in ' + langName + '","parametros":[{"nombre":"test","valor":"result","referencia":"range","estado":"Óptimo|Aceptable|Atención|Crítico","nota":"brief explanation in ' + langName + '"}]}],"alerta_medica":null}\n\nRules:\n- estado: exactly Óptimo, Aceptable, Atención, or Crítico\n- Include ALL parameters from the document\n- Pediatric patients need age-appropriate reference ranges\n- Keep nota fields SHORT (max 15 words each) to avoid token overflow\n- plan_accion: 3-4 steps maximum\n- alerta_medica: null or short string\n- Write all text in ' + langName;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: sys,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
          { type: 'text', text: 'Analyze this lab report. JSON only — start with { end with }. Keep notes brief.' }
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
          catch(e) { reject(new Error('Anthropic parse failed: ' + d.slice(0, 200))); }
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
      return res.status(200).json({ text: JSON.stringify(fallback('Respuesta inesperada')) });
    }

    // Check if response was truncated (stop_reason = max_tokens)
    const wasTruncated = apiResponse.stop_reason === 'max_tokens';

    // Stage 1: strip markdown fences
    let cleaned = raw.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim();

    // Stage 2: find outermost { ... }
    const start = cleaned.indexOf('{');
    let end = cleaned.lastIndexOf('}');

    if (start === -1) {
      return res.status(200).json({ text: JSON.stringify(fallback('No JSON en respuesta')) });
    }

    // If truncated, try to find last complete } before truncation
    if (wasTruncated || end === -1) {
      // Try to close the JSON by finding last complete object
      end = cleaned.lastIndexOf('}');
      if (end === -1) {
        return res.status(200).json({ text: JSON.stringify(fallback('Documento muy extenso. Intenta con un PDF más corto.')) });
      }
    }

    cleaned = cleaned.slice(start, end + 1);

    // Stage 3: parse with sanitization
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch(e1) {
      // Try sanitizing control characters
      try {
        const sanitized = cleaned.replace(/[\u0000-\u001F\u007F]/g, function(c) {
          if (c === '\n') return '\\n';
          if (c === '\r') return '\\r';
          if (c === '\t') return '\\t';
          return '';
        });
        parsed = JSON.parse(sanitized);
      } catch(e2) {
        // Last resort: try to extract partial valid data
        try {
          // Extract resumen at minimum
          const resMatch = cleaned.match(/"resumen"\s*:\s*"([^"]+)"/);
          const insightMatch = cleaned.match(/"vital_insight"\s*:\s*"([^"]+)"/);
          parsed = {
            resumen: resMatch ? resMatch[1] : 'Análisis parcialmente completado.',
            vital_insight: insightMatch ? insightMatch[1] : 'Consulta con tu médico.',
            plan_accion: [],
            categorias: [],
            alerta_medica: null,
            _partial: true
          };
        } catch(e3) {
          return res.status(200).json({ text: JSON.stringify(fallback('Error de procesamiento. Intenta nuevamente.')) });
        }
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
    vital_insight: 'Por favor intenta nuevamente.',
    plan_accion: [],
    categorias: [],
    alerta_medica: null
  };
}

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
