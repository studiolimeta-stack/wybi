'use client';

import { useState } from 'react';

export function ResultsLinkActions({ resultsUrl }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(resultsUrl);
    } catch {
      window.prompt('Copy your private results link:', resultsUrl);
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn btn-plain mt-4 w-full sm:w-auto" onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy results link'}
    </button>
  );
}
