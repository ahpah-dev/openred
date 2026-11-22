import React, { useRef, useState } from 'react';
import {
  Bold,
  Code,
  Eye,
  EyeOff,
  FileCode2,
  Italic,
  Link2,
  List,
  Quote,
  Strikethrough,
} from 'lucide-react';
import { MarkdownBody } from '../utils/markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  minHeight?: string;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your thoughts using Markdown...',
  rows = 5,
  minHeight = '120px',
  autoFocus = false,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const wrapSelection = (before: string, after = before, fallback = 'text') => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + before + fallback + after);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertPrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}\n${prefix}`);
      return;
    }
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] focus-within:border-[var(--or-text-secondary)]">
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-[var(--or-border)] bg-[var(--or-surface)] px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            onClick={() => wrapSelection('**', '**', 'bold')}
            title="Bold"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('*', '*', 'italic')}
            title="Italic"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('~~', '~~', 'strikethrough')}
            title="Strikethrough"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('[', '](https://example.com)', 'link text')}
            title="Link"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('`', '`', 'code')}
            title="Inline code"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('\n```\n', '\n```\n', 'code block')}
            title="Code block"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <FileCode2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertPrefix('> ')}
            title="Quote"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertPrefix('- ')}
            title="List"
            className="rounded p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('>!', '!<', 'spoiler text')}
            title="Spoiler tag"
            className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            Spoiler
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
        >
          {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div className="p-3 text-sm" style={{ minHeight }}>
          {value.trim() ? (
            <MarkdownBody content={value} />
          ) : (
            <span className="text-[var(--or-text-muted)] italic">Nothing to preview yet.</span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          style={{ minHeight }}
          className="w-full resize-y bg-transparent p-3 text-sm text-[var(--or-text)] placeholder-[var(--or-text-muted)] focus:outline-none"
        />
      )}
    </div>
  );
}
