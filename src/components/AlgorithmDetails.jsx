import { motion, AnimatePresence } from "framer-motion";
import { X, CodeXml, Server, ShieldQuestion, Zap } from "lucide-react";
// Import the syntax highlighter and the VS Code Dark theme
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Raw strings so React formatters don't disturb the line breaks. Numbering
// follows Bach, "The Design of the UNIX Operating System", Chapter 3.
const getblkCode = `algorithm getblk
input:  file system number, block number
output: locked buffer usable for the block
{
  while (buffer not found) {
    if (block in hash queue) {
      if (buffer busy) {              /* scenario 5 */
        sleep(event: buffer becomes free);
        continue;                     /* back to while loop */
      }
      mark buffer busy;              /* scenario 1 */
      remove buffer from free list;
      return buffer;
    }
    else {                           /* block not in hash queue */
      if (no buffers on free list) {  /* scenario 4 */
        sleep(event: any buffer becomes free);
        continue;                     /* back to while loop */
      }
      remove buffer from free list;
      if (buffer marked for delayed write) {   /* scenario 3 */
        asynchronous write buffer to disk;
        continue;                     /* back to while loop */
      }
      remove buffer from old hash queue;  /* scenario 2 */
      put buffer onto new hash queue;
      return buffer;
    }
  }
}`;

const brelseCode = `algorithm brelse
input:  locked buffer
output: none
{
  wakeup all procs (event: waiting for any buffer to become free);
  wakeup all procs (event: waiting for this buffer to become free);
  raise processor execution level to block interrupts;
  if (buffer contents valid and buffer not old)
    enqueue buffer at end of free list;
  else
    enqueue buffer at beginning of free list;
  lower processor execution level to allow interrupts;
  unlock(buffer);
}`;

export default function AlgorithmModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 shrink-0">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <CodeXml size={22} /> The UNIX Buffer Cache Algorithm
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-full cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar text-slate-300 text-sm leading-relaxed space-y-8">
              {/* What & Why Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
                  <h3 className="text-blue-400 font-bold text-lg mb-2 flex items-center gap-2">
                    <ShieldQuestion size={18} /> What is it?
                  </h3>
                  <p className="text-slate-400">
                    In classic UNIX System V, the kernel manages a pool of
                    memory called the <strong>Buffer Cache</strong>. When a
                    program wants to read data from the hard drive, it uses the{" "}
                    <code className="text-blue-300 bg-slate-800 px-1 py-0.5 rounded">
                      getblk
                    </code>{" "}
                    algorithm to securely allocate a memory buffer for that
                    specific disk block.
                  </p>
                </div>
                <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
                  <h3 className="text-amber-400 font-bold text-lg mb-2 flex items-center gap-2">
                    <Zap size={18} /> Why do we need it?
                  </h3>
                  <p className="text-slate-400">
                    Disk I/O is incredibly slow. By keeping frequently used
                    blocks in RAM (Hash Queues) and tracking unused ones (Free
                    List/LRU), the system prevents the CPU from waiting on the
                    physical disk. It also prevents data corruption by "locking"
                    blocks (Busy state) so two processes don't edit them at
                    once.
                  </p>
                </div>
              </div>

              {/* The 5 Scenarios of getblk (Bach numbering) */}
              <div>
                <h3 className="text-emerald-400 font-bold text-lg mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Server size={18} /> getblk: The 5 Scenarios
                </h3>
                <p className="mb-4 text-slate-400">
                  <code className="text-blue-300 bg-slate-800 px-1 py-0.5 rounded">
                    getblk
                  </code>{" "}
                  loops until it can return a locked buffer. Each pass falls into
                  one of five cases (numbered as in Bach, Ch. 3):
                </p>

                <div className="space-y-3 mb-6">
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                    <strong className="text-emerald-300">
                      1. Buffer on hash queue, free
                    </strong>{" "}
                    — a cache hit. Mark it busy{" "}
                    <span className="text-rose-400 font-mono">[B]</span>, remove
                    it from the free list, return it.
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                    <strong className="text-blue-300">
                      2. Not on hash queue, free list has buffers
                    </strong>{" "}
                    — take the oldest buffer (head of the free list), move it off
                    its old hash queue onto the new one, mark it busy, return it.
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                    <strong className="text-amber-300">
                      3. Reused buffer is a delayed write
                    </strong>{" "}
                    — the buffer taken from the free list holds unsaved data{" "}
                    <span className="text-amber-400 font-mono">[D]</span>. Start
                    an asynchronous write{" "}
                    <span className="text-cyan-400 font-mono">[A]</span> and
                    restart the loop.
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                    <strong className="text-slate-300">
                      4. Not on hash queue, free list empty
                    </strong>{" "}
                    — no buffers to reuse. The process sleeps{" "}
                    <span className="text-slate-300 font-mono">[W]</span> until
                    any buffer is freed, then restarts the loop.
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                    <strong className="text-rose-300">
                      5. Buffer on hash queue, busy
                    </strong>{" "}
                    — the block is present but locked{" "}
                    <span className="text-rose-400 font-mono">[B]</span>/
                    <span className="text-cyan-400 font-mono">[A]</span>. The
                    process sleeps{" "}
                    <span className="text-slate-300 font-mono">[W]</span> until
                    that buffer is released, then restarts the loop.
                  </div>
                </div>

                <div className="bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500 text-slate-300">
                  <strong className="text-blue-400">brelse (release):</strong>{" "}
                  When a process is done with a buffer it calls{" "}
                  <code className="text-purple-300 bg-slate-800 px-1 py-0.5 rounded">
                    brelse
                  </code>
                  . It wakes every process sleeping for any buffer and for this
                  buffer, then puts the buffer back on the free list — at the{" "}
                  <strong>end</strong> if its contents are still valid, or at the{" "}
                  <strong>front</strong> if it is old/aged (e.g. its async write
                  just finished). Each woken process then retries{" "}
                  <code className="text-blue-300 bg-slate-800 px-1 py-0.5 rounded">
                    getblk
                  </code>
                  .
                </div>
              </div>

              {/* Code Editor Styled Pseudocode */}
              <div>
                <h3 className="text-lg font-bold text-slate-100 mb-3 border-b border-slate-800 pb-2">
                  Pseudocode
                </h3>
                <div className="space-y-4">
                  {[
                    { title: "getblk.c", code: getblkCode },
                    { title: "brelse.c", code: brelseCode },
                  ].map((file) => (
                    <div
                      key={file.title}
                      className="bg-[#1E1E1E] rounded-xl overflow-hidden border border-slate-700 shadow-2xl"
                    >
                      {/* Editor "Tab" bar */}
                      <div className="bg-[#2D2D2D] px-4 py-2 flex items-center gap-2 border-b border-[#1E1E1E]">
                        <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="ml-2 text-xs text-slate-400 font-mono">
                          {file.title}
                        </span>
                      </div>
                      <SyntaxHighlighter
                        language="c"
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          padding: "1.25rem",
                          fontSize: "12.5px",
                          backgroundColor: "transparent",
                        }}
                      >
                        {file.code}
                      </SyntaxHighlighter>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
