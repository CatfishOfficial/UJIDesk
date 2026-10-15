import { useEffect, useRef, useState } from 'react';
import { Camera, X, ArrowLeft, Info, Wand2 } from 'lucide-react';
import { PixelIcon } from '../../ui/pixel-icons/PixelIcon';
import { HandCircle } from '../../ui/HandDrawn';

export type RecognitionKind =
  | 'equation'
  | 'points'
  | 'any'
  | 'nuclear'
  | 'pointSlope'
  | 'system'
  | 'quadratic'
  | 'factoring'
  | 'pythag'
  | 'area'
  | 'trig'
  | 'list'
  | 'sequence';

interface Props {
  kind: RecognitionKind;
  initialImage?: string | null;
  onUse: (text: string) => void;
  onClose: () => void;
}

type Stage = 'source' | 'camera' | 'review';

/** What each tool expects to read, and a clearly labelled demo reading with one uncertain character. */
const KINDS: Record<RecognitionKind, { label: string; placeholder: string; demo: { text: string; uncertain: number; note: string } }> = {
  equation: { label: 'The equation', placeholder: '3x + 4y = 12', demo: { text: '3x + 4y = 12', uncertain: 5, note: 'The "4" could also be a "9".' } },
  points: { label: 'The two points', placeholder: '(2, 3) and (4, 7)', demo: { text: '(2, 3) and (4, 7)', uncertain: 15, note: 'The "7" could also be a "1".' } },
  any: { label: 'The problem', placeholder: '3x + 4y = 12, or (2, 3) and (4, 7)', demo: { text: '3x + 4y = 12', uncertain: 5, note: 'The "4" could also be a "9".' } },
  nuclear: { label: 'The nuclide and decay', placeholder: 'Po-210 alpha decay', demo: { text: 'Po-210 alpha decay', uncertain: 4, note: 'The "1" could also be a "7".' } },
  pointSlope: { label: 'The point and slope', placeholder: '(2, 3), slope 4', demo: { text: '(2, 3), slope 4', uncertain: 14, note: 'The "4" could also be a "9".' } },
  system: { label: 'The two equations', placeholder: '2x + 3y = 12, x − y = 1', demo: { text: '2x + 3y = 12, x - y = 1', uncertain: 5, note: 'The "3" could also be an "8".' } },
  quadratic: { label: 'The equation', placeholder: 'x² − 5x + 6 = 0', demo: { text: 'x^2 - 5x + 6 = 0', uncertain: 6, note: 'The "5" could also be an "S".' } },
  factoring: { label: 'The expression', placeholder: 'x² + 5x + 6', demo: { text: '2x^2 + 7x + 3', uncertain: 6, note: 'The "7" could also be a "1".' } },
  pythag: { label: 'The sides', placeholder: 'legs 3 and 4', demo: { text: 'legs 5 and 12', uncertain: 10, note: 'The "12" could also be "17".' } },
  area: { label: 'The shape and sizes', placeholder: 'circle with radius 5 cm', demo: { text: 'rectangle 6 by 4 cm', uncertain: 10, note: 'The "6" could also be a "b".' } },
  trig: { label: 'The angle and side', placeholder: 'angle 35°, hypotenuse 10', demo: { text: 'angle 35°, hypotenuse 10', uncertain: 6, note: 'The "3" could also be an "8".' } },
  list: { label: 'The numbers', placeholder: '3, 7, 7, 2, 9', demo: { text: '3, 7, 7, 2, 9', uncertain: 3, note: 'The "7" could also be a "1".' } },
  sequence: { label: 'The terms', placeholder: '3, 7, 11, 15, …', demo: { text: '3, 7, 11, 15', uncertain: 6, note: 'The "11" could also be "17".' } },
};

const DEMO = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.demo])) as Record<RecognitionKind, (typeof KINDS)[RecognitionKind]['demo']>;

/**
 * Problem import with an honest review step. Nothing here claims to read the
 * image: in this prototype recognition isn't connected, so the student types
 * (or loads a clearly-labelled demo reading) and confirms before solving.
 * The recognizer would plug in at `recognize()` later.
 */
export function RecognitionDialog({ kind, initialImage, onUse, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(initialImage ? 'review' : 'source');
  const [image, setImage] = useState<string | null>(initialImage ?? null);
  const [text, setText] = useState('');
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []);
  useEffect(() => {
    if (stage === 'review') textRef.current?.focus();
    if (stage === 'source') firstRef.current?.focus();
  }, [stage]);

  // Pasting an image anywhere while the dialog is open goes straight to review.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        loadImage(URL.createObjectURL(file));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const loadImage = (url: string) => {
    setImage(url);
    setStage('review');
    setError(null);
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
    loadImage(c.toDataURL('image/jpeg', 0.85));
  };

  const pasteFromClipboard = async () => {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          loadImage(URL.createObjectURL(await item.getType(type)));
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

  const useDemo = () => {
    setText(DEMO[kind].text);
    setDemo(true);
  };

  const demoInfo = DEMO[kind];

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
          <button ref={firstRef} type="button" className="recog-source" onClick={startCamera}>
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
              if (f) loadImage(URL.createObjectURL(f));
              e.target.value = '';
            }}
          />
          <p className="recog-honest">
            <Info size={14} aria-hidden="true" /> Automatic reading of photos isn't connected in this prototype yet. You'll confirm the problem
            yourself before anything is solved.
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
            if (text.trim()) onUse(text.trim());
          }}
        >
          {image && <img className="recog-image" src={image} alt="The problem you brought in" />}
          {image && !text && (
            <p className="recog-honest">
              <Info size={14} aria-hidden="true" /> Recognition isn't wired up yet, so UJI can't read this image. Type what it says below.
            </p>
          )}
          {demo && (
            <div className="recog-reading">
              <span className="tag">Demo reading, not real recognition</span>
              <div className="recog-reading-line">
                {demoInfo.text.split('').map((ch, i) =>
                  i === demoInfo.uncertain ? (
                    <span key={i} className="recog-uncertain">
                      {ch}
                      <HandCircle tone="coral" />
                    </span>
                  ) : (
                    <span key={i}>{ch}</span>
                  ),
                )}
              </div>
              <p className="hand recog-reading-note">Not sure about the circled bit. {demoInfo.note}</p>
            </div>
          )}
          <label className="field-label" htmlFor="recog-text">
            {KINDS[kind].label}
          </label>
          <input
            id="recog-text"
            ref={textRef}
            className="field field-math"
            value={text}
            placeholder={KINDS[kind].placeholder}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className="field-error">{error}</p>}
          <div className="recog-row">
            {image && !demo && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={useDemo} title="Shows how an uncertain reading would be reviewed">
                <Wand2 size={14} /> Try a demo reading
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
              Use this problem
            </button>
          </div>
        </form>
      )}

      {error && stage !== 'review' && <p className="field-error recog-error">{error}</p>}
    </div>
  );
}
