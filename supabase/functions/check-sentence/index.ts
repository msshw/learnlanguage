// Thin edge function: session, body check, word read scoped to the caller, cap check, model call
// (one retry on bad output), log. Quotes become offsets in validate.ts; nothing about the word or the
// offsets comes from the client.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EFFORT, MAX_SENTENCE_LENGTH, MAX_TOKENS, MODEL, SENTENCE_CALL_TIMEOUT_MS } from '../_shared/config.ts';
import { costUsd, isOverCap } from '../_shared/cost.ts';
import { cors, json, logCall, readSpend, sessionUser } from '../_shared/ai.ts';
import { SYSTEM_PROMPT, userMessage } from './prompt.ts';
import { OUTPUT_SCHEMA } from './schema.ts';
import { validateCheck } from './validate.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Stay inside the client's 10 s timeout: no retry that cannot finish.
const BUDGET_MS = 9500;
const MIN_RETRY_MS = 1500;

const workspaceId = Deno.env.get('ANTHROPIC_WORKSPACE_ID');
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
  maxRetries: 0,
  ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
});
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const reply = (status: 'ok' | 'over_cap' | 'error', c?: { corrected: string; uses_word: boolean; issues: unknown[] }) =>
  json({ status, corrected: c?.corrected ?? null, uses_word: c?.uses_word ?? false, issues: c?.issues ?? [] });

// The trimmed sentence, or null when the body is not acceptable.
function readSentence(body: any): string | null {
  if (typeof body?.sentence !== 'string') return null;
  const sentence = body.sentence.trim();
  if (!sentence || sentence.length > MAX_SENTENCE_LENGTH || /[\u0000-\u001f\u007f]/.test(sentence)) return null;
  return sentence;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const started = Date.now();
  const user = await sessionUser(admin, req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: any = null;
  try {
    body = await req.json();
  } catch { /* not JSON */ }

  const sentence = readSentence(body);
  if (!sentence || typeof body.word_id !== 'string' || !UUID.test(body.word_id)) {
    return json({ error: 'bad request' }, 400);
  }

  // Service role read, filtered by the caller: another user's or a deleted word looks like no word.
  const { data: word, error: wordError } = await admin
    .from('words')
    .select('term, part_of_speech, translations, hint_en')
    .eq('id', body.word_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (wordError) {
    console.error('word read failed', wordError.message);
    return reply('error');
  }
  if (!word) return json({ error: 'bad request' }, 400);

  // Fail closed: if the spend cannot be read, do not call the model.
  const spend = await readSpend(admin, user.id);
  if (!spend) return reply('error');
  if (isOverCap(costUsd(spend.input, spend.output))) return reply('over_cap');

  let problem: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = BUDGET_MS - (Date.now() - started);
    if (attempt > 0 && left < MIN_RETRY_MS) break;
    const callStarted = Date.now();
    let response;
    try {
      response = await anthropic.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userMessage(word, sentence, problem) }],
          output_config: { effort: EFFORT, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        } as any,
        { signal: AbortSignal.timeout(Math.min(SENTENCE_CALL_TIMEOUT_MS, left)) },
      );
    } catch (err) {
      // Transport failure or timeout: no retry.
      await logCall(admin, user.id, 'sentence_check', {
        in: 0, out: 0, ms: Date.now() - callStarted, error: String((err as Error).message ?? err),
      });
      return reply('error');
    }

    const u = response.usage as any;
    const tokens = {
      in: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      out: u.output_tokens ?? 0,
      ms: Date.now() - callStarted,
    };
    if (response.stop_reason === 'max_tokens' || response.stop_reason === 'refusal') {
      problem = `stop_reason ${response.stop_reason}`;
      await logCall(admin, user.id, 'sentence_check', { ...tokens, error: problem });
      continue;
    }
    let checked;
    try {
      const block = response.content.find((b: any) => b.type === 'text') as any;
      checked = validateCheck(JSON.parse(block?.text ?? ''), sentence);
    } catch {
      checked = { ok: false as const, error: 'output is not JSON' };
    }
    if (!checked.ok) {
      problem = checked.error;
      await logCall(admin, user.id, 'sentence_check', { ...tokens, error: problem });
      continue;
    }
    await logCall(admin, user.id, 'sentence_check', tokens);
    return reply('ok', checked);
  }
  return reply('error');
});
