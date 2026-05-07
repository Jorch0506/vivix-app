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

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ ok: false, error: 'Supabase not configured' });
    }

    const payload = JSON.stringify({
      age: age || null,
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

    const urlObj = new URL(supabaseUrl);

    const data = await new Promise(function(resolve, reject) {
      const opts = {
        hostname: urlObj.hostname,
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
        resp.on('end', function() { resolve({ status: resp.statusCode, body: d }); });
      });
      r.on('error', reject);
      r.write(payload);
      r.end();
    });

    if (data.status === 201 || data.status === 200) {
      return res.status(200).json({ ok: true });
    } else {
      return res.status(200).json({ ok: false, error: data.body });
    }

  } catch(err) {
    // Silent fail — never break the user experience
    return res.status(200).json({ ok: false, error: err.message });
  }
};
