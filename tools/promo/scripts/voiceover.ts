// Generates the voiceover with ElevenLabs, one file per script line, with word timestamps so the
// video cuts on the spoken word.
//
//   node scripts/voiceover.ts --list-voices      show voices on your account (pick an Indian English one)
//   node scripts/voiceover.ts                    generate public/vo/*.mp3 and src/vo.generated.json
//
// Needs tools/promo/.env (gitignored):
//   ELEVENLABS_API_KEY=...
//   ELEVENLABS_VOICE_ID=...
//   ELEVENLABS_MODEL=eleven_multilingual_v2   (optional)
import { mkdirSync, writeFileSync } from 'node:fs';
import { SCRIPT } from '../src/script.ts';

try {
  process.loadEnvFile('.env');
} catch {
  // fall back to the real environment
}

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const model = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
const api = 'https://api.elevenlabs.io/v1';

if (!key) {
  console.error('Set ELEVENLABS_API_KEY in tools/promo/.env');
  process.exit(1);
}

if (process.argv.includes('--list-voices')) {
  const res = await fetch(`${api}/voices`, { headers: { 'xi-api-key': key } });
  if (!res.ok) throw new Error(`voices: ${res.status} ${await res.text()}`);
  const { voices } = (await res.json()) as {
    voices: { voice_id: string; name: string; labels?: Record<string, string> }[];
  };
  for (const v of voices) {
    const labels = Object.values(v.labels ?? {}).join(', ');
    console.log(`${v.voice_id}  ${v.name.padEnd(24)} ${labels}`);
  }
  process.exit(0);
}

if (!voice) {
  console.error(
    'Set ELEVENLABS_VOICE_ID in tools/promo/.env (run with --list-voices to pick one).',
  );
  process.exit(1);
}

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Character timings -> word timings. */
function toWords(a: Alignment) {
  const words: { text: string; start: number; end: number }[] = [];
  let current: { text: string; start: number; end: number } | undefined;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) words.push(current);
      current = undefined;
      return;
    }
    const start = a.character_start_times_seconds[i] ?? 0;
    const end = a.character_end_times_seconds[i] ?? start;
    if (current) {
      current.text += ch;
      current.end = end;
    } else {
      current = { text: ch, start, end };
    }
  });
  if (current) words.push(current);
  return words;
}

mkdirSync('public/vo', { recursive: true });
const segments = [];

for (const [i, line] of SCRIPT.entries()) {
  const res = await fetch(
    `${api}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: line.text,
        model_id: model,
        // Neighbouring lines keep the read flowing like one take.
        previous_text: SCRIPT[i - 1]?.text,
        next_text: SCRIPT[i + 1]?.text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`${line.id}: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { audio_base64: string; alignment: Alignment };

  const file = `vo/${line.id}.mp3`;
  writeFileSync(`public/${file}`, Buffer.from(body.audio_base64, 'base64'));
  const words = toWords(body.alignment);
  const duration = body.alignment.character_end_times_seconds.at(-1) ?? 0;
  segments.push({ id: line.id, duration, audio: file, words });
  console.log(`${line.id.padEnd(10)} ${duration.toFixed(2)}s  ${line.text}`);
}

writeFileSync('src/vo.generated.json', `${JSON.stringify({ voice, model, segments }, null, 2)}\n`);
const total = segments.reduce((sum, s) => sum + s.duration, 0);
console.log(`\n${segments.length} lines, ${total.toFixed(1)}s of speech. Now: pnpm render`);
