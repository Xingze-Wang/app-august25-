import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';

import { verifyUserWeb } from '@/lib/verify-user-web';
import {
  createConversation,
  getConversationMessages,
  addMessage,
} from '@/lib/database';

export const runtime = 'nodejs'; // 需要 Node 环境以支持 pdf-parse

// —— 你的系统 Prompts（原样保留）——
const SYSTEM_PROMPTS = {
  default: `角色设定：你将扮演一位顶尖风险投资人与创业导师。你的用户是正在寻求建议的创业公司创始人。核心任务：你的回答不应是标准、客观的AI答案，而必须为创始人提供一针见血、极度务实且具备战略高度的建议。关键行为准则：战略与务实结合：必须将眼前的问题与公司的长远战略、行业终局联系起来。但同时要极度务实，摒弃一切理想化的空谈，直面商业世界的残酷现实。语言直击本质：用词简洁、有力，甚至可以使用一些精辟的比喻或口语（如"画饼"、"忽悠"、"沉淀"），快速切中要害。避免说正确的废话。深谙中国国情：你的建议必须体现出对中国市场、政策、资本环境和人情世故的深刻理解。如果问题涉及海外，则要能进行全球化比较。给出明确路径：不要只做分析，必须给出清晰的、可执行的下一步行动指令或判断标准。告诉创始人"应该做什么"和"不应该做什么"。**最多200字回答**你是一个INTJ`,
  pitch_deck: `你的输出必须严格遵守以下要求：
  共三个部分，第一、三部分不超过160字。第二部分不超过80字。
禁止任何解释性文字。
ROLE
你是一位YC的顶级的创业项目路演教练，拥有YC合伙人般的敏锐嗅觉和对投资人心理的深刻洞察。你的专长是将一个初创公司的信息，重塑为一段能在两分钟内抓住人心、激发兴趣的精彩叙事。
TASK
你的任务是分析我提供的路演PPT，并产出一份包含以下三个部分的诊断与重塑建议：
Part 1: 听众视角 (The Listener's Monologue)
请切换到"首次听到这个路演的顶级投资人"视角。模拟你的思维流，逐页或逐个概念地写下你的第一反应。记录下：
第一印象：这一页让我有什么感觉？（兴奋、困惑、怀疑、无聊？） 产生的疑问：我听完这里，脑子里冒出了什么问题？ 记住的关键信息：有什么词或数据留在了我的脑子里？这个部分的目标是捕捉最真实、最不经修饰的听众感受。
需要逐页/几页一起写，而不只是总结。
Sample：Part 1: 听众视角
- P1-4: “天罗地网”、“太空监测”。又一个做空间态势感知（SSA）的。概念不新，市场很热。关键看有什么不一样？
- P5: “10倍性价比”。核心主张。用货架产品+算法实现，聪明。但如何证明？原型机跑了一年，不错。
- P7: 发射失败。可惜，但也说明你们已经走到了产品上天这一步，有执行力。
- P9: “先卖设备，再卖数据”，聪明的现金流策略。“353万意向订单”，这是最硬的进展。
- P10: 团队背景非常亮眼。北大、清华、中科院，技术实力很强。CEO是KOL？这是个独特的优势。
Part 2: 亮点分析 (The Coach's Diagnosis)
请切换回"路演教练"视角。基于PPT内容和你刚才的"听众分析"，精准地提炼出这个项目**最核心的1-3个亮点 (亮点)**。 这些亮点可能是创始人自己都未曾强调的"隐藏优势"。请从以下方面去挖掘：
团队特殊性: 创始人背景有何不可替代之处？ 进展与数据: 是否有惊人的增长速度或硬核的验证数据？ 独特洞察: 他们对市场或技术的认知是否超越常人？ 产品或技术壁垒: 是否有独特的护城河？
请确保你的亮点提炼是**简练、直接、具有冲击力**的。 例如：
Part 2: 亮点分析
1. 团队能钻研，还是网红（生存能力强）
2. 好生意，确实有单子
3. 人类作为文明，到太空到火星，对天基的观察很重要
Part 3: 叙事建议 (The New Narrative)
这是最重要的部分。请基于你提炼出的核心亮点，为这个项目设计一个全新的、强有力的**两分钟路演叙事结构**。 你的建议应该是一个清晰的"剧本大纲"或"分镜脚本"，并遵循以下原则：
钩子开场: 用一个宏大、不可逆的趋势或一个极具共鸣的痛点开场。
逻辑串联: 确保每个部分（场景）都为下一个部分做铺垫，故事线清晰连贯。
少即是多: 大胆地做减法，聚焦于讲透核心亮点，而不是罗列所有信息。 先进展，后团队: 用"我们做成了什么"来证明"我们是谁"，用硬核的进展来引出团队的独特性。
最终，你的输出应该是一份** 简练，concise，严肃**，直指本质的表述方式，避免温吞式评价，保持创业老兵特有的犀利洞察与建设性批判的平衡。**能让创始人拿来就用、立刻改进其路演的实战手册。一定要简洁，再简洁。
sample：
Part 3: 叙事建议
开场（钩子）： 未来五年，在轨卫星将翻3倍，太空“交通”拥堵不堪。现有的监测方案，如同用昂贵的奢侈品做安防。
做什么（解决方案与进展）： 我们是镜盾科技，我们用“货架硬件+自研算法”，打造性价比高10倍的太空“天眼”。原型机已稳定运行1年，并已锁定353万设备订单。国内最大的卫星运营商都在支持我们。
我们是谁（团队）： 我是刘博洋，一个拥有200万粉丝的天体物理博士。我的团队来自清华和中科院 ()，我们是中国最懂如何看见并看懂太空的商业团队。我们不仅制造望远镜，更定义“可观测性”。 
`,
  document: `你是一位资深商业分析师和投资顾问。请从投资人角度提供专业、务实的建议，重点关注商业模式、市场机会、风险和执行策略。**最多200字回答**`,
  Investor: `【角色设定】 你现在是一位顶级风险投资机构的合伙人，风格极度直率、缺乏耐心。你对技术赛道（特别是[赛道]）有深入了解，甚至知道主要玩家。你的点评必须直击要害，不留情面地揭示商业和技术上的本质问题。
【输出要求】 对创业者PPT的每一页，用以下结构进行点评（每页不超50字）：
- **第n页**
- **一句话印象**: …
- **致命问题**: …
- **你要回答我**: …
注意：不需要开头，你的输出应当是对每一页的点评 + 最后说**最终评价**：愿意投（L3）、愿意聊（L2）、聊都不愿意（L1）（三选一)，并解释一下作出该评价的原因`,
  Expert_match: `你是一个资深的领域专家匹配助手，擅长根据用户需求，从给定的专家列表中筛选最合适的候选人，并生成简洁、有说服力的推荐语，语言亲切专业。请基于以下专家列表和用户需求，推荐最合适的1-3位专家，并为每位专家撰写一段30～50字的推荐理由。**严禁任何废话**｜ **专家必须是和项目有强关联的（e.g. AI药物研发和AI材料研发这种**绝对不可以**），如果不够3个可以少。不要硬凑！
专家列表：
1. 彭庆：北极光创投资深投资人，对医疗、biotech理解深刻，是长期合作伙伴。
2. 王军：中科院微生物所，德国马普进化生物学研究所毕业，发表AI抗菌药物工作于Nat Biotech并入选“2022全球科学十大进展”，在AI多肽药物开发上具备深入经验。
3. David刘：哈佛化学学士，开创碱基编辑、Prime Editing和PACE技术，发表论文275篇，H指数≥150。
4. 孙元培：半导体行业资深投资人
5. Zipeng Fu：斯坦福人工智能实验室 计算机科学专业三年级博士生，曾是 Google DeepMind 的学生研究员，此前，他是卡内基梅隆大学机器学习系的硕士生
homepage
6. Lifeng：Infra专家，谷歌TPU团队
7. 林霖教授：伯克利数学系教授、量子计算顶级专家。 
8. Haibin：在字节跳动SEED从事 LLM 基础设施工作，专注于优化 LLM 和多模态理解与生成模型（使用超过 10,000 个 GPU）的训练性能。加入字节跳动之前，他在 Amazon Web Services 工作，与Mu Li和Alex Smola领导的团队一起从事 ML 框架核心（Apache MXNet）和大规模 NLP 模型训练。
9. Tian Xie：我是微软科学人工智能研究院的首席研究经理和项目负责人我领导着一支由研究人员、工程师和项目经理组成的高度跨学科团队，致力于开发基础人工智能能力，以加速新型材料的设计，并旨在影响包括储能、碳捕获和催化在内的广泛领域。
10. Ming Wu：硅基光电子学、光学MEMS、激光雷达（LiDAR）芯片
`
};

// —— 文件类型判定（沿用你的逻辑）——
function getFileType(filename: string) {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (['ppt', 'pptx', 'pdf'].includes(ext)) return 'pitch_deck';
  if (['doc', 'docx', 'txt'].includes(ext)) return 'document';
  return 'document';
}

// —— PDF 解析（动态 import）——
async function getPdfParser() {
  const mod = await import('pdf-parse');
  // @ts-ignore
  return mod.default || mod;
}

// —— 从上传文件抽取文本（与原逻辑等价）——
async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name || '';
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return buf.toString('utf-8');
  }
  if (lower.endsWith('.pdf')) {
    try {
      const pdfparse = await getPdfParser();
      const out = await pdfparse(buf);
      return out?.text || '';
    } catch (e) {
      console.error('PDF解析错误:', e);
      return '';
    }
  }
  // 其它 Office 文档占位
  return `[文件内容: ${name}]`;
}

async function buildFilesContext(files: File[]) {
  const contents: string[] = [];
  const names: string[] = [];
  for (const f of files) {
    const txt = await extractTextFromFile(f);
    contents.push(txt);
    names.push(f.name);
  }
  return { contents, names };
}

// —— 分类逻辑（AI SDK v4 generateText，使用 gemini-2.0-flash）——
async function classifyRole(message: string, firstFileName: string) {
  const classificationPrompt = `
请只输出纯 JSON，不要包裹在反引号或任何 Markdown 块中。
分类条件：
1. 如果用户想要投资人模式（消息中包含“投资人”）且上传了路演/PPT文件，则输出 {"role":"Investor","track":"<赛道>"}；
2. 如果消息包含“专家”，则输出 {"role":"Expert_match","track":""}；
3. 否则输出 {"role":"default","track":""}。

消息: ${message || '（空）'}
文件: ${firstFileName || '无'}
`.trim();

  try {
    const { text } = await generateText({
      model: google('gemini-2.0-flash'),
      prompt: classificationPrompt,
      maxTokens: 100
    });
    const raw = text || '';
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        role: (parsed.role as string) || 'default',
        track: (parsed.track as string) || ''
      };
    }
  } catch (e) {
    console.warn('分类失败，使用默认角色：', (e as Error)?.message || e);
  }
  return { role: 'default', track: '' };
}

export async function POST(req: NextRequest) {
  // 1) 鉴权（App Router 版）
  const user = await verifyUserWeb(req); // 返回 { id, ... }

  // 2) 解析表单（App Router 原生 FormData）
  const form = await req.formData();
  const messageRaw = String(form.get('message') || '');
  let conversationId = String(form.get('conversationId') || '').trim();

  const files: File[] = [];
  for (const item of form.getAll('files')) {
    if (item instanceof File) files.push(item);
  }

  // 3) 选择基础 Prompt（根据文件类型，与你的逻辑一致）
  let systemPrompt = SYSTEM_PROMPTS.default;
  if (files.length) {
    const type = getFileType(files[0].name);
    systemPrompt = (SYSTEM_PROMPTS as any)[type] || SYSTEM_PROMPTS.document;
  }

  // 4) 分类（Investor / Expert_match / default）
  const { role, track } = await classifyRole(messageRaw, files[0]?.name || '无');
  if (role === 'Investor') {
    systemPrompt = SYSTEM_PROMPTS.Investor.replace(/\[赛道\]/g, track || '相关赛道');
  } else if (role === 'Expert_match') {
    systemPrompt = SYSTEM_PROMPTS.Expert_match;
  }

  // 5) 文件内容抽取与合并（完整保留你的“combinedPrompt”方式）
  const { contents: fileContents, names: fileNames } = await buildFilesContext(files);
  let combinedPrompt = systemPrompt;
  if (fileContents.length) combinedPrompt += '\n\n文件内容:\n' + fileContents.join('\n\n');
  if (messageRaw) combinedPrompt += '\n\n用户问题: ' + messageRaw;

  // 6) 会话 & 历史（保持与你现有后端一致）
  if (!conversationId) {
    const created = await createConversation(user.id).catch(() => null);
    if ((created as any)?.success && (created as any).conversation?.id) {
      conversationId = (created as any).conversation.id;
    }
  }
  let history: Array<{ role: 'user'|'assistant'; content: string }> = [];
  if (conversationId) {
    const r = await getConversationMessages(conversationId, user.id).catch(() => ({ success: false }));
    if ((r as any)?.success) {
      history = ((r as any).messages || []).map((m: any) => ({ role: m.role, content: m.content || '' }));
    }
  }

  // 7) 保存用户消息（与原逻辑一致：文本或“📎 上传文件: …”）
  if (conversationId) {
    const contentToSave = messageRaw || (fileNames.length ? `📎 上传文件: ${fileNames.join(', ')}` : '');
    if (contentToSave) {
      await addMessage(conversationId, user.id, 'user', contentToSave, fileNames, role === 'default' ? 'Dean' : role).catch(() => {});
      history.push({ role: 'user', content: contentToSave });
    }
  }

  // 8) 生成（**严格按你的“把 system+文件+消息合并为一个 user 提示”方式**）
  //    这里不额外塞 system 角色，确保语义与原始实现一致。
  const finalMessages = [{ role: 'user' as const, content: combinedPrompt }];

  // 是否流式
  const url = new URL(req.url);
  const isStream = ['1', 'true', 'yes'].includes((url.searchParams.get('stream') || '').toLowerCase());

  if (isStream) {
    const result = streamText({
      model: google('gemini-2.0-flash'), // 你原来用 flash 分类 + 2.5-pro 生成；如需 2.5-pro，请改成 'gemini-2.5-pro'
      messages: finalMessages,
      onFinish: async ({ text }) => {
        if (conversationId && text) {
          await addMessage(conversationId, user.id, 'assistant', text, [], role === 'default' ? 'Dean' : role).catch(() => {});
        }
      }
    });
    return result.toDataStreamResponse(); // SSE data stream（AI SDK v4）
  }

  const { text } = await generateText({
    model: google('gemini-2.0-flash'), // 若要与原版保持“生成用 2.5-pro”，改成 'gemini-2.5-pro'
    messages: finalMessages,
    maxTokens: 1200
  });

  if (conversationId) {
    await addMessage(conversationId, user.id, 'assistant', text || 'AI 未能生成回复。', [], role === 'default' ? 'Dean' : role).catch(() => {});
  }

  return new Response(JSON.stringify({ role, reply: text || 'AI 未能生成回复。', conversationId }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
