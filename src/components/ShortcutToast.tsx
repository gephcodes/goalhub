import { motion, AnimatePresence } from "motion/react";

export interface ShortcutToastMessage {
  id: string;
  keys: string[];
  action: string;
}

interface ShortcutToastProps {
  toasts: ShortcutToastMessage[];
}

export default function ShortcutToast({ toasts }: ShortcutToastProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            id={`shortcut_toast_${toast.id}`}
            layout
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="flex items-center gap-3 bg-[#121212] px-5 py-3 border border-stone-800 shadow-2xl max-w-sm tracking-wide text-white font-mono text-[11px]"
          >
            {/* Keyboard visual capsules */}
            <div className="flex gap-1 shrink-0">
              {toast.keys.map((k, i) => (
                <kbd
                  key={i}
                  className="px-1.5 py-0.5 bg-stone-900 border border-stone-700 font-mono text-[9px] text-stone-200 uppercase"
                >
                  {k}
                </kbd>
              ))}
            </div>

            <div className="h-3 w-[1px] bg-stone-800" />

            <span className="uppercase text-[10px] text-stone-300 font-bold shrink-0">
              {toast.action}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
