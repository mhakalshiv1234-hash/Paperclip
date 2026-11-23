import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ClipEmotion } from '../types';

interface ThoughtBubbleProps {
  visible: boolean;
  text: string;
  emotion: ClipEmotion;
}

const BUBBLE_TONE: Record<ClipEmotion, string> = {
  calm: 'border-slate-200 bg-white/95 text-slate-700',
  annoyed: 'border-amber-200 bg-amber-50/95 text-amber-950',
  angry: 'border-red-200 bg-red-50/95 text-red-900',
  sad: 'border-sky-200 bg-sky-50/95 text-sky-900',
  crying: 'border-blue-200 bg-blue-50/95 text-blue-950',
  happy: 'border-emerald-200 bg-emerald-50/95 text-emerald-950',
};

const DOT_TONE: Record<ClipEmotion, string> = {
  calm: 'border-slate-200 bg-white/95',
  annoyed: 'border-amber-200 bg-amber-50/95',
  angry: 'border-red-200 bg-red-50/95',
  sad: 'border-sky-200 bg-sky-50/95',
  crying: 'border-blue-200 bg-blue-50/95',
  happy: 'border-emerald-200 bg-emerald-50/95',
};

export const ThoughtBubble: React.FC<ThoughtBubbleProps> = ({
  visible,
  text,
  emotion,
}) => {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 flex flex-col items-center"
    >
      <AnimatePresence mode="wait">
        {visible && text && (
          <motion.div
            key={`${emotion}-${text}`}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <div
              className={`w-max max-w-[230px] rounded-2xl border px-3.5 py-2 text-center text-xs font-medium leading-snug shadow-sm backdrop-blur-xs ${BUBBLE_TONE[emotion]}`}
            >
              {text}
            </div>
            {/* Trailing thought-bubble dots leading toward Clip */}
            <div className="mt-1 flex flex-col items-center gap-1" aria-hidden="true">
              <span className={`h-2.5 w-2.5 rounded-full border shadow-xs ${DOT_TONE[emotion]}`} />
              <span className={`h-1.5 w-1.5 rounded-full border shadow-xs ${DOT_TONE[emotion]}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
