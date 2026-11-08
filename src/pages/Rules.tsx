import { useEffect, useState } from 'react';
import { Button, Card, PageTitle } from '../components/ui';
import { KeyRulesCard } from './Dashboard';

const PDF = '/rules.pdf';

export function RulesPage() {
  const [state, setState] = useState<'checking' | 'ok' | 'missing'>('checking');
  useEffect(() => {
    // SPA hosts serve index.html for missing files, so check the content type too.
    fetch(PDF, { method: 'HEAD' })
      .then((r) => setState(r.ok && (r.headers.get('content-type') ?? '').includes('pdf') ? 'ok' : 'missing'))
      .catch(() => setState('missing'));
  }, []);

  return (
    <div>
      <PageTitle
        title="Rules"
        subtitle="CAFEC Malaysia Brewers Cup 2026 — official rules"
        action={
          state === 'ok' && (
            <>
              <a href={PDF} target="_blank" rel="noreferrer">
                <Button>Open in new tab</Button>
              </a>
              <a href={PDF} download="CAFEC-Malaysia-Brewers-Cup-2026-rules.pdf">
                <Button variant="primary">Download PDF</Button>
              </a>
            </>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 sm:p-0 overflow-hidden">
          {state === 'ok' ? (
            <object data={`${PDF}#view=FitH`} type="application/pdf" className="h-[75vh] w-full bg-mist-950">
              <div className="p-6 text-sm text-ink-muted">
                Your browser can't show PDFs inline.{' '}
                <a href={PDF} className="text-accent underline">
                  Download the rules
                </a>
                .
              </div>
            </object>
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center p-6 text-center">
              <h3 className="font-display text-xl">{state === 'checking' ? 'Loading…' : 'Rules PDF not found'}</h3>
              {state === 'missing' && (
                <p className="mt-2 max-w-md text-sm text-ink-muted">
                  Place the official rules at <code className="num rounded bg-mist-800 px-1.5 py-0.5 text-accent">public/rules.pdf</code> and rebuild / redeploy.
                </p>
              )}
            </div>
          )}
        </Card>
        <div>
          <KeyRulesCard />
        </div>
      </div>
    </div>
  );
}
