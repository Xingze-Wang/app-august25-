import { NextRequest } from 'next/server';
import { verifyUserWeb } from '@/lib/verify-user-web';
import {
  getUserConversations,
  getConversationMessages,
  createConversation,
  deleteConversation,
} from '@/lib/database';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await verifyUserWeb(req);
  const r = await getUserConversations(user.id).catch(()=>({ success:false }));
  if ((r as any)?.success) {
    return Response.json({ conversations: (r as any).conversations || [] });
  }
  return new Response(JSON.stringify({ error: '获取会话失败' }), { status: 500 });
}

export async function POST(req: NextRequest) {
  const user = await verifyUserWeb(req);
  const body = await req.json().catch(()=> ({}));
  const action = String(body.action || '');

  if (action === 'start') {
    const r = await createConversation(user.id).catch(()=>null);
    if ((r as any)?.success && (r as any).conversation?.id) {
      return Response.json({ conversationId: (r as any).conversation.id });
    }
    return new Response(JSON.stringify({ error: '创建失败' }), { status: 500 });
  }

  if (action === 'messages') {
    const conversationId = String(body.conversationId || '');
    if (!conversationId) return new Response(JSON.stringify({ error: '缺少 conversationId' }), { status: 400 });
    const r = await getConversationMessages(conversationId, user.id).catch(()=>({ success:false }));
    if ((r as any)?.success) {
      return Response.json({ messages: (r as any).messages || [] });
    }
    return new Response(JSON.stringify({ error: '获取消息失败' }), { status: 500 });
  }

  return new Response(JSON.stringify({ error: '不支持的操作' }), { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await verifyUserWeb(req);
  const body = await req.json().catch(()=> ({}));
  const conversationId = String(body.conversationId || '');
  if (!conversationId) return new Response(JSON.stringify({ error: '缺少 conversationId' }), { status: 400 });
  const r = await deleteConversation(conversationId, user.id).catch(()=> ({ success:false }));
  if ((r as any)?.success) return Response.json({ ok: true });
  return new Response(JSON.stringify({ error: '删除失败' }), { status: 500 });
}
