"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

type Toast = { id: number; message: string; tone: "error" | "success" };

let _id = 0;
const listeners = new Set<(t: Toast) => void>();

function emit(tone: Toast["tone"], message: string) {
  const t: Toast = { id: ++_id, message, tone };
  listeners.forEach((l) => l(t));
}

export const toast = {
  error: (msg: string) => emit("error", msg),
  success: (msg: string) => emit("success", msg),
};

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const handler = (t: Toast) => {
      setItems((arr) => [...arr, t]);
      setTimeout(() => setItems((arr) => arr.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-2xl shadow-black/40 ${
              t.tone === "error"
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-success/40 bg-success/10 text-success"
            }`}
            role="status"
          >
            <Icon name={t.tone === "error" ? "AlertTriangle" : "CheckCircle2"} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
