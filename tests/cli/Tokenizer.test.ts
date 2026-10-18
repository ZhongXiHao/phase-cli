import { describe, expect, it } from 'vitest';
import { Tokenizer } from '../../src/cli/Tokenizer.js';

const tokenize = (line: string): string[] => new Tokenizer().tokenize(line);

describe('Tokenizer', () => {
  it('splits on whitespace', () => {
    expect(tokenize('  move   c1  30 0 ')).toEqual(['move', 'c1', '30', '0']);
  });

  it('double quotes keep spaces inside one token and are not part of it', () => {
    expect(tokenize('create text title 20 40 "My Diagram"')).toEqual(['create', 'text', 'title', '20', '40', 'My Diagram']);
    expect(tokenize('set t text "处理数据 v2"')).toEqual(['set', 't', 'text', '处理数据 v2']);
  });

  it('an empty quoted string is an empty token', () => {
    expect(tokenize('set t text ""')).toEqual(['set', 't', 'text', '']);
  });

  it('a quote may touch other characters', () => {
    expect(tokenize('a"b c"d')).toEqual(['ab cd']);
  });

  it('backslash escapes a quote and a backslash inside quotes only', () => {
    expect(tokenize('set t text "say \\"hi\\" \\\\ ok"')).toEqual(['set', 't', 'text', 'say "hi" \\ ok']);
    expect(tokenize('set t text "a\\nb"')).toEqual(['set', 't', 'text', 'a\\nb']);
  });

  it('a line starting with # is a comment; a # inside a line is an ordinary character (colors)', () => {
    expect(tokenize('# whole line comment')).toEqual([]);
    expect(tokenize('   # indented comment')).toEqual([]);
    expect(tokenize('create rect r 0 0 1 1 #4a90d9')).toEqual(['create', 'rect', 'r', '0', '0', '1', '1', '#4a90d9']);
  });

  it('blank lines produce no tokens', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   \t ')).toEqual([]);
  });

  it('unterminated quote is an error', () => {
    expect(() => tokenize('create text t 1 2 "oops')).toThrow('unterminated quote');
  });
});
