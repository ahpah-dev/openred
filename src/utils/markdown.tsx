import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function SpoilerSpan({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((v) => !v);
      }}
      title={revealed ? 'Spoiler revealed' : 'Click to reveal spoiler'}
      className={`inline rounded px-1.5 py-0.5 text-left transition-colors ${
        revealed
          ? 'bg-[var(--or-surface-elevated)] text-[var(--or-text)]'
          : 'bg-[#4e5d66] text-transparent hover:bg-[#5e6e78] select-none'
      }`}
    >
      {text}
    </button>
  );
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const tokenRegex =
    /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|`[^`]+`|>![\s\S]+?!<|\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|(?:^|\s)(?:r|u)\/[a-zA-Z0-9_]{2,24}|https?:\/\/[^\s<)]+)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('__') && token.endsWith('__')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(<del key={key} className="opacity-70">{renderInline(token.slice(2, -2), key)}</del>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-[var(--or-surface-elevated)] px-1.5 py-0.5 font-mono text-[0.88em] text-[#ff6b3d]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('>!') && token.endsWith('!<')) {
      nodes.push(<SpoilerSpan key={key} text={token.slice(2, -2)} />);
    } else if (token.startsWith('[')) {
      const m = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (m) {
        nodes.push(
          <a
            key={key}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[#4fbcff] hover:underline break-all"
          >
            {m[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#4fbcff] hover:underline break-all"
        >
          {token}
        </a>
      );
    } else {
      const leadingSpace = token.startsWith(' ') ? ' ' : '';
      const trimmed = token.trim();
      if (trimmed.startsWith('r/') || trimmed.startsWith('u/')) {
        if (leadingSpace) nodes.push(leadingSpace);
        nodes.push(
          <Link
            key={key}
            to={`/${trimmed}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-[#4fbcff] hover:underline"
          >
            {trimmed}
          </Link>
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function MarkdownBody({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="my-2 overflow-x-auto rounded-lg border border-[var(--or-border)] bg-[#0b0f13] p-3 font-mono text-xs text-[#e2e8f0]"
        >
          {lang && (
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[#64748b]">
              {lang}
            </div>
          )}
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Markdown table
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|/.test(lines[i + 1])
    ) {
      const parseCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headers = parseCells(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        bodyRows.push(parseCells(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="my-3 overflow-x-auto rounded-lg border border-[var(--or-border)]">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-[var(--or-surface-elevated)] text-[var(--or-text)]">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="border-b border-[var(--or-border)] px-3 py-2 font-semibold">
                    {renderInline(h, `th-${i}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--or-border-subtle)] last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-[var(--or-text-secondary)]">
                      {renderInline(cell, `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls =
        level === 1
          ? 'mt-3 mb-1.5 text-lg font-bold'
          : level === 2
            ? 'mt-2.5 mb-1 text-base font-bold'
            : 'mt-2 mb-1 text-sm font-bold';
      blocks.push(
        <div key={`h-${i}`} className={cls}>
          {renderInline(headingMatch[2], `h-${i}`)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="my-2 border-l-3 border-[var(--or-border)] pl-3 text-[var(--or-text-secondary)] italic"
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>{renderInline(ql, `bq-${i}-${qi}`)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered / ordered list
    if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      const isOrdered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s+/, ''));
        i++;
      }
      const Tag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <Tag
          key={`list-${i}`}
          className={`my-1.5 space-y-1 pl-5 ${isOrdered ? 'list-decimal' : 'list-disc'}`}
        >
          {items.map((item, li) => (
            <li key={li}>{renderInline(item, `li-${i}-${li}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*([-*•]|\d+\.)\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed break-words">
        {paraLines.map((pl, pi) => (
          <React.Fragment key={pi}>
            {pi > 0 && <br />}
            {renderInline(pl, `p-${i}-${pi}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className={`text-sm ${className}`}>{blocks}</div>;
}
