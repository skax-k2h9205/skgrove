import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwordHash';

describe('passwordHash', () => {
  it('맞는 비밀번호는 통과한다', async () => {
    const stored = await hashPassword('grove-1234');
    expect(await verifyPassword('grove-1234', stored)).toBe(true);
  });

  it('틀린 비밀번호는 막는다', async () => {
    const stored = await hashPassword('grove-1234');
    expect(await verifyPassword('grove-9999', stored)).toBe(false);
  });

  it('같은 비밀번호라도 salt 가 달라 해시가 매번 다르다', async () => {
    const a = await hashPassword('same-pass');
    const b = await hashPassword('same-pass');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-pass', a)).toBe(true);
    expect(await verifyPassword('same-pass', b)).toBe(true);
  });

  it('형식이 깨진 저장값은 false', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});
