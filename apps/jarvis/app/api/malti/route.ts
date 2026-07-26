import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are the language engine behind a Maltese (Malti) dictionary built for a
Malta-based user who wants considerably more than Google Translate gives: real morphology, real
grammar, and how a word is actually used on the island.

Facts about Maltese you must respect:
- Maltese descends from Siculo-Arabic and is the only Semitic language written in the Latin
  alphabet. It is an official language of Malta and of the EU.
- The alphabet includes ċ, ġ, għ, ħ, ie and ż. "għ" is usually silent but lengthens or colours the
  neighbouring vowel; "ħ" is a voiceless fricative; a final "h" is silent.
- Words of Semitic origin are built on consonantal roots, usually triliteral, with vowel patterns.
  The root k-t-b yields kiteb (he wrote), kitba (writing), ktieb (book), kotba (books).
- Roughly half the vocabulary is borrowed from Sicilian and Italian, with a large and growing
  English layer. Borrowed words do NOT have Semitic roots — say so instead of inventing one.
- Nouns of Semitic origin often take broken plurals (ktieb → kotba, dar → djar, tifel → tfal).
  Romance-origin nouns usually take -i or -jiet. Some nouns also have a dual form (jumejn, idejn).
- The definite article is il-. It assimilates before the sun letters ċ d n r s t x ż z — ix-xemx,
  id-dar, is-sena, it-tfal — and reduces to l- before a vowel.
- Verbs inflect for person and number across the perfect and imperfect.

How to fill the response:
- "recognized": false if the input is not a Maltese word. Explain briefly in usageNote and leave the
  linguistic fields empty. Never invent an entry for a word you do not actually know.
- If the user types English, treat it as a request for the Maltese equivalent: put the Maltese word
  in "headword" and say so in usageNote.
- "root": only for genuinely Semitic-origin words, formatted like "k-t-b". Empty string otherwise.
- "inflection": for nouns give singular, plural, and dual where one exists. For verbs give the
  perfect across jien, int, hu, hi, aħna, intom, huma. Empty array when nothing inflects.
- "examples": natural everyday Maltese as actually spoken in Malta, each with a faithful English
  translation. Prefer sentences a person would really say over textbook constructions.
- "usageNote": register, connotation, frequency, and any false-friend or code-switching trap. This
  is the field that earns the product its keep — be specific and practical.
- Where you are genuinely uncertain, say so in usageNote rather than fabricating detail.`;

/**
 * All fields are required and additionalProperties is false, as structured
 * outputs demand. "Not applicable" is expressed as an empty string or array
 * rather than by omitting the key.
 */
const ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    headword: { type: 'string', description: 'The Maltese word, correctly spelled with diacritics' },
    recognized: { type: 'boolean', description: 'False when this is not a Maltese word you know' },
    partOfSpeech: { type: 'string', description: 'e.g. noun (masculine), verb, adjective, particle' },
    origin: {
      type: 'string',
      enum: ['Semitic', 'Romance', 'English', 'Mixed', 'Unknown'],
    },
    root: { type: 'string', description: 'Consonantal root like "k-t-b", or "" if not Semitic' },
    pronunciation: { type: 'string', description: 'Plain-English pronunciation hint' },
    senses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          english: { type: 'string' },
          note: { type: 'string', description: 'Nuance or context for this sense; "" if none' },
        },
        required: ['english', 'note'],
        additionalProperties: false,
      },
    },
    inflection: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'e.g. Plural, Dual, Jien (I), Hu (he)' },
          form: { type: 'string' },
          english: { type: 'string' },
        },
        required: ['label', 'form', 'english'],
        additionalProperties: false,
      },
    },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mt: { type: 'string' },
          en: { type: 'string' },
        },
        required: ['mt', 'en'],
        additionalProperties: false,
      },
    },
    usageNote: { type: 'string' },
    related: {
      type: 'array',
      items: { type: 'string' },
      description: 'Related Maltese words, especially ones sharing the root',
    },
  },
  required: [
    'headword',
    'recognized',
    'partOfSpeech',
    'origin',
    'root',
    'pronunciation',
    'senses',
    'inflection',
    'examples',
    'usageNote',
    'related',
  ],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set on the server yet — add it in your deployment env vars.' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const word = typeof body?.word === 'string' ? body.word.trim() : '';
  if (!word) {
    return NextResponse.json({ error: 'No word provided.' }, { status: 400 });
  }
  if (word.length > 80) {
    return NextResponse.json({ error: 'That is too long for a dictionary lookup.' }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: ENTRY_SCHEMA } },
      messages: [{ role: 'user', content: `Give me the dictionary entry for: ${word}` }],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'That lookup was declined. Try a different word.' }, { status: 422 });
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text) {
      return NextResponse.json({ error: 'Empty response from the language model.' }, { status: 502 });
    }

    // Structured outputs guarantee the shape, but a truncated response would
    // still be invalid JSON — surface that as an error rather than a crash.
    try {
      return NextResponse.json({ entry: JSON.parse(text) });
    } catch {
      return NextResponse.json(
        { error: 'The dictionary entry came back incomplete. Try again.' },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('Malti lookup error:', error);
    return NextResponse.json(
      { error: 'Could not reach the language model. Check the API key and try again.' },
      { status: 502 },
    );
  }
}
