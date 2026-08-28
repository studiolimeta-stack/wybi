'use client';

import { useState } from 'react';

export function ResultsLinkActions({ resultsUrl }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(resultsUrl);
    } catch {
      window.prompt('Copy your private link:', resultsUrl);
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn-ghost mt-3 text-sm" onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy private link'}
    </button>
  );
}
