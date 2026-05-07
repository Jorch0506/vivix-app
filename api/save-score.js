const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { age, sex, country, bmi, water, sleep, activity, smoking, score, life_expectancy, lang } = req.body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // Debug — remove after confirming it works
    console.log('VIVIX URL:', supabaseUrl ? supabaseUrl.substring(0, 40) : 'MISSING');
    console.log('VIVIX KEY prefix:', supabaseKey ? supabaseKey.substring(0, 30) : 'MISSING');

    if (!supabaseUrl || !supabaseKey) {
      console.error('VIVIX: env vars missing');
      return res.status(200).json({ ok: false, error: 'not configured' });
    }

    const payload = JSON.stringify({
      age: age ? parseInt(age) : null,
      sex: sex || null,
      country: country || null,
      bmi: bmi ? parseFloat(bmi) : null,
      water: water ? parseFloat(water) : null,
      sleep: sleep ? parseFloat(sleep) : null,
      activity: activity || null,
      smoking: smoking || null,
      score: score ? parseInt(score) : null,
      life_expectancy: life_expectancy ? parseInt(life_expectancy) : null,
      lang: lang || null
    });

    const hostname = supabaseUrl
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');

    const result = await new Promise(function(resolve, reject) {
      const opts = {
        hostname: hostname,
        path: '/rest/v1/vital_scores',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Prefer': 'return=minimal',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const r = https.request(opts, function(resp) {
        let d = '';
        resp.on('data', function(c) { d += c; });
        resp.on('end', function() {
          resolve({ status: resp.statusCode, body: d });
        });
      });

      r.on('error', function(e) { reject(e); });
      r.write(payload);
      r.end();
    });

    console.log('VIVIX Supabase response:', result.status, result.body || '(empty=success)');

    if (result.status === 201) {
      return res.status(200).json({ ok: true });
    } else {
      return res.status(200).json({ ok: false, status: result.status, body: result.body });
    }

  } catch(err) {
    console.error('VIVIX save-score exception:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
