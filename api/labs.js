const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { pdf, lang } = req.body;
    if (!pdf) return res.status(200).json({ text: 'Error: No PDF' });

    const apiKey = process.env.ANTHROPIC_API_KEY;

    const langMap = {
      es: 'español',
      en: 'English',
      pt: 'português',
      fr: 'français',
      hi: 'Hindi',
      zh: '中文'
    };
    const langName = langMap[lang] || 'español';

    // Strict system prompt — JSON only, no markdown, no preamble
    const sys = [
      'You are VIVIX, an expert clinical lab interpreter.',
      'OUTPUT RULES — CRITICAL:',
      '1. Your ENTIRE response must be a single valid JSON object. Nothing before it. Nothing after it.',
      '2. Do NOT use markdown fences (no ```json, no ```).',
      '3. Do NOT add any explanation, greeting, or text outside the JSON.',
      '4. All text content inside the JSON must be written in ' + langName + '.',
      '',
      'JSON SCHEMA (follow exactly):',
      '{',
      '  "resumen": "2-3 sentence executive summary of findings in ' + langName + '",',
      '  "vital_insight": "single most important action for this patient in ' + langName + '",',
      '  "plan_accion": [',
      '    {"titulo": "step title", "descripcion": "specific action", "plazo": "timeframe"}',
      '  ],',
      '  "categorias": [',
      '    {',
      '      "nombre": "category name in ' + langName + '",',
      '      "parametros": [',
      '        {',
      '          "nombre": "test name",',
      '          "valor": "result + unit",',
      '          "referencia": "normal range",',
      '          "estado": "Óptimo|Aceptable|Atención|Crítico",',
      '          "nota": "plain language explanation in ' + langName + '"',
      '        }',
      '      ]',
      '    }',
      '  ],',
      '  "alerta_medica": null',
      '}',
      '',
      'ESTADO values: use exactly "Óptimo" (in range), "Aceptable" (borderline), "Atención" (out of range, not dangerous), "Crítico" (requires prompt medical attention).',
      'plan_accion: include 4-5 specific, actionable steps based on the actual patient results.',
      'alerta_medica: null if no urgent findings, or a short alert string if critical values are present.',
      'Include ALL parameters found in the document, grouped by category.',
      'Consider patient age and sex when interpreting reference ranges — pediatric patients have different normal values than adults.'
    ].join('\n');

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: sys,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdf
            }
          },
          {
            type: 'text',
            text: 'Analyze all pages of this clinical lab report. Respond with the JSON object only — no markdown, no extra text.'
          }
        ]
      }]
    });

    const data = await new Promise(function(resolve, reject) {
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
          catch(e) { reject(new Error(d.slice(0, 300))); }
        });
      });

      r.on('error', reject);
      r.write(requestBody);
      r.end();
    });

    if (data.error) {
      return res.status(200).json({ text: 'API Error: ' + data.error.message });
    }

    // ── AGGRESSIVE JSON CLEANING ─────────────────────────────────────────
    // Even with strict instructions, models sometimes wrap in ```json fences.
    // We clean at the backend so the frontend always receives pure JSON.
    let raw = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';

    // Step 1: strip markdown fences
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    // Step 2: extract first complete JSON object (handles preamble text)
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }

    // Step 3: validate it's parseable — if not, return structured error
    try {
      JSON.parse(raw);
    } catch(parseErr) {
      // Return a safe fallback JSON that the frontend can render
      const fallback = {
        resumen: 'El análisis no pudo completarse correctamente. Por favor intenta de nuevo o sube un PDF con mejor resolución.',
        vital_insight: 'Consulta directamente con tu médico para interpretar estos resultados.',
        plan_accion: [],
        categorias: [],
        alerta_medica: null
      };
      return res.status(200).json({ text: JSON.stringify(fallback) });
    }

    return res.status(200).json({ text: raw });

  } catch(err) {
    return res.status(200).json({ text: JSON.stringify({
      resumen: 'Error al procesar: ' + err.message,
      vital_insight: 'Por favor intenta nuevamente.',
      plan_accion: [],
      categorias: [],
      alerta_medica: null
    })});
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
