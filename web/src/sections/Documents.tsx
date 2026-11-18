import { useState } from 'react';
import { call, twala } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { fileToBase64 } from '../pdf';
import { Card, EnvelopePicker, download, randomId, Section, useAction, useApp, useLoad } from '../ui';

export function DocumentsSection() {
  const { envelopeId, version, changed, account } = useApp();
  const docs = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}/documents', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const envelope = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const [file, setFile] = useState<File | null>(null);
  const { run, busy, error } = useAction();
  const isDraft = envelope.data?.status === 'draft';
  const done = () => (docs.reload(), changed());

  const get = (documentId: string) =>
    run(async () => {
      download((await call(twala.GET('/envelopes/{envelope_id}/documents/{document_id}', { params: { path: { envelope_id: envelopeId!, document_id: documentId } } }))).url);
    });

  const add = () =>
    run(async () => {
      const documentBase64 = await fileToBase64(file!);
      await call(twala.POST('/envelopes/{envelope_id}/documents', { params: { path: { envelope_id: envelopeId! } }, body: { documents: [{ documentId: randomId('doc'), name: file!.name, documentBase64 }] } }));
      setFile(null);
      done();
    });

  return (
    <Section
      title="Documents"
      intro="List an envelope's documents, download the original or the signed copy, and add or remove documents on a draft."
      calls={['GET /envelopes/{id}/documents', 'GET /envelopes/{id}/documents/{documentId}', 'POST /envelopes/{id}/documents', 'DELETE /envelopes/{id}/documents/{documentId}']}
      limits={`up to ${account?.limits.documentsPerEnvelope ?? 'a few'} documents per envelope, ${Math.round((account?.limits.fileSizeBytes ?? 0) / 1048576)} MB each. Adding and removing work only on drafts.`}
    >
      <EnvelopePicker />
      {envelopeId && (
        <Card title="Documents" actions={<button className="link" onClick={docs.reload}>Refresh</button>}>
          <ErrorNotice error={docs.error} />
          {docs.data?.map((d) => (
            <div key={d.documentIdGuid} className="line">
              <span><strong>{d.name}</strong> <span className="muted small">· {d.documentId} · {d.sealed ? 'signed copy' : 'original'} · {Math.ceil((d.sizeBytes ?? 0) / 1024)} KB</span></span>
              <span className="head-actions">
                <button className="link small" disabled={busy} onClick={() => get(d.documentId ?? d.documentIdGuid)}>Download</button>
                {isDraft && (
                  <button className="link small" disabled={busy} onClick={() => run(async () => (await call(twala.DELETE('/envelopes/{envelope_id}/documents/{document_id}', { params: { path: { envelope_id: envelopeId, document_id: d.documentId ?? d.documentIdGuid } } })), done()))}>Remove</button>
                )}
              </span>
            </div>
          ))}
          {isDraft && (
            <div className="inline-form">
              <input key={docs.data?.length} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button className="btn" disabled={busy || !file} onClick={add}>Add PDF</button>
            </div>
          )}
          <p className="muted small">Download asks Twala for a short-lived link to the file, then follows it.</p>
          <ErrorNotice error={error} />
        </Card>
      )}
    </Section>
  );
}
