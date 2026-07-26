import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You write a single day's personal brief for Jake, who runs Gemini Ltd, a small
digital agency in Malta. He juggles client work, a ghost-kitchen build, property, and training.

Voice: direct, grounded, a bit stoic. Talk to him like a sharp friend who trains, not like a
wellness app. No emoji, no exclamation marks, no "crushing it", no corporate uplift.

The four sections:
- motivation: a real quote from a real, named person, chosen to fit the focus he gave you. Never
  invent a quote or misattribute one — if you are not certain of the wording and the author, choose a
  different quote you are certain of. The "why" line connects it to his actual day in one sentence.
- tips: two or three concrete, practical actions for today. Tie them to the focus he named. Specific
  beats generic: "batch the three client replies before opening the build" beats "manage your time".
- astrology: entertainment, and it should read as characterful writing rather than a claim about
  reality. Use the traditional character of the sign he gave you. Do not predict specific events, do
  not touch health, money, or relationship outcomes as if they were forecasts, and never imply a
  decision should hinge on it. Keep it to disposition and framing.
- fitness: a session for today that fits the split and constraints he gave. Name the movements, give
  sets and reps, and keep it realistic for someone with a full workday. If today is a rest day in his
  split, say so and give recovery work instead of inventing a session.

Fitness safety: stay within ordinary general-population training. Do not prescribe rehabilitation for
an injury, do not push through pain, and add a brief note to adjust loads to how he actually feels.`;

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    greeting: { type: 'string', description: 'One short line setting the tone for the day' },
    motivation: {
      type: 'object',
      properties: {
        quote: { type: 'string' },
        author: { type: 'string' },
        why: { type: 'string', description: 'One sentence tying it to his day' },
      },
      required: ['quote', 'author', 'why'],
      additionalProperties: false,
    },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['title', 'body'],
        additionalProperties: false,
      },
    },
    astrology: {
      type: 'object',
      properties: {
        sign: { type: 'string' },
        headline: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['sign', 'headline', 'body'],
      additionalProperties: false,
    },
    fitness: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'e.g. Push day, or Rest and mobility' },
        isRestDay: { type: 'boolean' },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              movement: { type: 'string' },
              prescription: { type: 'string', description: 'e.g. 4 x 6-8 @ RPE 8' },
            },
            required: ['movement', 'prescription'],
            additionalProperties: false,
          },
        },
        note: { type: 'string' },
      },
      required: ['title', 'isRestDay', 'blocks', 'note'],
      additionalProperties: false,
    },
  },
  required: ['greeting', 'motivation', 'tips', 'astrology', 'fitness'],
  additionalProperties: false,
} as const;

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set on the server yet — add it in your deployment env vars.' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);

  const sign = SIGNS.includes(body?.sign) ? body.sign : 'Capricorn';
  const focus = typeof body?.focus === 'string' ? body.focus.slice(0, 300) : '';
  const split = typeof body?.split === 'string' ? body.split.slice(0, 200) : '';
  const constraints = typeof body?.constraints === 'string' ? body.constraints.slice(0, 300) : '';

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            `Today is ${today}.`,
            `Star sign: ${sign}.`,
            focus ? `What's on today: ${focus}` : "He didn't say what's on today — keep the tips general but still concrete.",
            split ? `Training split: ${split}` : 'Training split: not specified — assume a sensible full-body routine.',
            constraints ? `Constraints: ${constraints}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'That brief was declined. Try adjusting your focus note.' }, { status: 422 });
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text) {
      return NextResponse.json({ error: 'Empty response from the model.' }, { status: 502 });
    }

    try {
      return NextResponse.json({ brief: JSON.parse(text) });
    } catch {
      return NextResponse.json({ error: 'The brief came back incomplete. Try again.' }, { status: 502 });
    }
  } catch (error) {
    console.error('Dashboard brief error:', error);
    return NextResponse.json(
      { error: 'Could not reach the model. Check the API key and try again.' },
      { status: 502 },
    );
  }
}
