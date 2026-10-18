import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { Repl } from '../../src/cli/Repl.js';

async function transcript(script: string, echoInput = true): Promise<string> {
  let out = '';
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      out += String(chunk);
      callback();
    },
  });
  await new Repl(new Editor(), Readable.from([script]), sink, { echoInput, interactive: false }).run();
  return out;
}

describe('Repl', () => {
  it('prints the banner, then prompt + echoed command + output for each line', async () => {
    const out = await transcript('init 800 600\ncreate rect r1 0 0 10 10\nundo\nundo\n');
    expect(out).toBe(
      [
        "svg-editor 0.1 — type 'help' for commands",
        '',
        'svg> init 800 600',
        'canvas 800x600 created',
        'svg> create rect r1 0 0 10 10',
        'rect#r1 created',
        'svg> undo',
        'rect#r1 removed',
        'svg> undo',
        'error: nothing to undo',
        'svg> ',
        '',
      ].join('\n'),
    );
  });

  it('comments and blank lines are echoed but produce no output', async () => {
    const out = await transcript('# note\n\ninit\n');
    expect(out).toContain('svg> # note\nsvg> \nsvg> init\ncanvas 800x600 created\n');
  });

  it('handles Windows line endings', async () => {
    const out = await transcript('init 10 10\r\ncanvas\r\n');
    expect(out).toContain('canvas 10x10 created\nsvg> canvas\ncanvas 10x10\n');
  });

  it('exit stops reading further lines', async () => {
    const out = await transcript('init\nexit\ncreate rect r 0 0 1 1\n');
    expect(out).toContain('svg> exit');
    expect(out).not.toContain('rect#r created');
  });

  it('a failing line does not end the session', async () => {
    const out = await transcript('bogus\ninit\n');
    expect(out).toContain("error: unknown command: bogus (type 'help' for commands)");
    expect(out).toContain('canvas 800x600 created');
  });

  it('without echo only the prompts and outputs are written', async () => {
    const out = await transcript('init\n', false);
    expect(out).toContain('svg> canvas 800x600 created\n');
  });
});
