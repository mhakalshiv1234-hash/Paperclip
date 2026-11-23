import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2, Volume2, VolumeX } from 'lucide-react';
import { PaperclipCharacter } from './components/PaperclipCharacter';
import type { ClipEmotion, FollowMode } from './types';
import { playDeskSound } from './utils/sound';

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

const EMOTION_LABEL: Record<ClipEmotion, string> = {
  calm: 'Calm',
  annoyed: 'Annoyed',
  angry: 'Angry',
  sad: 'Sad',
  crying: 'Crying',
  happy: 'Happy',
};

function getContextThought(
  nextEmotion: ClipEmotion,
  prevEmotion: ClipEmotion,
  taps: number
): string {
  switch (nextEmotion) {
    case 'annoyed':
      return 'Hey! Watch the wire, that poke startled me.';
    case 'angry':
      return taps === 2
        ? 'Seriously, stop tapping me!'
        : 'Keep hitting me and I am going to bend out of shape!';
    case 'sad':
      return 'Ouch… why are you being so rough with me?';
    case 'crying':
      return taps <= 5
        ? 'Please stop beating me… that really hurts.'
        : 'My steel wire cannot take much more…';
    case 'happy':
      if (prevEmotion === 'crying' || prevEmotion === 'sad') {
        return 'Aww, you waved! Thank you for cheering me up!';
      }
      if (prevEmotion === 'angry' || prevEmotion === 'annoyed') {
        return 'Okay, okay—seeing you wave makes it hard to stay mad!';
      }
      return 'Hey there! Love seeing you wave back!';
    case 'calm':
    default:
      if (prevEmotion === 'crying' || prevEmotion === 'sad' || prevEmotion === 'angry') {
        return 'Taking a deep breath… feeling calmer now.';
      }
      if (prevEmotion === 'happy') {
        return 'Still in a pretty good mood.';
      }
      return '';
  }
}

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pipStageRef = useRef<HTMLDivElement | null>(null);
  const tapCountRef = useRef(0);
  const emotionRef = useRef<ClipEmotion>('calm');
  const tapResetTimerRef = useRef<number | null>(null);
  const happyCooldownTimerRef = useRef<number | null>(null);
  const thoughtHideTimerRef = useRef<number | null>(null);

  const [followMode, setFollowMode] = useState<FollowMode>('float');
  const [emotion, setEmotion] = useState<ClipEmotion>('calm');
  const [emotionTriggerKey, setEmotionTriggerKey] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [thoughtText, setThoughtText] = useState('');
  const [showThought, setShowThought] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipNotice, setPipNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (tapResetTimerRef.current) window.clearTimeout(tapResetTimerRef.current);
      if (happyCooldownTimerRef.current) window.clearTimeout(happyCooldownTimerRef.current);
      if (thoughtHideTimerRef.current) window.clearTimeout(thoughtHideTimerRef.current);
    };
  }, []);

  const triggerThought = useCallback((text: string, durationMs = 3600) => {
    if (!text) return;
    if (thoughtHideTimerRef.current) {
      window.clearTimeout(thoughtHideTimerRef.current);
    }
    setThoughtText(text);
    setShowThought(true);
    thoughtHideTimerRef.current = window.setTimeout(() => {
      setShowThought(false);
    }, durationMs);
  }, []);

  const handleTapClip = useCallback(() => {
    if (happyCooldownTimerRef.current) {
      window.clearTimeout(happyCooldownTimerRef.current);
      happyCooldownTimerRef.current = null;
    }
    if (tapResetTimerRef.current) {
      window.clearTimeout(tapResetTimerRef.current);
    }

    const prevEmotion = emotionRef.current;
    const next = tapCountRef.current + 1;
    tapCountRef.current = next;
    setTapCount(next);

    let nextEmotion: ClipEmotion = 'annoyed';
    if (next === 1) {
      nextEmotion = 'annoyed';
      playDeskSound('tap', soundEnabled);
    } else if (next <= 3) {
      nextEmotion = 'angry';
      playDeskSound('anger', soundEnabled);
    } else if (next === 4) {
      nextEmotion = 'sad';
      playDeskSound('sad', soundEnabled);
    } else {
      nextEmotion = 'crying';
      playDeskSound('cry', soundEnabled);
    }

    emotionRef.current = nextEmotion;
    setEmotion(nextEmotion);
    setEmotionTriggerKey((k) => k + 1);
    triggerThought(getContextThought(nextEmotion, prevEmotion, next), 4000);

    tapResetTimerRef.current = window.setTimeout(() => {
      const beforeCalm = emotionRef.current;
      tapCountRef.current = 0;
      emotionRef.current = 'calm';
      setTapCount(0);
      setEmotion('calm');
      triggerThought(getContextThought('calm', beforeCalm, 0), 3000);
    }, 14000);
  }, [soundEnabled, triggerThought]);

  const handleWaveDetected = useCallback(() => {
    if (tapResetTimerRef.current) {
      window.clearTimeout(tapResetTimerRef.current);
      tapResetTimerRef.current = null;
    }
    if (happyCooldownTimerRef.current) {
      window.clearTimeout(happyCooldownTimerRef.current);
    }

    const prevEmotion = emotionRef.current;
    tapCountRef.current = 0;
    emotionRef.current = 'happy';
    setTapCount(0);
    setEmotion('happy');
    setEmotionTriggerKey((k) => k + 1);
    playDeskSound('happy', soundEnabled);
    triggerThought(getContextThought('happy', prevEmotion, 0), 3800);

    happyCooldownTimerRef.current = window.setTimeout(() => {
      const beforeCalm = emotionRef.current;
      emotionRef.current = 'calm';
      setEmotion('calm');
      triggerThought(getContextThought('calm', beforeCalm, 0), 2600);
    }, 4500);
  }, [soundEnabled, triggerThought]);

  const handleToggleFloatingWindow = async () => {
    setPipNotice(null);

    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    if (!window.documentPictureInPicture?.requestWindow) {
      setPipNotice(
        'Always-on-top desktop pop-out requires Chrome or Edge in a standalone tab; Clip floats freely here.'
      );
      return;
    }

    try {
      const win = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 360,
      });

      // Mirror stylesheets into the floating PiP window
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          if (sheet.cssRules) {
            const style = win.document.createElement('style');
            style.textContent = Array.from(sheet.cssRules)
              .map((r) => r.cssText)
              .join('\n');
            win.document.head.appendChild(style);
          }
        } catch {
          if (sheet.href) {
            const link = win.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            win.document.head.appendChild(link);
          }
        }
      });

      win.document.title = 'Clip — Floating Companion';
      win.document.body.className =
        'paper-desk-grid m-0 flex h-screen w-screen flex-col items-center justify-center overflow-hidden select-none';

      const container = win.document.createElement('div');
      container.className = 'relative flex h-full w-full items-center justify-center overflow-hidden';
      win.document.body.appendChild(container);
      pipStageRef.current = container;

      win.addEventListener('pagehide', () => {
        pipStageRef.current = null;
        setPipWindow(null);
      });

      setPipWindow(win);
    } catch {
      setPipNotice(
        'Pop-out window is blocked inside embedded preview frames — open in a new browser tab to float above all windows.'
      );
    }
  };

  return (
    <div className="paper-desk-grid flex h-screen w-screen flex-col overflow-hidden select-none">
      {/* Minimal Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-6 px-6 py-4">
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Clip
        </span>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-xs backdrop-blur-xs">
          {(
            [
              { id: 'float', label: 'Float & Roam' },
              { id: 'chase', label: 'Follow Cursor' },
              { id: 'watch', label: 'Stay & Watch' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFollowMode(opt.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                followMode === opt.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleFloatingWindow}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              pipWindow
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white/90 text-slate-700 hover:text-slate-900'
            }`}
          >
            <PictureInPicture2 className="h-3.5 w-3.5" />
            {pipWindow ? 'Dock Back' : 'Pop Out Window'}
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-600 hover:text-slate-900 transition-colors shrink-0"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Full-Window Floating Stage */}
      <main
        ref={stageRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        {pipWindow && pipStageRef.current ? (
          <>
            <p className="text-xs text-slate-500">
              Clip is floating in an always-on-top window ·{' '}
              <button
                type="button"
                onClick={() => {
                  pipWindow.close();
                  setPipWindow(null);
                }}
                className="font-medium text-blue-600 hover:underline"
              >
                Return him here
              </button>
            </p>
            {createPortal(
              <PaperclipCharacter
                emotion={emotion}
                emotionTriggerKey={emotionTriggerKey}
                thoughtText={thoughtText}
                showThought={showThought}
                followMode={followMode}
                stageRef={pipStageRef}
                onTapClip={handleTapClip}
                onWaveDetected={handleWaveDetected}
              />,
              pipStageRef.current
            )}
          </>
        ) : (
          <PaperclipCharacter
            emotion={emotion}
            emotionTriggerKey={emotionTriggerKey}
            thoughtText={thoughtText}
            showThought={showThought}
            followMode={followMode}
            stageRef={stageRef}
            onTapClip={handleTapClip}
            onWaveDetected={handleWaveDetected}
          />
        )}
      </main>

      {/* Quiet Unboxed Status Line */}
      <footer className="relative z-10 flex flex-col items-center gap-1 pb-5 pt-2 px-4 text-xs text-slate-500 text-center">
        {pipNotice && <p className="text-amber-700">{pipNotice}</p>}
        <div className="flex items-center justify-center gap-2">
          <span className="font-medium text-slate-700">{EMOTION_LABEL[emotion]}</span>
          <span aria-hidden="true">·</span>
          <span>
            {emotion === 'crying' || emotion === 'sad' || emotion === 'angry'
              ? 'Wave cursor back and forth to cheer him up'
              : tapCount > 0
                ? 'Keep tapping to provoke, or wave to make him happy'
                : 'Drag Clip anywhere on the window · Tap to provoke · Wave to cheer up'}
          </span>
        </div>
      </footer>
    </div>
  );
}
