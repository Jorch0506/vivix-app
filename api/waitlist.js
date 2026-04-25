export const config = { runtime: ‘edge’ };

export default async function handler(req) {
if (req.method === ‘OPTIONS’) {
return new Response(null, {
headers: {
‘Access-Control-Allow-Origin’: ‘*’,
‘Access-Control-Allow-Methods’: ‘POST’,
‘Access-Control-Allow-Headers’: ‘Content-Type’,
},
});
}

try {
const body = await req.json();
// Log to Vercel — in production connect to Supabase or Resend
console.log(‘WAITLIST:’, JSON.stringify(body));

```
return new Response(JSON.stringify({ ok: true }), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
});
```

} catch (err) {
return new Response(JSON.stringify({ error: err.message }), {
status: 500,
headers: { ‘Content-Type’: ‘application/json’ },
});
}
}