'use client';

import { useEffect, useRef, useState } from 'react';

type Conv = { id: string; title?: string };
type Msg = { role: 'user'|'assistant'; content: string };

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);

  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string>('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  const scrollBottom = () => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); };

  async function signin() {
    const r = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signin', email, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '登录失败');
    setAuthed(true);
    await loadConvs();
  }
  async function signout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) });
    setAuthed(false);
    setConvs([]); setConvId(''); setMessages([]);
  }

  async function loadConvs() {
    const r = await fetch('/api/conversations', { method: 'GET' });
    const j = await r.json();
    if (r.ok) setConvs(j.conversations || []);
  }
  async function startConv() {
    const r = await fetch('/api/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
    const j = await r.json();
    if (r.ok) {
      setConvId(j.conversationId);
      await loadConvs();
      setMessages([]);
    }
  }
  async function openConv(id: string) {
    const r = await fetch('/api/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'messages', conversationId: id })
    });
    const j = await r.json();
    if (r.ok) {
      setConvId(id);
      setMessages((j.messages || []).map((m: any) => ({ role: m.role, content: m.content })));
      setTimeout(scrollBottom, 0);
    }
  }
  async function deleteConv(id: string) {
    if (!confirm('确定删除？')) return;
    const r = await fetch('/api/conversations', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: id })
    });
    if (r.ok) {
      if (id === convId) { setConvId(''); setMessages([]); }
      await loadConvs();
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (streaming) return;
    if (!convId) await startConv();
    if (!convId && !input && files.length === 0) return;

    const myMsg = input + (files.length ? `\n\n📎 上传文件: ${files.map(f => f.name).join(', ')}` : '');
    setMessages(m => [...m, { role: 'user', content: myMsg }]);
    setInput('');
    setFiles([]);

    const fd = new FormData();
    fd.append('message', myMsg); // 传原文，服务端也会存“用户消息”
    fd.append('conversationId', convId || '');
    for (const f of files) fd.append('files', f);

    setStreaming(true);

    try {
      const resp = await fetch('/api/chat?stream=1', { method: 'POST', body: fd });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${t}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let acc = '';
      setMessages(m => [...m, { role: 'assistant', content: '' }]); // 占位

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n'); buffer = chunks.pop() || '';
        for (const ev of chunks) {
          const lines = ev.split('\n').filter(Boolean);
          let data = '';
          for (const ln of lines) {
            if (ln.startsWith('data:')) data += ln.slice(5).trim();
          }
          if (!data) continue;
          try {
            const obj = JSON.parse(data);
            if (obj?.type === 'text-delta') {
              acc += obj.delta || '';
              setMessages(m => {
                const mm = m.slice();
                mm[mm.length - 1] = { role: 'assistant', content: acc };
                return mm;
              });
              setTimeout(scrollBottom, 0);
            }
          } catch {
            if (data && data !== '[DONE]') {
              acc += data;
              setMessages(m => {
                const mm = m.slice();
                mm[mm.length - 1] = { role: 'assistant', content: acc };
                return mm;
              });
              setTimeout(scrollBottom, 0);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', content: `错误：${err?.message || err}` }]);
    } finally {
      setStreaming(false);
    }
  }

  useEffect(() => { loadConvs().catch(()=>{}); }, []);
  useEffect(() => { scrollBottom(); }, [messages.length]);

  if (!authed) {
    return (
      <div style={{ display:'grid', placeItems:'center', height:'100svh', gap:16 }}>
        <div style={{ width:360, display:'grid', gap:8 }}>
          <h2>登录</h2>
          <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button onClick={signin}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', height:'100svh' }}>
      <aside style={{ borderRight:'1px solid #eee', padding:12, overflow:'auto' }}>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button onClick={startConv}>新建会话</button>
          <button onClick={signout}>退出</button>
        </div>
        <div style={{ display:'grid', gap:6 }}>
          {convs.map(c => (
            <div key={c.id} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 8px', border:'1px solid #eee', borderRadius:6,
              background: c.id===convId ? '#f5f5f5' : 'white', cursor:'pointer'
            }}>
              <span onClick={()=>openConv(c.id)}>{c.title || `会话 ${c.id.slice(0,6)}...`}</span>
              <button onClick={()=>deleteConv(c.id)}>删</button>
            </div>
          ))}
        </div>
      </aside>

      <main style={{ display:'grid', gridTemplateRows:'1fr auto', height:'100%', padding:12 }}>
        <div ref={logRef} style={{ overflow:'auto', border:'1px solid #eee', borderRadius:8, padding:12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ margin:'10px 0' }}>
              <div style={{ fontSize:12, color:'#888' }}>{m.role === 'user' ? 'You' : 'Dean'}</div>
              <div style={{ whiteSpace:'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} style={{ display:'grid', gap:8, marginTop:12 }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={3} placeholder="说点什么..." />
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="file" multiple onChange={e=>{
              const arr = Array.from(e.target.files || []);
              setFiles(arr);
            }} />
            <button type="submit" disabled={streaming}>发送{streaming ? '中…' : ''}</button>
          </div>
          {files.length>0 && <div style={{ fontSize:12, color:'#666' }}>将上传：{files.map(f=>f.name).join(', ')}</div>}
        </form>
      </main>
    </div>
  );
}
