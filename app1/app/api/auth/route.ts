import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

function getClient() {
  const url = process.env.SUPABASE_URL as string;
  const anon = process.env.SUPABASE_ANON_KEY as string;
  if (!url || !anon) throw new Error('Supabase env not configured');
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({}));
  const action = String(body.action || '');

  if (action === 'signin') {
    const { email, password } = body;
    const supa = getClient();
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error || !data?.session) return new Response(JSON.stringify({ error: error?.message || '登录失败' }), { status: 400 });

    const t = data.session.access_token;
    const ck = cookies();
    ck.set('sb-token', t, { path: '/', httpOnly: true, sameSite: 'lax', secure: true });
    ck.set('sb-access-token', t, { path: '/', httpOnly: true, sameSite: 'lax', secure: true });

    return Response.json({ user: data.user, session: data.session });
  }

  if (action === 'signup') {
    const { email, password } = body;
    const supa = getClient();
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    return Response.json({ user: data.user });
  }

  if (action === 'signout') {
    const ck = cookies();
    ck.set('sb-token', '', { path: '/', httpOnly: true, expires: new Date(0) });
    ck.set('sb-access-token', '', { path: '/', httpOnly: true, expires: new Date(0) });
    return Response.json({ ok: true });
  }

  return new Response(JSON.stringify({ error: 'unsupported action' }), { status: 400 });
}
