import { motion, AnimatePresence } from "motion/react";
import { X, Key, Terminal } from "lucide-react";

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const shortcutList = [
    { keys: ["⌥", "F"], desc: "Toggle Focus mode (Dims & blurs other sections)" },
    { keys: ["⌥", "C"], desc: "Copy active strategy specifications markdown" },
    { keys: ["⌥", "S"], desc: "Activate Co-Op Radar (Spawn Lobby or join)" },
    { keys: ["⌥", "I"], desc: "Focus tactical search filter matrix input" },
    { keys: ["⌥", "Escape"], desc: "Instantly clear workstation or exit inputs" },
    { keys: ["⌥", "K"], desc: "Toggle keyboard shortcuts help directory" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Glass background overlay */}
          <motion.div
            id="shortcuts_help_backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            id="shortcuts_help_container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative bg-white border border-stone-950 max-w-md w-full shadow-2xl overflow-hidden text-stone-950 flex flex-col"
          >
            {/* Ambient accent header */}
            <div className="h-1 w-full bg-stone-950" />

            {/* Header */}
            <div className="p-5 border-b border-stone-200 flex justify-between items-center bg-stone-50">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-stone-900" />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-stone-900">
                  SYSTEM KEYBOARD DICTIONARY
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-stone-200 transition-colors cursor-pointer text-stone-500 hover:text-stone-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid rows */}
            <div className="p-6 divide-y divide-stone-150 overflow-y-auto max-h-[70vh]">
              {shortcutList.map((shortcut, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center gap-4">
                  <span className="text-[11px] font-sans text-stone-600 font-medium">
                    {shortcut.desc}
                  </span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((keyString, sIdx) => (
                      <kbd
                        key={sIdx}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 font-mono text-[9px] text-stone-800 uppercase shadow-xs flex items-center justify-center min-w-[21px]"
                      >
                        {keyString}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer guide indicators */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 text-center">
              <span className="text-[8px] font-mono text-stone-400 uppercase tracking-widest block">
                Press [ ⌥ + Keys ] anywhere inside the console to execute.
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
