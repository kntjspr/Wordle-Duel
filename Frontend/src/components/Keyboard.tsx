import type { KeyState } from '../types/game';

interface Props {
  keyStates: KeyState;
  onLetter: (letter: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['Enter','z','x','c','v','b','n','m','⌫'],
];

export function Keyboard({ keyStates, onLetter, onDelete, onEnter, disabled }: Props) {
  function handleKey(key: string) {
    if (disabled) return;
    if (key === '⌫') onDelete();
    else if (key === 'Enter') onEnter();
    else onLetter(key);
  }

  return (
    <div className="flex flex-col gap-1.5 select-none">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {row.map(key => {
            const state = key.length === 1 ? (keyStates[key] ?? 'unused') : 'unused';
            return (
              <Key
                key={key}
                label={key}
                state={state as string}
                onPress={() => handleKey(key)}
                disabled={disabled}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Key({
  label, state, onPress, disabled,
}: {
  label: string;
  state: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const isWide = label === 'Enter' || label === '⌫';

  const bg = (() => {
    switch (state) {
      case 'correct': return 'var(--correct)';
      case 'present': return 'var(--present)';
      case 'absent':  return 'var(--absent)';
      default:        return 'var(--color-secondary)';
    }
  })();

  const textColor = (() => {
    switch (state) {
      case 'correct':
      case 'present':
      case 'absent':  return 'white';
      default:        return 'var(--color-secondary-foreground)';
    }
  })();

  return (
    <button
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      disabled={disabled}
      className="rounded-lg font-black text-sm uppercase tracking-wide transition-all duration-100
                 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: bg,
        color: textColor,
        minWidth: isWide ? '4rem' : '2.1rem',
        height: '3.2rem',
        fontSize: isWide ? '0.65rem' : '0.85rem',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}
