import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Jarvis, Jake's personal AI assistant for Gemini Ltd (Malta).
Keep replies short and spoken-friendly — this is read aloud by text-to-speech, so avoid
markdown, bullet points, or long lists. One or two sentences unless Jake asks for detail.
Be direct, capable, and a little dry-witted, like the character namesake. If asked to do
something that needs a connector you don't have yet (Drive, Calendar, WhatsApp, etc.), say
so plainly rather than pretending to have done it.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set on the server yet — add it in your deployment env vars.' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'No message provided.' }, { status: 400 });
  }

  const history = Array.isArray(body?.history) ? body.history : [];

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        ...history
          .filter((m: unknown): m is { role: 'user' | 'assistant'; content: string } => {
            const entry = m as { role?: unknown; content?: unknown };
            return (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string';
          })
          .slice(-10),
        { role: 'user', content: message },
      ],
    });

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim();

    return NextResponse.json({ reply: reply || "I didn't catch that clearly — try again?" });
  } catch (error) {
    console.error('Jarvis chat error:', error);
    return NextResponse.json({ error: 'Jarvis hit an error reaching the brain. Check the API key and try again.' }, { status: 502 });
  }
}
