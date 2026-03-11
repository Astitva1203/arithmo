import { memo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Edit3, Pin, RotateCcw } from "lucide-react";

export const MessageBubble = memo(function MessageBubble({
  msg,
  onCopy,
  onPin,
  onRegenerate,
  onEdit,
  isPinned,
  canRegenerate
}) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`markdown max-w-[92%] rounded-3xl border px-4 py-3 text-sm shadow-lg md:max-w-[80%] ${
          isUser
            ? "border-cyan-200/50 bg-gradient-to-br from-cyan-200/60 via-indigo-200/45 to-pink-200/55 text-slate-900 dark:border-cyan-500/30 dark:from-cyan-500/25 dark:via-indigo-500/20 dark:to-fuchsia-500/25 dark:text-cyan-100"
            : "glass-panel border-white/30 bg-gradient-to-br from-white/40 via-white/25 to-violet-100/25 dark:border-slate-500/35 dark:from-slate-900/45 dark:via-slate-900/25 dark:to-violet-900/25"
        }`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {msg.content}
        </ReactMarkdown>
        <div className="mt-2 flex items-center justify-between text-xs opacity-75">
          <span>{new Date(msg.timestamp || Date.now()).toLocaleTimeString()}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onCopy(msg.content)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/25">
              <Copy size={14} /> Copy
            </button>
            {isUser && (
              <button onClick={() => onEdit?.(msg)} className="rounded-lg px-2 py-1 hover:bg-white/25" title="Edit message">
                <Edit3 size={14} />
              </button>
            )}
            {!isUser && (
              <>
                <button onClick={() => onPin?.(msg)} className={`rounded-lg px-2 py-1 hover:bg-white/25 ${isPinned ? "text-cyan-500" : ""}`} title="Pin message">
                  <Pin size={14} />
                </button>
                {canRegenerate && (
                  <button onClick={() => onRegenerate?.()} className="rounded-lg px-2 py-1 hover:bg-white/25" title="Regenerate response">
                    <RotateCcw size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
