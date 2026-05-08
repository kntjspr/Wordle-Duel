import { useState } from 'react';
import type { GameMode } from '../types/game';
import { AnimatedBackground } from './AnimatedBackground';

interface Props {
  onStart: (name: string, mode: GameMode) => void;
}

export function LandingPage({ onStart }: Props) {
  const [name, setName] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [nameError, setNameError] = useState('');

  function handleMode(mode: GameMode) {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Enter your name to play'); return; }
    if (trimmed.length < 2) { setNameError('At least 2 characters'); return; }
    if (trimmed.length > 16) { setNameError('Max 16 characters'); return; }
    onStart(trimmed, mode);
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 z-10">
      <AnimatedBackground />

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="relative z-10 text-center mb-10 select-none">
        <div className="flex items-center justify-center gap-2 mb-3">
          {['W','O','R','D','L','E'].map((l, i) => (
            <div
              key={i}
              className={`tile w-12 h-12 text-xl font-black ${
                i === 0 ? 'tile-correct' :
                i === 2 ? 'tile-present' :
                i === 4 ? 'tile-correct' : 'tile-absent'
              } rounded-lg border-2 shadow-lg`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          {['D','U','E','L'].map((l, i) => (
            <div
              key={i}
              className={`tile w-11 h-11 text-lg font-black ${
                i % 2 === 0 ? 'tile-present' : 'tile-correct'
              } rounded-lg border-2 shadow-lg`}
            >
              {l}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm tracking-[0.3em] uppercase font-semibold"
           style={{ color: 'var(--color-muted-foreground)' }}>
          Real-time multiplayer word battle
        </p>
      </div>

      {/* ── Name input ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm mb-8">
        <label className="block text-xs uppercase tracking-widest font-semibold mb-2"
               style={{ color: 'var(--color-muted-foreground)' }}>
          Your Codename
        </label>
        <input
          type="text"
          maxLength={16}
          placeholder="Enter your name..."
          value={name}
          onChange={e => { setName(e.target.value); setNameError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleMode('online')}
          className="w-full px-4 py-3 rounded-xl border-2 font-bold text-base outline-none transition-all"
          style={{
            background: 'var(--color-card)',
            borderColor: nameError ? 'var(--color-destructive)' : 'var(--color-border)',
            color: 'var(--color-foreground)',
          }}
          autoFocus
        />
        {nameError && (
          <p className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-destructive)' }}>
            {nameError}
          </p>
        )}
      </div>

      {/* ── Mode buttons ───────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={() => handleMode('online')}
          className="group relative w-full py-4 rounded-xl font-black text-base uppercase tracking-widest
                     transition-all duration-200 overflow-hidden"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            boxShadow: '0 0 30px oklch(0.78 0.18 145 / 0.4)',
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Play Online
          </span>
        </button>

        <button
          onClick={() => handleMode('ai')}
          className="w-full py-4 rounded-xl font-black text-base uppercase tracking-widest
                     border-2 transition-all duration-200"
          style={{
            background: 'transparent',
            borderColor: 'var(--color-border)',
            color: 'var(--color-foreground)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              <circle cx="12" cy="16" r="1"/>
            </svg>
            VS AI
          </span>
        </button>

        <button
          onClick={() => setShowGuide(g => !g)}
          className="w-full py-3 rounded-xl text-sm font-semibold uppercase tracking-widest
                     transition-all duration-200"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {showGuide ? '▲ Hide Guide' : '? How to Play'}
        </button>
      </div>

      {/* ── How to play guide ──────────────────────────────────────── */}
      {showGuide && (
        <div
          className="relative z-10 mt-4 w-full max-w-sm rounded-2xl border-2 p-5 text-sm"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <h3 className="font-black text-base mb-4 uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>
            How to Play
          </h3>

          <div className="space-y-3" style={{ color: 'var(--color-muted-foreground)' }}>
            <p>Guess the <strong className="text-white">5-letter word</strong> in <strong className="text-white">5 attempts</strong>. Race against other players!</p>

            <div className="space-y-2 py-3 border-t border-b" style={{ borderColor: 'var(--color-border)' }}>
              <GuideRow letter="G" state="tile-correct" text="Right letter, right position → +2 pts" />
              <GuideRow letter="R" state="tile-present" text="Right letter, wrong position → +1 pt" />
              <GuideRow letter="X" state="tile-absent"  text="Letter not in the word → hidden from others" />
            </div>

            <ul className="space-y-1.5 list-disc list-inside">
              <li><strong className="text-white">First</strong> to guess the word <strong className="text-white">auto-wins</strong></li>
              <li>If nobody guesses, <strong className="text-white">highest score wins</strong></li>
              <li>You <strong className="text-white">cannot see</strong> others' gray tiles — stay sharp!</li>
              <li>Up to <strong className="text-white">5 players</strong> per lobby</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <p className="relative z-10 mt-8 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
        Your name is stored temporarily · Deleted after 24 hours
      </p>
    </div>
  );
}

function GuideRow({ letter, state, text }: { letter: string; state: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`tile ${state} w-8 h-8 text-sm font-black rounded-md border-2 shrink-0`}>{letter}</div>
      <span className="text-xs">{text}</span>
    </div>
  );
}
