import { describe, it, expect } from '@jest/globals';
import { getCloudFormationParameters } from '../cloudformation';

describe('getCloudFormationParameters', () => {
  it('should parse parameters', () => {
    const params = getCloudFormationParameters(`
      Param1=foo&
      Param2=bar
    `);
    expect(params).toEqual([
      {
        ParameterKey: 'Param1',
        ParameterValue: 'foo',
      },
      {
        ParameterKey: 'Param2',
        ParameterValue: 'bar',
      },
    ]);
  });

  it('should allow empty parameters', () => {
    const params = getCloudFormationParameters();
    expect(params).toEqual([]);
  });
});
