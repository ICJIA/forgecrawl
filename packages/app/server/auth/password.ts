import { hash, compare } from 'bcrypt'
import { config } from '../../../../forgecrawl.config'

const SALT_ROUNDS = config.auth.saltRounds

export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return compare(password, hashedPassword)
}
