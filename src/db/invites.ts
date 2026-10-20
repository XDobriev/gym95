import { randomInt } from 'crypto';
import { supabase } from './client';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const INVITE_CODE_LENGTH = 8;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export async function createInvite(createdBy: number): Promise<string> {
  const code = generateCode();
  const { error } = await supabase.from('invites').insert({ code, created_by: createdBy, uses_left: 1 });
  if (error) throw new Error(`createInvite: ${error.message}`);
  return code;
}
