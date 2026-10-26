import { describe, expect, it } from 'vitest';
import { MemProvider } from '../src';

describe('direct MemProvider errors', () => {
  it('returns classified synchronous, asynchronous and stream failures', async () => {
    const provider = new MemProvider();
    await expect(provider.readFile('/missing', {})).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'readFile',
      source: { provider: 'mem' }
    });
    expect(() => provider.statSync('/missing', {})).toThrowError(
      expect.objectContaining({
        code: 'ENOENT',
        operation: 'statSync',
        source: { provider: 'mem' }
      })
    );
    await expect(
      provider.createReadStream('/missing', {}).getReader().read()
    ).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'createReadStream',
      source: { provider: 'mem' }
    });
  });
});
