import { describe, expect, it } from 'vitest';
import { createSseParser, type SseFrame, type SseParser } from './sse';

function pushAll(
  parser: SseParser,
  chunks: Array<string | Uint8Array>,
): SseFrame[] {
  const frames: SseFrame[] = [];
  for (const chunk of chunks) {
    frames.push(...parser.push(chunk));
  }
  return frames;
}

describe('createSseParser', () => {
  it('parses one complete frame from one chunk', () => {
    const parser = createSseParser();
    expect(parser.push('event: meta\ndata: {"mode":"normal"}\n\n')).toEqual([
      { event: 'meta', data: '{"mode":"normal"}' },
    ]);
  });

  it('batches multiple frames in one chunk', () => {
    const parser = createSseParser();
    expect(
      parser.push(
        'event: meta\ndata: one\n\nevent: token\ndata: two\n\nevent: done\ndata: three\n\n',
      ),
    ).toEqual([
      { event: 'meta', data: 'one' },
      { event: 'token', data: 'two' },
      { event: 'done', data: 'three' },
    ]);
  });

  it('parses a frame split at every string boundary', () => {
    const stream = 'event: meta\ndata: {"conversationId":"abc"}\n\n';
    const expected = [
      { event: 'meta', data: '{"conversationId":"abc"}' },
    ];

    for (let split = 0; split <= stream.length; split += 1) {
      const parser = createSseParser();
      expect(
        pushAll(parser, [stream.slice(0, split), stream.slice(split)]),
      ).toEqual(expected);
    }
  });

  it('parses one-character chunks', () => {
    const stream =
      'event: status\ndata: {"state":"thinking"}\n\nevent: token\ndata: {"delta":"hi"}\n\n';
    const parser = createSseParser();
    expect(pushAll(parser, [...stream])).toEqual([
      { event: 'status', data: '{"state":"thinking"}' },
      { event: 'token', data: '{"delta":"hi"}' },
    ]);
  });

  it.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
    ['CR', '\r'],
  ])('supports %s line endings', (_label, ending) => {
    const parser = createSseParser();
    expect(
      parser.push(
        `event: token${ending}data: {"delta":"hi"}${ending}${ending}`,
      ),
    ).toEqual([{ event: 'token', data: '{"delta":"hi"}' }]);
  });

  it('handles CR at the end of a chunk followed by LF in the next chunk', () => {
    const parser = createSseParser();
    expect(pushAll(parser, ['event: token\r', '\ndata: hi\r\n', '\r\n'])).toEqual([
      { event: 'token', data: 'hi' },
    ]);
  });

  it('joins multiline data with newlines', () => {
    const parser = createSseParser();
    expect(
      parser.push('event: token\ndata: line one\ndata: line two\n\n'),
    ).toEqual([{ event: 'token', data: 'line one\nline two' }]);
  });

  it('strips exactly one leading space after the colon', () => {
    const oneSpace = createSseParser();
    expect(oneSpace.push('data: value\n\n')).toEqual([
      { event: 'message', data: 'value' },
    ]);

    const twoSpaces = createSseParser();
    expect(twoSpaces.push('data:  value\n\n')).toEqual([
      { event: 'message', data: ' value' },
    ]);

    const noSpace = createSseParser();
    expect(noSpace.push('data:value\n\n')).toEqual([
      { event: 'message', data: 'value' },
    ]);
  });

  it('ignores heartbeat and comment frames completely', () => {
    const parser = createSseParser();
    expect(parser.push(': heartbeat\n\n')).toEqual([]);
    expect(parser.push(': heartbeat\r\n\r\n')).toEqual([]);
    expect(parser.push(': just a comment\n\n')).toEqual([]);
  });

  it('ignores comments while keeping the following event', () => {
    const parser = createSseParser();
    expect(
      parser.push(': heartbeat\n\nevent: token\ndata: ok\n\n: heartbeat\n\n'),
    ).toEqual([{ event: 'token', data: 'ok' }]);
  });

  it('ignores unknown fields', () => {
    const parser = createSseParser();
    expect(
      parser.push(
        'id: 42\nretry: 1000\nevent: token\ndata: value\nfoo: bar\n\n',
      ),
    ).toEqual([{ event: 'token', data: 'value' }]);
  });

  it('defaults the event name to message', () => {
    const parser = createSseParser();
    expect(parser.push('data: hello\n\n')).toEqual([
      { event: 'message', data: 'hello' },
    ]);
  });

  it('does not dispatch empty data', () => {
    const parser = createSseParser();
    expect(parser.push('event: token\ndata:\n\n')).toEqual([]);
    expect(parser.push('event: token\ndata: \n\n')).toEqual([]);
    expect(parser.push('event: token\n\n')).toEqual([]);
  });

  it('does not throw on malformed lines or fields', () => {
    const parser = createSseParser();
    expect(() =>
      parser.push(':comment\nunknown\nid\nretry\ndata\nevent\n\n'),
    ).not.toThrow();
    expect(parser.push('data: ok\n\n')).toEqual([
      { event: 'message', data: 'ok' },
    ]);
  });

  it('discards an incomplete trailing frame in end()', () => {
    const parser = createSseParser();
    expect(parser.push('event: token\ndata: {"delta":"hi"}\n')).toEqual([]);
    expect(parser.end()).toEqual([]);
  });

  it('keeps complete frames and discards only the incomplete tail', () => {
    const parser = createSseParser();
    expect(
      pushAll(parser, [
        'data: first\n\nevent: token\n',
        'data: second\n',
      ]),
    ).toEqual([{ event: 'message', data: 'first' }]);
    expect(parser.end()).toEqual([]);
  });

  it('decodes Arabic UTF-8 split in the middle of a character', () => {
    const stream = 'event: token\ndata: {"delta":"مرحبا"}\n\n';
    const bytes = new TextEncoder().encode(stream);
    const parser = createSseParser();
    const frames = pushAll(
      parser,
      Array.from(bytes, (byte) => Uint8Array.of(byte)),
    );
    expect(frames).toEqual([
      { event: 'token', data: '{"delta":"مرحبا"}' },
    ]);
  });

  it('flushes the decoder safely at end()', () => {
    const parser = createSseParser();
    const bytes = new TextEncoder().encode('data: ');
    parser.push(Uint8Array.from([...bytes, 0xd9]));
    expect(() => parser.end()).not.toThrow();
    expect(parser.end()).toEqual([]);
  });
});
