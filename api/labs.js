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
const langs = { es: ‘Responde en español.’, en: ‘Respond in English.’, pt: ‘Responda em português.’, fr: ‘Répondez en français.’, hi: ‘Responde en hindi.’, zh: ‘请用中文回答。’ };
const sys = ‘Eres interprete de laboratorios de VIVIX. ’ + (langs[lang] || langs.es) + ’ Responde SOLO con JSON valido sin texto extra: {“resumen”:“texto resumido”,“vital_insight”:“1 accion concreta hoy”,“plan_accion”:[{“titulo”:“titulo corto”,“descripcion”:“que hacer exactamente”,“plazo”:“cuando hacerlo”}],“categorias”:[{“nombre”:“categoria”,“parametros”:[{“nombre”:“nombre”,“valor”:“valor+unidad”,“referencia”:“rango normal”,“estado”:“Optimo|Aceptable|Atencion|Critico”,“nota”:“explicacion simple”}]}],“alerta_medica”:null}. El plan_accion debe tener 4-5 pasos especificos basados en los resultados reales del paciente, con consejos de alimentacion, habitos y seguimiento medico personalizados.’;
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