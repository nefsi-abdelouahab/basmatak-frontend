/**
 * Incremental Server-Sent Events parser.
 *
 * This module deliberately knows nothing about React, fetch, or the AI-agent
 * payloads. It only turns decoded text chunks into SSE frames so the transport
 * can decide what each event means.
 *
 * SSE frames may arrive split at any boundary, including inside a UTF-8 code
 * point, between the `\r` and `\n` of a CRLF pair, or in the middle of a field.
 * The parser keeps all of that state between `push()` calls.
 */

export interface SseFrame {
  event: string;
  data: string;
}

export interface SseParser {
  push(chunk: Uint8Array | string): SseFrame[];
  end(): SseFrame[];
}

const DEFAULT_EVENT = 'message';

function stripOneLeadingSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}

export function createSseParser(): SseParser {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let eventName: string | undefined;
  let dataLines: string[] = [];
  // Set when a chunk ends in CR. If the next chunk starts with LF, that LF is
  // the second half of a CRLF pair and must not be treated as a blank line.
  let skipLeadingLf = false;

  const dispatch = (frames: SseFrame[]): void => {
    const data = dataLines.join('\n');
    if (data !== '') {
      frames.push({
        event: eventName === undefined || eventName === '' ? DEFAULT_EVENT : eventName,
        data,
      });
    }
    // A blank line always ends the current event, even when it carried no data.
    eventName = undefined;
    dataLines = [];
  };

  const processLine = (line: string, frames: SseFrame[]): void => {
    if (line === '') {
      dispatch(frames);
      return;
    }

    // Comment frames (including `: heartbeat`) never reach consumers.
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const rawValue = colon === -1 ? '' : line.slice(colon + 1);
    const value = stripOneLeadingSpace(rawValue);

    if (field === 'event') {
      eventName = value;
      return;
    }
    if (field === 'data') {
      dataLines.push(value);
      return;
    }
    // `id`, `retry`, and unknown fields are intentionally ignored.
  };

  const drain = (frames: SseFrame[]): void => {
    let start = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const char = buffer[i];

      if (char === '\n') {
        processLine(buffer.slice(start, i), frames);
        start = i + 1;
        continue;
      }

      if (char === '\r') {
        processLine(buffer.slice(start, i), frames);
        if (buffer[i + 1] === '\n') {
          // CRLF inside one chunk: consume both code units as one terminator.
          i += 1;
        } else if (i === buffer.length - 1) {
          // CR at a chunk boundary is already a complete line terminator for
          // CR-only streams. Remember it so a leading LF in the next chunk is
          // swallowed instead of producing a spurious blank line.
          skipLeadingLf = true;
        }
        start = i + 1;
      }
    }
    buffer = buffer.slice(start);
  };

  return {
    push(chunk: Uint8Array | string): SseFrame[] {
      const frames: SseFrame[] = [];
      try {
        buffer +=
          typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
        if (skipLeadingLf && buffer.length > 0) {
          if (buffer.startsWith('\n')) buffer = buffer.slice(1);
          skipLeadingLf = false;
        }
        drain(frames);
      } catch {
        // Stream content must never crash the transport. If a decoder or line
        // operation fails, keep whatever was already parsed and move on.
      }
      return frames;
    },

    end(): SseFrame[] {
      try {
        // Flush a pending multi-byte sequence. Any resulting text belongs to an
        // incomplete trailing frame, which is deliberately discarded.
        decoder.decode();
      } catch {
        // Decoder flush is best-effort; `end()` must not throw.
      }
      buffer = '';
      eventName = undefined;
      dataLines = [];
      skipLeadingLf = false;
      return [];
    },
  };
}
