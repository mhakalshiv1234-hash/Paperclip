import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { ThoughtBubble } from './ThoughtBubble';
import type { ClipEmotion, FollowMode } from '../types';

interface PaperclipCharacterProps {
  emotion: ClipEmotion;
  emotionTriggerKey: number;
  thoughtText: string;
  showThought: boolean;
  followMode: FollowMode;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onTapClip: () => void;
  onWaveDetected: () => void;
}

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export const PaperclipCharacter: React.FC<PaperclipCharacterProps> = ({
  emotion,
  emotionTriggerKey,
  thoughtText,
  showThought,
  followMode,
  stageRef,
  onTapClip,
  onWaveDetected,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isNearCursor, setIsNearCursor] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const wasNearRef = useRef(false);
  const bounceTimerRef = useRef<number | null>(null);
  const waveSamplesRef = useRef<PointerSample[]>([]);
  const lastWaveTriggerRef = useRef<number>(0);

  // Floating position, velocity, and drag state
  const floatStateRef = useRef({
    x: 0,
    y: 0,
    vx: 0.45,
    vy: 0.3,
    dragging: false,
    movedDuringPress: false,
    dragStartClientX: 0,
    dragStartClientY: 0,
    startX: 0,
    startY: 0,
    lastClientX: 0,
    lastClientY: 0,
  });

  // Smooth spring-driven stage position (relative to stage center)
  const rawPosX = useMotionValue(0);
  const rawPosY = useMotionValue(0);
  const posX = useSpring(rawPosX, { stiffness: 120, damping: 17, mass: 0.8 });
  const posY = useSpring(rawPosY, { stiffness: 120, damping: 17, mass: 0.8 });

  // Subtle velocity-responsive lean & tilt toward movement
  const rawLeanRotate = useMotionValue(0);
  const rawLeanSkew = useMotionValue(0);
  const leanRotate = useSpring(rawLeanRotate, { stiffness: 200, damping: 18 });
  const leanSkew = useSpring(rawLeanSkew, { stiffness: 180, damping: 18 });

  // Proximity nudge & elastic squash-and-stretch bounce physics
  const rawNudgeX = useMotionValue(0);
  const rawNudgeY = useMotionValue(0);
  const rawNudgeRotate = useMotionValue(0);
  const rawBounceScaleX = useMotionValue(1);
  const rawBounceScaleY = useMotionValue(1);

  const nudgeX = useSpring(rawNudgeX, { stiffness: 280, damping: 16, mass: 0.65 });
  const nudgeY = useSpring(rawNudgeY, { stiffness: 280, damping: 16, mass: 0.65 });
  const nudgeRotate = useSpring(rawNudgeRotate, { stiffness: 260, damping: 15 });
  const bounceScaleX = useSpring(rawBounceScaleX, { stiffness: 460, damping: 13 });
  const bounceScaleY = useSpring(rawBounceScaleY, { stiffness: 460, damping: 13 });

  // 60fps smooth eye pupil tracking
  const rawPupilX = useMotionValue(0);
  const rawPupilY = useMotionValue(0);
  const pupilX = useSpring(rawPupilX, { stiffness: 420, damping: 28 });
  const pupilY = useSpring(rawPupilY, { stiffness: 420, damping: 28 });

  // Reset center cleanly when switching to watch mode
  useEffect(() => {
    if (followMode === 'watch') {
      floatStateRef.current.x = 0;
      floatStateRef.current.y = 0;
      rawPosX.set(0);
      rawPosY.set(0);
      rawLeanRotate.set(0);
      rawLeanSkew.set(0);
    }
  }, [followMode, rawPosX, rawPosY, rawLeanRotate, rawLeanSkew]);

  // Continuous weightless floating loop in 'float' mode
  useEffect(() => {
    if (followMode !== 'float') return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let rafId = 0;
    const step = (time: number) => {
      const state = floatStateRef.current;
      const stageEl = stageRef.current;

      if (!state.dragging && stageEl) {
        const rect = stageEl.getBoundingClientRect();
        const padX = Math.max(40, rect.width / 2 - 105);
        const maxBottomY = Math.max(40, rect.height / 2 - 115);
        const maxTopY = Math.max(30, rect.height / 2 - 165);

        const speedScale =
          emotion === 'angry'
            ? 1.7
            : emotion === 'happy'
              ? 1.25
              : emotion === 'sad' || emotion === 'crying'
                ? 0.45
                : 0.9;

        // Dampen throw momentum gently toward comfortable cruise speed
        const maxCruise = 0.75 * speedScale;
        const speed = Math.hypot(state.vx, state.vy);
        if (speed > maxCruise * 1.6) {
          state.vx *= 0.96;
          state.vy *= 0.96;
        }

        state.x += state.vx * speedScale;
        state.y += state.vy * speedScale;

        // Soft edge bounce within the window
        if (state.x > padX) {
          state.x = padX;
          state.vx = -Math.abs(state.vx || 0.45);
        } else if (state.x < -padX) {
          state.x = -padX;
          state.vx = Math.abs(state.vx || 0.45);
        }

        if (state.y > maxBottomY) {
          state.y = maxBottomY;
          state.vy = -Math.abs(state.vy || 0.3);
        } else if (state.y < -maxTopY) {
          state.y = -maxTopY;
          state.vy = Math.abs(state.vy || 0.3);
        }

        // Gentle zero-gravity sinusoidal buoyancy
        const bobX = Math.cos(time * 0.0011) * 7;
        const bobY = Math.sin(time * 0.0017) * 11;

        rawPosX.set(state.x + bobX);
        rawPosY.set(state.y + bobY);
        rawLeanRotate.set(Math.max(-10, Math.min(10, state.vx * 8)));
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [followMode, emotion, stageRef, rawPosX, rawPosY, rawLeanRotate]);

  // Tactile squash/recoil kick every time Clip's emotion triggers
  useEffect(() => {
    if (emotionTriggerKey === 0) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
    }
    if (emotion === 'happy') {
      rawBounceScaleX.set(0.92);
      rawBounceScaleY.set(1.1);
    } else {
      rawBounceScaleX.set(1.16);
      rawBounceScaleY.set(0.84);
    }
    bounceTimerRef.current = window.setTimeout(() => {
      rawBounceScaleX.set(1);
      rawBounceScaleY.set(1);
    }, 105);
  }, [emotionTriggerKey, emotion, rawBounceScaleX, rawBounceScaleY]);

  // Drag anywhere on the window (separating drags cleanly from taps)
  useEffect(() => {
    const ownerDoc = buttonRef.current?.ownerDocument ?? document;
    const ownerWin = ownerDoc.defaultView ?? window;

    const handleDragMove = (e: PointerEvent) => {
      const state = floatStateRef.current;
      if (!state.dragging) return;

      const totalDx = e.clientX - state.dragStartClientX;
      const totalDy = e.clientY - state.dragStartClientY;
      if (Math.hypot(totalDx, totalDy) > 6) {
        state.movedDuringPress = true;
      }

      const stepDx = e.clientX - state.lastClientX;
      const stepDy = e.clientY - state.lastClientY;
      state.lastClientX = e.clientX;
      state.lastClientY = e.clientY;

      const stageEl = stageRef.current;
      let nextX = state.startX + totalDx;
      let nextY = state.startY + totalDy;

      if (stageEl) {
        const rect = stageEl.getBoundingClientRect();
        const padX = Math.max(40, rect.width / 2 - 90);
        const maxBottomY = Math.max(40, rect.height / 2 - 105);
        const maxTopY = Math.max(30, rect.height / 2 - 155);
        nextX = Math.max(-padX, Math.min(padX, nextX));
        nextY = Math.max(-maxTopY, Math.min(maxBottomY, nextY));
      }

      state.x = nextX;
      state.y = nextY;
      state.vx = Math.max(-4, Math.min(4, stepDx * 0.35)) || state.vx;
      state.vy = Math.max(-4, Math.min(4, stepDy * 0.35)) || state.vy;

      rawPosX.set(nextX);
      rawPosY.set(nextY);
      rawLeanRotate.set(Math.max(-18, Math.min(18, stepDx * 0.9)));
    };

    const handleDragEnd = () => {
      const state = floatStateRef.current;
      if (!state.dragging) return;
      state.dragging = false;
      setIsDragging(false);
      rawLeanRotate.set(0);
    };

    ownerWin.addEventListener('pointermove', handleDragMove, { passive: true });
    ownerWin.addEventListener('pointerup', handleDragEnd);
    ownerWin.addEventListener('pointercancel', handleDragEnd);
    return () => {
      ownerWin.removeEventListener('pointermove', handleDragMove);
      ownerWin.removeEventListener('pointerup', handleDragEnd);
      ownerWin.removeEventListener('pointercancel', handleDragEnd);
    };
  }, [stageRef, rawPosX, rawPosY, rawLeanRotate]);

  // Track mouse, pen, and touch movement + recognize waving gesture (using ownerDocument/defaultView for PiP portability)
  useEffect(() => {
    const ownerDoc = buttonRef.current?.ownerDocument ?? document;
    const ownerWin = ownerDoc.defaultView ?? window;

    const prefersReducedMotion =
      typeof ownerWin !== 'undefined' &&
      ownerWin.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const triggerProximityBounce = (intensity: number) => {
      if (prefersReducedMotion) return;
      if (bounceTimerRef.current) {
        ownerWin.clearTimeout(bounceTimerRef.current);
      }
      const squash = 0.08 + intensity * 0.07;
      rawBounceScaleX.set(1 + squash);
      rawBounceScaleY.set(1 - squash * 0.85);
      bounceTimerRef.current = ownerWin.setTimeout(() => {
        rawBounceScaleX.set(1);
        rawBounceScaleY.set(1);
      }, 95);
    };

    const detectWaveGesture = (clientX: number, clientY: number) => {
      const now = performance.now();
      const samples = waveSamplesRef.current;
      samples.push({ x: clientX, y: clientY, t: now });

      while (samples.length > 0 && now - samples[0].t > 1100) {
        samples.shift();
      }
      if (samples.length < 6) return;

      let reversals = 0;
      let lastDir = 0;
      let anchorX = samples[0].x;

      for (let i = 1; i < samples.length; i++) {
        const dx = samples[i].x - anchorX;
        if (Math.abs(dx) >= 28) {
          const dir = dx > 0 ? 1 : -1;
          if (lastDir !== 0 && dir !== lastDir) {
            reversals += 1;
          }
          lastDir = dir;
          anchorX = samples[i].x;
        }
      }

      if (reversals >= 3 && now - lastWaveTriggerRef.current > 950) {
        lastWaveTriggerRef.current = now;
        waveSamplesRef.current = [];
        onWaveDetected();
      }
    };

    const updateForPointer = (clientX: number, clientY: number, isMove: boolean) => {
      if (isMove && !floatStateRef.current.dragging) {
        detectWaveGesture(clientX, clientY);
      }

      const stageEl = stageRef.current;
      const clipEl = buttonRef.current;

      if (stageEl && !floatStateRef.current.dragging) {
        const stageRect = stageEl.getBoundingClientRect();
        const stageCx = stageRect.left + stageRect.width / 2;
        const stageCy = stageRect.top + stageRect.height / 2;

        if (followMode === 'chase') {
          const padX = Math.max(60, stageRect.width / 2 - 105);
          const maxBottomY = Math.max(60, stageRect.height / 2 - 115);
          const maxTopY = Math.max(50, stageRect.height / 2 - 165);
          const offsetX = Math.max(-padX, Math.min(padX, clientX - stageCx));
          const offsetY = Math.max(-maxTopY, Math.min(maxBottomY, clientY - stageCy));

          const followGain = emotion === 'crying' || emotion === 'sad' ? 0.55 : 0.86;
          const dxCenter = offsetX * followGain - rawPosX.get();
          const dyCenter = offsetY * followGain - rawPosY.get();
          rawPosX.set(offsetX * followGain);
          rawPosY.set(offsetY * followGain);

          const tilt = Math.max(-18, Math.min(18, dxCenter * 0.09));
          const skew = Math.max(-6, Math.min(6, dyCenter * 0.03));
          rawLeanRotate.set(tilt);
          rawLeanSkew.set(skew);
        } else if (followMode === 'watch') {
          const normX = (clientX - stageCx) / Math.max(1, stageRect.width / 2);
          const normY = (clientY - stageCy) / Math.max(1, stageRect.height / 2);
          rawPosX.set(floatStateRef.current.x + normX * 14);
          rawPosY.set(floatStateRef.current.y + normY * 10);
          rawLeanRotate.set(Math.max(-12, Math.min(12, normX * 11)));
          rawLeanSkew.set(Math.max(-4, Math.min(4, normY * 3)));
        }
      }

      if (clipEl) {
        const rect = clipEl.getBoundingClientRect();

        const eyeCx = rect.left + rect.width / 2;
        const eyeCy = rect.top + rect.height * 0.36;
        const eyeDx = clientX - eyeCx;
        const eyeDy = clientY - eyeCy;
        const eyeDist = Math.hypot(eyeDx, eyeDy) || 1;
        const maxPupilOffset = 4.2;
        const pupilScale = Math.min(1, eyeDist / 140) * maxPupilOffset;

        const sadBiasY = emotion === 'sad' || emotion === 'crying' ? 2.2 : 0;
        rawPupilX.set((eyeDx / eyeDist) * pupilScale);
        rawPupilY.set(Math.min(4.4, (eyeDy / eyeDist) * pupilScale + sadBiasY));

        if (!floatStateRef.current.dragging) {
          const eqCx = rect.left + rect.width / 2 - nudgeX.get();
          const eqCy = rect.top + rect.height / 2 - nudgeY.get();
          const dx = clientX - eqCx;
          const dy = clientY - eqCy;
          const dist = Math.hypot(dx, dy) || 1;

          const proximityRadius = 135;
          if (dist < proximityRadius && !prefersReducedMotion) {
            const t = 1 - dist / proximityRadius;
            const pushMagnitude =
              (followMode === 'chase' ? 24 : 32) * Math.sin(t * Math.PI * 0.72 + 0.18);
            const nx = -dx / dist;
            const ny = -dy / dist;

            rawNudgeX.set(nx * pushMagnitude);
            rawNudgeY.set(ny * pushMagnitude - t * 6);
            rawNudgeRotate.set(nx * (11 * t));

            if (!wasNearRef.current) {
              wasNearRef.current = true;
              setIsNearCursor(true);
              triggerProximityBounce(t);
            }
          } else {
            rawNudgeX.set(0);
            rawNudgeY.set(0);
            rawNudgeRotate.set(0);
            if (wasNearRef.current) {
              wasNearRef.current = false;
              setIsNearCursor(false);
            }
          }
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateForPointer(e.clientX, e.clientY, true);
    };

    const handlePointerDown = (e: PointerEvent) => {
      updateForPointer(e.clientX, e.clientY, false);
    };

    const handlePointerLeave = () => {
      rawLeanRotate.set(0);
      rawLeanSkew.set(0);
      rawPupilX.set(0);
      rawPupilY.set(emotion === 'sad' || emotion === 'crying' ? 2.2 : 0);
      rawNudgeX.set(0);
      rawNudgeY.set(0);
      rawNudgeRotate.set(0);
      rawBounceScaleX.set(1);
      rawBounceScaleY.set(1);
      if (wasNearRef.current) {
        wasNearRef.current = false;
        setIsNearCursor(false);
      }
    };

    ownerWin.addEventListener('pointermove', handlePointerMove, { passive: true });
    ownerWin.addEventListener('pointerdown', handlePointerDown, { passive: true });
    ownerDoc.addEventListener('mouseleave', handlePointerLeave);
    return () => {
      if (bounceTimerRef.current) {
        ownerWin.clearTimeout(bounceTimerRef.current);
      }
      ownerWin.removeEventListener('pointermove', handlePointerMove);
      ownerWin.removeEventListener('pointerdown', handlePointerDown);
      ownerDoc.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, [
    emotion,
    followMode,
    stageRef,
    onWaveDetected,
    rawPosX,
    rawPosY,
    rawLeanRotate,
    rawLeanSkew,
    rawPupilX,
    rawPupilY,
    rawNudgeX,
    rawNudgeY,
    rawNudgeRotate,
    rawBounceScaleX,
    rawBounceScaleY,
    nudgeX,
    nudgeY,
  ]);

  // Natural autonomous blinking
  useEffect(() => {
    let timeoutId: number;
    let blinkResetId: number;

    const scheduleBlink = () => {
      const delay =
        emotion === 'crying'
          ? 1400 + Math.random() * 1600
          : 2400 + Math.random() * 3200;
      timeoutId = window.setTimeout(() => {
        setIsBlinking(true);
        blinkResetId = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 135);
      }, delay);
    };

    scheduleBlink();
    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(blinkResetId);
    };
  }, [emotion]);

  const handleButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = floatStateRef.current;
    state.dragging = true;
    state.movedDuringPress = false;
    state.dragStartClientX = e.clientX;
    state.dragStartClientY = e.clientY;
    state.lastClientX = e.clientX;
    state.lastClientY = e.clientY;
    state.startX = rawPosX.get();
    state.startY = rawPosY.get();
    setIsDragging(true);
  };

  const handleButtonClick = () => {
    if (floatStateRef.current.movedDuringPress) {
      floatStateRef.current.movedDuringPress = false;
      return;
    }
    onTapClip();
  };

  const browAngles = (() => {
    if (isNearCursor && emotion === 'calm') {
      return { leftY: -5, rightY: -5, leftRot: -13, rightRot: 13 };
    }
    switch (emotion) {
      case 'annoyed':
        return { leftY: -2, rightY: 2, leftRot: -12, rightRot: -14 };
      case 'angry':
        return { leftY: 4, rightY: 4, leftRot: 22, rightRot: -22 };
      case 'sad':
        return { leftY: -2, rightY: -2, leftRot: -18, rightRot: 18 };
      case 'crying':
        return { leftY: -3, rightY: -3, leftRot: -22, rightRot: 22 };
      case 'happy':
        return { leftY: -6.5, rightY: -6.5, leftRot: -12, rightRot: 12 };
      case 'calm':
      default:
        return { leftY: 0, rightY: 0, leftRot: -4, rightRot: 4 };
    }
  })();

  const bodyAnimate = (() => {
    switch (emotion) {
      case 'annoyed':
        return {
          rotate: [0, -8, 6, -4, 0],
          y: [0, -6, 0],
          transition: { duration: 0.45, ease: 'easeOut' as const },
        };
      case 'angry':
        return {
          scale: [1, 1.09, 0.97, 1.11, 0.98, 1],
          x: [0, -4, 4, -5, 5, -2, 0],
          rotate: [0, -6, 6, -7, 7, 0],
          y: [0, -5, 0, -6, 0],
          transition: { duration: 0.65, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'sad':
        return {
          y: [6, 10, 6],
          rotate: [-3, -5, -3],
          scale: [0.97, 0.95, 0.97],
          transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'crying':
        return {
          y: [8, 13, 9, 13, 8],
          x: [0, -1.5, 1.5, -1.5, 0],
          rotate: [-4, -6, -3, -6, -4],
          scale: [0.95, 0.93, 0.95],
          transition: { duration: 0.75, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'happy':
        return {
          rotate: [0, -15, 15, -11, 11, 0],
          y: [0, -18, 0, -10, 0],
          scale: [1, 1.06, 0.97, 1.04, 1],
          transition: { duration: 0.9, ease: 'easeOut' as const },
        };
      case 'calm':
      default:
        return {
          y: [0, -4, 0],
          rotate: [0, 1.5, 0, -1.5, 0],
          transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
        };
    }
  })();

  const eyeScaleY = isBlinking
    ? 0.08
    : emotion === 'angry'
      ? 0.64
      : emotion === 'sad'
        ? 0.84
        : emotion === 'crying'
          ? 0.76
          : 1;

  const browColor = emotion === 'angry' ? '#991B1B' : '#0F172A';

  return (
    <motion.div
      style={{
        x: posX,
        y: posY,
        rotate: leanRotate,
        skewX: leanSkew,
      }}
      className="relative flex items-center justify-center will-change-transform"
    >
      <motion.div
        style={{
          x: nudgeX,
          y: nudgeY,
          rotate: nudgeRotate,
          scaleX: bounceScaleX,
          scaleY: bounceScaleY,
        }}
        className="relative will-change-transform"
      >
        <ThoughtBubble visible={showThought} text={thoughtText} emotion={emotion} />
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handleButtonPointerDown}
          onClick={handleButtonClick}
          aria-label="Interact with or drag Clip the paperclip"
          className={`group relative inline-flex h-48 w-36 items-center justify-center rounded-2xl select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Floating shadow beneath Clip */}
          <div
            aria-hidden="true"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 h-3 w-20 rounded-full bg-slate-900/12 blur-[3px] transition-transform duration-200 group-hover:scale-110"
          />

          <motion.svg
            key={emotion === 'happy' ? `happy-${emotionTriggerKey}` : 'clip-svg'}
            viewBox="0 0 120 156"
            className="h-full w-full overflow-visible drop-shadow-[0_12px_20px_rgba(15,23,42,0.16)]"
            animate={bodyAnimate}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
          >
            <defs>
              <linearGradient id="clipWireBase" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={emotion === 'angry' ? '#7F1D1D' : '#475569'} />
                <stop offset="32%" stopColor={emotion === 'angry' ? '#FCA5A5' : '#CBD5E1'} />
                <stop offset="55%" stopColor={emotion === 'angry' ? '#991B1B' : '#64748B'} />
                <stop offset="85%" stopColor="#E2E8F0" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>

              <linearGradient id="clipWireHighlight" x1="15%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#F8FAFC" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M 40 94 L 40 44 C 40 24, 72 24, 72 44 L 72 114 C 72 138, 30 138, 30 112 L 30 36 C 30 10, 86 10, 86 38 L 86 106 C 86 122, 54 122, 54 106 L 54 52"
                stroke={emotion === 'angry' ? '#450A0A' : '#1E293B'}
                strokeWidth="12.5"
              />
              <path
                d="M 40 94 L 40 44 C 40 24, 72 24, 72 44 L 72 114 C 72 138, 30 138, 30 112 L 30 36 C 30 10, 86 10, 86 38 L 86 106 C 86 122, 54 122, 54 106 L 54 52"
                stroke="url(#clipWireBase)"
                strokeWidth="9.2"
              />
              <path
                d="M 38.5 93 L 38.5 44 C 38.5 25.5, 70.5 25.5, 70.5 44 L 70.5 113 C 70.5 135.5, 31.5 135.5, 31.5 112 L 31.5 36 C 31.5 12, 84.5 12, 84.5 38 L 84.5 105 C 84.5 120, 55.5 120, 55.5 106 L 55.5 52"
                stroke="url(#clipWireHighlight)"
                strokeWidth="2.4"
              />
            </g>

            {emotion === 'angry' && (
              <motion.g
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: [0.95, 1.15, 0.95], opacity: 1 }}
                transition={{ duration: 0.45, repeat: Infinity }}
                stroke="#DC2626"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
              >
                <path d="M 92 14 Q 96 19 102 18" />
                <path d="M 96 8 Q 97 14 91 17" />
                <path d="M 103 10 Q 98 15 101 21" />
              </motion.g>
            )}

            {emotion === 'happy' && (
              <g opacity="0.65">
                <ellipse cx="29" cy="64" rx="6" ry="3.2" fill="#FB7185" />
                <ellipse cx="83" cy="64" rx="6" ry="3.2" fill="#FB7185" />
              </g>
            )}

            <motion.path
              d="M 28 33 Q 38 26 49 32"
              fill="none"
              stroke={browColor}
              strokeWidth={emotion === 'angry' ? '3.8' : '3.2'}
              strokeLinecap="round"
              animate={{
                y: browAngles.leftY,
                rotate: browAngles.leftRot,
              }}
              style={{ originX: '38px', originY: '30px' }}
              transition={{ duration: 0.18 }}
            />
            <motion.path
              d="M 62 32 Q 73 26 84 33"
              fill="none"
              stroke={browColor}
              strokeWidth={emotion === 'angry' ? '3.8' : '3.2'}
              strokeLinecap="round"
              animate={{
                y: browAngles.rightY,
                rotate: browAngles.rightRot,
              }}
              style={{ originX: '73px', originY: '30px' }}
              transition={{ duration: 0.18 }}
            />

            <g transform="translate(39, 49)">
              <motion.g animate={{ scaleY: eyeScaleY }} transition={{ duration: 0.1 }}>
                <ellipse
                  cx="0"
                  cy="0"
                  rx="10.5"
                  ry="13"
                  fill={emotion === 'angry' ? '#FEF2F2' : '#FFFFFF'}
                  stroke={emotion === 'angry' ? '#7F1D1D' : '#0F172A'}
                  strokeWidth="2.4"
                />
                {(emotion === 'sad' || emotion === 'crying') && (
                  <path
                    d="M -9 5 Q 0 11 9 5 A 10.5 13 0 0 1 -9 5 Z"
                    fill="#93C5FD"
                    opacity="0.7"
                  />
                )}
                <motion.g style={{ x: pupilX, y: pupilY }}>
                  <circle
                    cx="0"
                    cy="0"
                    r={emotion === 'angry' ? '3.9' : '4.6'}
                    fill={emotion === 'angry' ? '#450A0A' : '#0F172A'}
                  />
                  <circle cx="1.6" cy="-1.8" r="1.6" fill="#FFFFFF" />
                </motion.g>
              </motion.g>
            </g>

            <g transform="translate(73, 49)">
              <motion.g animate={{ scaleY: eyeScaleY }} transition={{ duration: 0.1 }}>
                <ellipse
                  cx="0"
                  cy="0"
                  rx="10.5"
                  ry="13"
                  fill={emotion === 'angry' ? '#FEF2F2' : '#FFFFFF'}
                  stroke={emotion === 'angry' ? '#7F1D1D' : '#0F172A'}
                  strokeWidth="2.4"
                />
                {(emotion === 'sad' || emotion === 'crying') && (
                  <path
                    d="M -9 5 Q 0 11 9 5 A 10.5 13 0 0 1 -9 5 Z"
                    fill="#93C5FD"
                    opacity="0.7"
                  />
                )}
                <motion.g style={{ x: pupilX, y: pupilY }}>
                  <circle
                    cx="0"
                    cy="0"
                    r={emotion === 'angry' ? '3.9' : '4.6'}
                    fill={emotion === 'angry' ? '#450A0A' : '#0F172A'}
                  />
                  <circle cx="1.6" cy="-1.8" r="1.6" fill="#FFFFFF" />
                </motion.g>
              </motion.g>
            </g>

            {emotion === 'crying' && (
              <g>
                <motion.path
                  d="M 32 59 C 32 59, 28 65, 28 68 C 28 70.5, 30 72, 32 72 C 34 72, 36 70.5, 36 68 C 36 65, 32 59, 32 59 Z"
                  fill="#38BDF8"
                  stroke="#0284C7"
                  strokeWidth="1.1"
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: [0, 34], opacity: [0, 1, 0.9, 0] }}
                  transition={{ duration: 1.05, repeat: Infinity, ease: 'easeIn' }}
                />
                <motion.path
                  d="M 80 59 C 80 59, 76 65, 76 68 C 76 70.5, 78 72, 80 72 C 82 72, 84 70.5, 84 68 C 84 65, 80 59, 80 59 Z"
                  fill="#38BDF8"
                  stroke="#0284C7"
                  strokeWidth="1.1"
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: [0, 36], opacity: [0, 1, 0.9, 0] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    delay: 0.48,
                    ease: 'easeIn',
                  }}
                />
              </g>
            )}
          </motion.svg>
        </button>
      </motion.div>
    </motion.div>
  );
};
