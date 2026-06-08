'use client';

import { useEffect, useRef, useState } from 'react';
import LogoBlur from '@/components/LogoBlur';

const MICHROMA = 'var(--font-michroma), sans-serif';
const SYS_WIDTH = 'min(696px, 100%)';
const BUBBLE_FONT = 'clamp(0.85rem, 1.4vw, 1.25rem)';

const sysBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '26px 26px 26px 0px',
  padding: '24px 40px',
  fontFamily: MICHROMA,
  fontSize: BUBBLE_FONT,
  lineHeight: 1.45,
  color: 'rgba(255,255,255,0.72)',
};

function SystemBubble({ children, width = SYS_WIDTH }: { children: React.ReactNode; width?: string }) {
  return (
    <div className="echo-rise" style={{ alignSelf: 'flex-start', width, ...sysBox }}>
      {children}
    </div>
  );
}

function UserBubble({ children, placeholder }: { children: React.ReactNode; placeholder?: boolean }) {
  return (
    <div
      className="echo-rise"
      style={{
        alignSelf: 'flex-end',
        maxWidth: '90%',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '26px 26px 0px 26px',
        padding: '22px 36px',
        fontFamily: MICHROMA,
        fontSize: BUBBLE_FONT,
        lineHeight: 1.45,
        color: placeholder ? 'rgba(255,255,255,0.35)' : '#ffffff',
      }}
    >
      {children}
    </div>
  );
}

function TypingBubble() {
  return (
    <div
      className="echo-rise"
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        ...sysBox,
        padding: '22px 30px',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="echo-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

const stroke = (s: string, w = 2) => ({
  fill: 'none',
  stroke: s,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});
const UploadIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" {...stroke('rgba(255,255,255,0.7)')} aria-hidden>
    <path d="M12 15V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);
const ImageIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" {...stroke('rgba(255,255,255,0.55)', 1.5)} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" {...stroke('#ffffff', 3)} aria-hidden>
    <path d="M5 12l4 4 10-10" />
  </svg>
);
const ReplaceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...stroke('currentColor')} aria-hidden>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...stroke('currentColor', 2.4)} aria-hidden>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const YEAR_OPTIONS = ['<1', '1-5', '5-10', '10+'];

export default function MemoryScreen({
  onBegin,
}: {
  onBegin?: (data: { name: string; photoUrl: string | null }) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ name?: string; years?: string; feeling?: string }>({});
  const [draft, setDraft] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const thinkTimer = useRef<number | null>(null);

  const name = answers.name?.trim() || 'her';

  useEffect(() => () => {
    if (thinkTimer.current) clearTimeout(thinkTimer.current);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [current, fileName, thinking]);

  const THINK_MS = 2000;
  const advance = (next: number) => {
    setThinking(true);
    thinkTimer.current = window.setTimeout(() => {
      setThinking(false);
      setCurrent(next);
    }, THINK_MS);
  };

  const submitText = (id: 'name' | 'feeling', next: number) => {
    const v = draft.trim();
    if (!v || thinking) return;
    setAnswers((a) => ({ ...a, [id]: v }));
    setDraft('');
    advance(next);
  };

  const pick = (f?: File | null) => {
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileName(f.name);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const answerInput = (id: 'name' | 'feeling', next: number) => (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submitText(id, next);
      }}
      placeholder="Type your answer"
      className="echo-rise echo-answer-input"
      style={{
        alignSelf: 'flex-end',
        width: 'min(440px, 86%)',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '26px 26px 0px 26px',
        padding: '22px 36px',
        fontFamily: MICHROMA,
        fontSize: BUBBLE_FONT,
        color: '#ffffff',
        caretColor: '#ffffff',
        outline: 'none',
      }}
    />
  );

  return (
    <div
      className="absolute inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(19,19,19,0.92)' }}
    >
      <div
        className="sticky top-0 z-20 flex w-full justify-center"
        style={{
          paddingTop: '40px',
          paddingBottom: '48px',
          background:
            'linear-gradient(to bottom, rgba(19,19,19,0.97) 0%, rgba(19,19,19,0.97) 45%, rgba(19,19,19,0) 100%)',
        }}
      >
        <LogoBlur text="ECHO" fontMin={28.8} fontVw={0.045} fontMax={57.6} blur={6} circleSize={0.7} />
      </div>

      <div className="mx-auto w-full max-w-[1150px] px-6 pb-28 pt-4">
        <p
          style={{
            fontFamily: MICHROMA,
            fontSize: 'clamp(1rem, 1.85vw, 26.684px)',
            color: 'rgba(255,255,255,0.62)',
            marginBottom: '2.75rem',
          }}
        >
          To give the best results, Can I ask a few things?
        </p>

        <div className="flex flex-col gap-10">
          <SystemBubble>What was your dog&apos;s name?</SystemBubble>
          {answers.name ? <UserBubble>{answers.name}</UserBubble> : answerInput('name', 1)}

          {current >= 1 && (
            <div style={{ alignSelf: 'flex-start', width: SYS_WIDTH, position: 'relative', marginBottom: '28px' }} className="echo-rise">
              <div style={sysBox}>How many years did you spend together?</div>
              <div
                style={{
                  position: 'absolute',
                  left: '40px',
                  top: '100%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {YEAR_OPTIONS.map((opt) => {
                  const active = opt === answers.years;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={active ? undefined : 'echo-chip'}
                      onClick={() => {
                        if (thinking) return;
                        setAnswers((a) => ({ ...a, years: opt }));
                        if (current === 1) advance(2);
                      }}
                      style={{
                        minWidth: '92px',
                        height: '49px',
                        padding: '0 20px',
                        borderRadius: '32px',
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: active ? '#ffffff' : '#131313',
                        color: active ? '#121212' : '#ffffff',
                        fontFamily: MICHROMA,
                        fontSize: 'clamp(0.8rem, 1.1vw, 1.05rem)',
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {current >= 2 && (
            <>
              <SystemBubble>
                What&apos;s a sound, word, or smell that brings {name} right back to you?
              </SystemBubble>
              {answers.feeling ? <UserBubble>{answers.feeling}</UserBubble> : answerInput('feeling', 3)}
            </>
          )}

          {current >= 3 && (
            <>
              <SystemBubble width="min(793px, 100%)">
                Now — show me {name}&apos;s face.
                <br />
                This is the heart of the memory. Upload one clear photo so I can
                carry it through everything I make for you.
              </SystemBubble>

              {!fileName ? (
                <div
                  className="echo-rise"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pick(e.dataTransfer.files?.[0]);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    width: 'min(788px, 100%)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '20px',
                    padding: '26px 30px',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-center gap-9">
                    <div
                      className="grid place-items-center"
                      style={{ width: '86px', height: '86px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)' }}
                    >
                      <UploadIcon />
                    </div>
                    <span style={{ fontFamily: MICHROMA, fontSize: BUBBLE_FONT, color: 'rgba(255,255,255,0.62)' }}>
                      Drag her photo here
                    </span>
                    <button
                      type="button"
                      className="echo-cta"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: '1px solid rgba(255,255,255,0.6)',
                        borderRadius: '25px',
                        padding: '10px 33px',
                        background: 'transparent',
                        color: '#ffffff',
                        fontFamily: MICHROMA,
                        fontSize: BUBBLE_FONT,
                        cursor: 'pointer',
                      }}
                    >
                      Browse Files
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="echo-rise"
                  style={{
                    alignSelf: 'flex-start',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '20px',
                    padding: '30px 36px',
                  }}
                >
                  <div className="flex items-center gap-10">
                    <div
                      style={{ position: 'relative', width: '120px', height: '124px', borderRadius: '10px', background: '#2a2a2a', overflow: 'hidden', flex: 'none' }}
                      className="grid place-items-center"
                    >
                      {previewUrl ? (
                        <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon />
                      )}
                      <span
                        className="grid place-items-center"
                        style={{ position: 'absolute', right: '7px', bottom: '7px', width: '22px', height: '22px', borderRadius: '50%', background: '#000000' }}
                      >
                        <CheckIcon />
                      </span>
                    </div>
                    <div className="flex flex-col items-start gap-4">
                      <span style={{ fontFamily: MICHROMA, fontSize: 'clamp(1.1rem, 1.7vw, 1.6rem)', color: '#ffffff' }}>{fileName}</span>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(255,255,255,0.42)',
                          fontFamily: MICHROMA,
                          fontSize: 'clamp(0.8rem, 1.1vw, 1.05rem)',
                        }}
                      >
                        <ReplaceIcon />
                        replace
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />

          {fileName && (
            <div
              className="echo-rise"
              style={{
                alignSelf: 'center',
                width: 'min(991px, 100%)',
                marginTop: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '24px',
                border: '1.5px solid rgba(255,255,255,0.75)',
                borderRadius: '30px',
                padding: '22px 28px 22px 44px',
              }}
            >
              <span style={{ fontFamily: MICHROMA, fontSize: 'clamp(1.05rem, 1.9vw, 1.85rem)', color: '#ffffff' }}>
                Create {name}&apos;s echo
              </span>
              <button
                type="button"
                className="echo-primary"
                onClick={() => onBegin?.({ name, photoUrl: previewUrl })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#ffffff',
                  color: '#111111',
                  border: 'none',
                  borderRadius: '81px',
                  padding: '14px 30px',
                  fontFamily: MICHROMA,
                  fontSize: 'clamp(1rem, 1.5vw, 1.4rem)',
                  cursor: 'pointer',
                }}
              >
                Begin
                <ArrowIcon />
              </button>
            </div>
          )}

          {thinking && <TypingBubble />}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
