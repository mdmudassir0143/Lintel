/** AES-256-GCM for third-party tokens stored in the database (for example Shopify access tokens). */
import crypto from 'node:crypto';
import { env } from './env';

const key = () => crypto.createHash('sha256').update(env.lintelSecret).digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), data.toString('base64url'), c.getAuthTag().toString('base64url')].join('.');
}

export function decryptSecret(box: string): string {
  const [v, iv, data, tag] = box.split('.');
  if (v !== 'v1' || !iv || !data || !tag) throw new Error('Unreadable secret.');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
