import { useEffect, useRef, useState } from 'react';
import { Camera, X, ArrowLeft, Info, Loader2 } from 'lucide-react';
import { PixelIcon } from '../../ui/pixel-icons/PixelIcon';
import { HandCircle } from '../../ui/HandDrawn';
import { TOOL_ICONS } from '../../ui/icons';
import { RECOGNIZABLE_BY_KIND, RECOGNIZABLE_TOOLS, UI_EXAMPLES, checkGuess, handPickedInputs, type RecognitionKind, type StructuredGuess, type UncertainSpan } from '../../../data/recognitionSchema';
import { TOOLS } from '../../../data/tools';

export type { RecognitionKind };

export interface RecognitionResult {
  text: string;
  /** Present only when the reader is confident which tool and fields match. */
  structured?: StructuredGuess;
}

interface Props {
  kind: RecognitionKind;
  initialImage?: string | null;
  /** Places the problem in a tool. False when nothing recognizes it: the dialog stays open and asks which tool it's for. */
  onUse: (result: RecognitionResult) => boolean;
  onClose: () => void;
}

type Stage = 'source' | 'camera' | 'review';

const ANY_COPY = { label: 'The problem', placeholder: UI_EXAMPLES.importAny };

function copyFor(kind: RecognitionKind) {
  return RECOGNIZABLE_BY_KIND[kind] ?? ANY_COPY;
}

/** The reading cut into plain and unsure stretches, so each unsure stretch gets one circle, not one per character. */
function stretches(text: string, spans: UncertainSpan[]): { text: string; unsure: boolean }[] {
  const out: { text: string; unsure: boolean }[] = [];
  let at = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.end <= at) continue;
    if (s.start > at) out.push({ text: text.slice(at, s.start), unsure: false });
    out.push({ text: text.slice(Math.max(at, s.start), s.end), unsure: true });
    at = s.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), unsure: false });
  return out;
}

/** "Base 1: 4 · Height: 5", skipping blanks, in the tool's own words. */
function describeGuess(guess: StructuredGuess): string {
  const spec = RECOGNIZABLE_TOOLS.find((t) => t.type === guess.type)?.spec ?? {};
  return Object.entries(guess.inputs)
    .filter(([, value]) => value)
    .map(([field, value]) => `${spec[field]?.label ?? field}: ${value}`)
    .join('  ·  ');
}

/** Shrinks and re-encodes an image (any data: or blob: URL) before it's uploaded. */
async function resizeDataUrl(src: string, maxEdge = 1024): Promise<string> {
  const img = new Image();
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image failed to load'));
  });
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Problem import with an honest review step. A photo is sent to a reader (see
 * api/recognize.ts) that only transcribes the problem — it never solves it —
 * and the student always confirms (and can freely edit) before anything is
 * solved. A low-confidence or failed read just means more typing; it never
 * blocks the tool.
 */
export function RecognitionDialog({ kind, initialImage, onUse, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(initialImage ? 'review' : 'source');
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState('');
  /** The reader's own text, which the circled bits point into; `text` is the student's editable copy. */
  const [readText, setReadText] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<UncertainSpan[]>([]);
  const [structured, setStructured] = useState<StructuredGuess | null>(null);
  /** Nothing recognized the problem, so the student picks the tool. */
  const [unplaced, setUnplaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []);
  useEffect(() => {
    if (stage === 'review') textRef.current?.focus();
    if (stage === 'source') firstRef.current?.focus();
  }, [stage]);
  useEffect(() => {
    if (unplaced) pickRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [unplaced]);

  // Pasting an image anywhere while the dialog is open goes straight to review.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void loadImage(URL.createObjectURL(file));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // A screenshot pasted straight into an already-open tool arrives as an initial image.
  useEffect(() => {
    if (initialImage) void loadImage(initialImage);
  }, []);

  const recognizeImage = async (dataUrl: string) => {
    setReading(true);
    setReadError(null);
    setReadText('');
    setUncertain([]);
    setStructured(null);
    setUnplaced(false);
    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReadError(data?.error || "Couldn't read that photo. Type it in below.");
        return;
      }
      if (data.notMath) {
        setReadError("That doesn't look like a problem UJI knows. Type it in below.");
        return;
      }
      const read = typeof data.text === 'string' ? data.text : '';
      setText(read);
      setReadText(read);
      setUncertain(Array.isArray(data.uncertain) ? data.uncertain : []);
      // Checked again here, against this build's tools: an older or newer server can't open a tool wrong.
      setStructured(data.structured ? checkGuess(data.structured.type, data.structured.inputs, read) : null);
    } catch {
      setReadError("Couldn't reach the reader. Type it in below.");
    } finally {
      setReading(false);
    }
  };

  const loadImage = async (url: string) => {
    setError(null);
    setStage('review');
    try {
      const resized = await resizeDataUrl(url);
      setImage(resized);
      await recognizeImage(resized);
    } catch {
      setImage(url);
      setReadError("Couldn't load that image. Type the problem in below.");
    }
  };

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't use a camera here. Upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setStage('camera');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was declined. You can upload a photo instead.'
          : name === 'NotFoundError'
            ? "No camera found. Upload or paste an image instead."
            : "The camera didn't start. Upload or paste an image instead.",
      );
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    stopCamera();
    void loadImage(c.toDataURL('image/jpeg', 0.85));
  };

  const pasteFromClipboard = async () => {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          await loadImage(URL.createObjectURL(await item.getType(type)));
          return;
        }
        if (item.types.includes('text/plain')) {
          const t = await (await item.getType('text/plain')).text();
          setText(t.trim());
          setStage('review');
          return;
        }
      }
      setError('Nothing pasteable on the clipboard. Copy a screenshot first.');
    } catch {
      setError('The browser blocked clipboard access. Press Ctrl+V (⌘V) instead.');
    }
  };

  return (
    <div className="recog" role="dialog" aria-modal="true" aria-label="Import a problem" onKeyDown={(e) => e.key === 'Escape' && (stopCamera(), onClose())}>
      <header className="recog-head">
        {stage !== 'source' ? (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              stopCamera();
              setStage('source');
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        ) : (
          <strong>Bring in a problem</strong>
        )}
        <button
          type="button"
          className="btn btn-quiet btn-sm btn-icon"
          aria-label="Close import"
          onClick={() => {
            stopCamera();
            onClose();
          }}
        >
          <X size={15} />
        </button>
      </header>

      {stage === 'source' && (
        <div className="recog-sources">
          <button ref={firstRef} type="button" className="recog-source glisten" onClick={startCamera}>
            <PixelIcon name="camera" size={30} /> <span>Take a photo</span>
          </button>
          <button type="button" className="recog-source" onClick={() => fileRef.current?.click()}>
            <PixelIcon name="picture" size={30} /> <span>Upload an image</span>
          </button>
          <button type="button" className="recog-source" onClick={pasteFromClipboard}>
            <PixelIcon name="clipboard" size={30} /> <span>Paste a screenshot</span>
          </button>
          <button type="button" className="recog-source" onClick={() => setStage('review')}>
            <PixelIcon name="keyboard" size={30} /> <span>Paste or type text</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadImage(URL.createObjectURL(f));
              e.target.value = '';
            }}
          />
          <p className="recog-honest">
            <Info size={14} aria-hidden="true" /> A photo is sent to a reader to transcribe the problem. You'll always see — and can fix — what it
            read before anything is solved.
          </p>
        </div>
      )}

      {stage === 'camera' && (
        <div className="recog-camera">
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
          <div className="recog-row">
            <button type="button" className="btn btn-primary" onClick={capture}>
              <Camera size={15} /> Capture
            </button>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <form
          className="recog-review"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !onUse({ text: text.trim() })) setUnplaced(true);
          }}
        >
          {image && <img className="recog-image" src={image} alt="The problem you brought in" />}
          {reading && (
            <p className="recog-honest">
              <Loader2 size={14} className="spin" aria-hidden="true" /> Reading your photo…
            </p>
          )}
          {!reading && readError && (
            <p className="recog-honest">
              <Info size={14} aria-hidden="true" /> {readError}
            </p>
          )}
          {!reading && uncertain.length > 0 && (
            <div className="recog-reading">
              <span className="tag">UJI's best guess — check it</span>
              <div className="recog-reading-line">
                {stretches(readText, uncertain).map((s, i) =>
                  s.unsure ? (
                    <span key={i} className="recog-uncertain">
                      {s.text}
                      <HandCircle tone="coral" />
                    </span>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </div>
              {uncertain.map((u, i) => (
                <p key={i} className="hand recog-reading-note">
                  Not sure about “{readText.slice(u.start, u.end)}”. {u.note}
                </p>
              ))}
            </div>
          )}
          {!reading && structured && (
            <div className="recog-reading">
              <span className="tag tag-accent">Looks like: {TOOLS[structured.type]?.title ?? structured.type}</span>
              <p className="muted small">{describeGuess(structured)}</p>
              <div className="recog-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onUse({ text, structured })}>
                  Use this
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setStructured(null)}>
                  Let me check the text instead
                </button>
              </div>
            </div>
          )}
          <label className="field-label" htmlFor="recog-text">
            {copyFor(kind).label}
          </label>
          <input
            id="recog-text"
            ref={textRef}
            className="field field-math"
            value={text}
            placeholder={copyFor(kind).placeholder}
            onChange={(e) => {
              setText(e.target.value);
              setStructured(null);
              setUnplaced(false);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className="field-error">{error}</p>}
          <div className="recog-row">
            <span style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
              Use this problem
            </button>
          </div>
          {unplaced && (
            <div ref={pickRef} className="recog-pick" role="group" aria-label="Pick a tool for this problem">
              <p className="hand quick-unsure">Not sure which tool that is. Pick one:</p>
              <div className="quick-tools recog-pick-tools">
                {RECOGNIZABLE_TOOLS.map((t) => {
                  const I = TOOL_ICONS[t.type];
                  return (
                    <button
                      key={t.type}
                      type="button"
                      className="quick-tool"
                      title={TOOLS[t.type].description}
                      onClick={() => onUse({ text: text.trim(), structured: { type: t.type, inputs: handPickedInputs(t.type, text.trim()) } })}
                    >
                      <I size={26} />
                      <span>{TOOLS[t.type].title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      )}

      {error && stage !== 'review' && <p className="field-error recog-error">{error}</p>}
    </div>
  );
}
