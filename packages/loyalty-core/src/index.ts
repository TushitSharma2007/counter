// Pure loyalty logic: rules schema and engine. No React, no Supabase, no POS imports; also runs on
// Deno (edge functions import it through the functions' import map).
export {
  evaluate,
  NEW_CARD,
  type CardState,
  type Evaluation,
  type RejectCode,
  type RewardGrant,
  type StampEvent,
} from './logic/evaluate.ts';
export { HappyHour, Program, Reward, TEMPLATES, Tier, type ProgramInput } from './logic/program.ts';
