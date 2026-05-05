const https = require(‘https’);
module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();
try {
const { pdf, lang } = req.body;
if (!pdf) return res.status(200).json({ text: ‘Error: No PDF’ });
const apiKey = process.env.ANTHROPIC_API_KEY;
const langs = { es: ‘español’, en: ‘English’, pt: ‘português’, fr: ‘français’, hi: ‘Hindi’, zh: ‘中文’ };
const langName = langs[lang] || langs.es;
const sys = `You are VIVIX lab interpreter. IMPORTANT: You MUST write ALL text fields in ${langName}. Every word of resumen, vital_insight, plan_accion titles/descriptions, parameter names and notes MUST be in ${langName}. Respond ONLY with valid JSON, no extra text: {"resumen":"text in ${langName}","vital_insight":"action in ${langName}","plan_accion":[{"titulo":"title in ${langName}","descripcion":"description in ${langName}","plazo":"timeframe in ${langName}"}],"categorias":[{"nombre":"category in ${langName}","parametros":[{"nombre":"name","valor":"value+unit","referencia":"normal range","estado":"Optimo|Aceptable|Atencion|Critico","nota":"explanation in ${langName}"}]}],"alerta_medica":"null or alert text in ${langName}"}. plan_accion must have 4-5 specific steps based on actual patient results.`;
const body = JSON.stringify({ model: ‘claude-haiku-4-5-20251001’, max_tokens: 2500, system: sys, messages: [{ role: ‘user’, content: [{ type: ‘document’, source: { type: ‘base64’, media_type: ‘application/pdf’, data: pdf } }, { type: ‘text’, text: ‘Analiza y responde solo con JSON.’ }] }] });
const data = await new Promise((resolve, reject) => {
const opts = { hostname: ‘api.anthropic.com’, path: ‘/v1/messages’, method: ‘POST’, headers: { ‘Content-Type’: ‘application/json’, ‘x-api-key’: apiKey, ‘anthropic-version’: ‘2023-06-01’, ‘Content-Length’: Buffer.byteLength(body) } };
const r = https.request(opts, (resp) => { let d = ‘’; resp.on(‘data’, c => d += c); resp.on(‘end’, () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.slice(0,200))); } }); });
r.on(‘error’, reject); r.write(body); r.end();
});
if (data.error) return res.status(200).json({ text: ’API Error: ’ + data.error.message });
return res.status(200).json({ text: data.content?.[0]?.text || ‘’ });
} catch(err) {
return res.status(200).json({ text: ’Error: ’ + err.message });
}
};
module.exports.config = { api: { bodyParser: { sizeLimit: ‘10mb’ } } };