import { useState } from "react";

// Faithful implementation of the UNIX System V buffer-cache algorithms
// (getblk / brelse) from Maurice Bach, "The Design of the UNIX Operating
// System", Chapter 3.
//
// Data model:
//   - Every buffer is always linked on exactly one hash queue, keyed by
//     `blkno % numQueues`. `hashQueues` is the source of truth for a buffer's
//     status.
//   - The free list holds every buffer that is currently reusable, ordered
//     least-recently-used (head = oldest). A buffer is on the free list while
//     its status is "f" (free/clean) or "d" (delayed write — dirty but still
//     available). Locked buffers ("b" busy, "a" async write in progress) are
//     removed from the free list.
//   - The wait queue holds sleeping *processes* (rendered "w"). Each records
//     what it is blocked on: "block" (a specific busy buffer, scenario 5) or
//     "any" (waiting for any buffer, scenario 4).

const isLocked = (status) => status === "b" || status === "a";

// Deep-clone helpers so we never mutate objects still referenced by React state.
const cloneQueues = (queues) => queues.map((q) => q.map((b) => ({ ...b })));
const cloneList = (list) => list.map((b) => ({ ...b }));

// Defaults used when the setup screen is submitted with blank fields, so the
// simulation always starts from a sensible, populated state.
const DEFAULT_NUM_QUEUES = 4;
const DEFAULT_BLOCKS = [28, 4, 64, 17, 5, 97, 98, 50, 10, 3, 35, 99];

export function useBufferCache() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [numQueues, setNumQueues] = useState(DEFAULT_NUM_QUEUES);

  const [hashQueues, setHashQueues] = useState([]);
  const [freeList, setFreeList] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [logs, setLogs] = useState([]);

  // Every public operation runs against a mutable working copy `st`, then the
  // result (and any log lines it accumulated) are committed to React state in
  // one batch.
  const makeWorking = () => ({
    numQueues,
    hq: cloneQueues(hashQueues),
    fl: cloneList(freeList),
    wq: cloneList(waitingQueue),
    log: [],
  });

  const commit = (st) => {
    setHashQueues(st.hq);
    setFreeList(st.fl);
    setWaitingQueue(st.wq);
    if (st.log.length) setLogs((prev) => [...prev, ...st.log]);
  };

  const sleepProcess = (st, blkno, waitFor) => {
    if (!st.wq.some((w) => w.id === blkno))
      st.wq.push({ id: blkno, status: "w", waitFor });
  };

  // --- Core algorithm: getblk ------------------------------------------------
  // Runs the "while (buffer not found)" loop, mutating `st`. On success the
  // requested block ends up busy on its hash queue; otherwise the caller's
  // process is put to sleep on the wait queue.
  const acquire = (st, blkno) => {
    const rem = blkno % st.numQueues;
    for (;;) {
      const queue = st.hq[rem];
      const idx = queue.findIndex((b) => b.id === blkno);

      if (idx !== -1) {
        // Block is on its hash queue.
        if (isLocked(queue[idx].status)) {
          // Scenario 5: buffer busy -> sleep until THIS buffer is released.
          st.log.push(
            `[getblk] Scenario 5: block ${blkno} is busy — process sleeps.`,
          );
          sleepProcess(st, blkno, "block");
          return;
        }
        // Scenario 1: buffer free -> lock it and remove it from the free list.
        queue[idx].status = "b";
        st.fl = st.fl.filter((b) => b.id !== blkno);
        st.log.push(
          `[getblk] Scenario 1: block ${blkno} found free — buffer locked.`,
        );
        return;
      }

      // Block is not on any hash queue: reuse a buffer from the free list.
      if (st.fl.length === 0) {
        // Scenario 4: no buffers on the free list -> sleep for any buffer.
        st.log.push(
          `[getblk] Scenario 4: no free buffers — process sleeps for any buffer.`,
        );
        sleepProcess(st, blkno, "any");
        return;
      }

      const victim = st.fl[0]; // head of the free list = least recently used
      if (victim.status === "d") {
        // Scenario 3: buffer marked for delayed write. Write it out
        // asynchronously (it becomes busy) and restart the search.
        const vRem = victim.id % st.numQueues;
        const vIdx = st.hq[vRem].findIndex((b) => b.id === victim.id);
        if (vIdx !== -1) st.hq[vRem][vIdx].status = "a";
        st.fl = st.fl.slice(1);
        st.log.push(
          `[getblk] Scenario 3: buffer ${victim.id} is dirty — async write started, retrying.`,
        );
        continue;
      }

      // Scenario 2: reassign the free buffer to the requested block.
      st.fl = st.fl.slice(1);
      const oldRem = victim.id % st.numQueues;
      st.hq[oldRem] = st.hq[oldRem].filter((b) => b.id !== victim.id);
      st.hq[rem].push({ id: blkno, status: "b" });
      st.log.push(
        `[getblk] Scenario 2: buffer ${victim.id} reassigned to block ${blkno}.`,
      );
      return;
    }
  };

  // --- Core algorithm: brelse ------------------------------------------------
  // Returns a locked buffer to the free list and wakes the processes that were
  // sleeping for it. Each woken process re-runs getblk (the "continue" back to
  // the top of the while loop), so a sleeping request actually gets served.
  const release = (st, blkno) => {
    const rem = blkno % st.numQueues;
    const idx = st.hq[rem].findIndex((b) => b.id === blkno);

    if (idx === -1) {
      st.log.push(`[brelse] Error: block ${blkno} is not in the cache.`);
      return;
    }

    const wasAsync = st.hq[rem][idx].status === "a";
    st.hq[rem][idx].status = "f";
    st.fl = st.fl.filter((b) => b.id !== blkno);

    if (wasAsync) {
      // The buffer's asynchronous write just finished — it is now clean/aged,
      // so it goes to the FRONT of the free list (reused first).
      st.fl.unshift({ id: blkno, status: "f" });
      st.log.push(
        `[brelse] block ${blkno} async write complete — returned to FRONT of free list.`,
      );
    } else {
      // Normal release: most recently used, so it goes to the BACK.
      st.fl.push({ id: blkno, status: "f" });
      st.log.push(`[brelse] block ${blkno} released to BACK of free list.`);
    }

    // Wake up every process waiting for any buffer, plus every process waiting
    // for this specific buffer, then let each retry getblk.
    const woken = st.wq.filter((w) => w.waitFor === "any" || w.id === blkno);
    if (woken.length) {
      st.wq = st.wq.filter((w) => !(w.waitFor === "any" || w.id === blkno));
      woken.forEach((w) => {
        st.log.push(
          `[wakeup] process waiting for block ${w.id} awakened — retrying getblk.`,
        );
        acquire(st, w.id);
      });
    }
  };

  // --- Public API ------------------------------------------------------------

  const initializeSystem = (queuesCount, initialBlocksArray) => {
    const qCount = parseInt(queuesCount);
    // Blank / invalid queue count falls back to the default.
    const finalQCount =
      isNaN(qCount) || qCount <= 0 ? DEFAULT_NUM_QUEUES : qCount;

    // Parse the requested blocks, dropping invalid entries and duplicates so we
    // never create two buffers with the same id (which breaks React keys/state).
    const seen = new Set();
    let blocks = [];
    (initialBlocksArray || []).forEach((blk) => {
      const blockNum = parseInt(blk);
      if (isNaN(blockNum) || blockNum <= 0 || seen.has(blockNum)) return;
      seen.add(blockNum);
      blocks.push(blockNum);
    });

    // If the user hits Initialize without entering any blocks, populate the
    // cache with the default block set instead of starting empty.
    if (blocks.length === 0) blocks = [...DEFAULT_BLOCKS];

    const newHQ = Array.from({ length: finalQCount }, () => []);
    const newFree = [];
    blocks.forEach((id) => {
      const block = { id, status: "f" };
      newHQ[id % finalQCount].push(block);
      newFree.push({ ...block });
    });

    setNumQueues(finalQCount);
    setHashQueues(newHQ);
    setFreeList(newFree);
    setWaitingQueue([]);
    setLogs([
      `System initialized with ${finalQCount} hash queues and ${newFree.length} blocks.`,
    ]);
    setIsConfigured(true);
  };

  const getblk = (blkno) => {
    if (isNaN(blkno) || blkno <= 0) return;
    const st = makeWorking();
    acquire(st, blkno);
    commit(st);
  };

  const brelse = (blkno) => {
    if (isNaN(blkno) || blkno <= 0) return;
    const st = makeWorking();
    release(st, blkno);
    commit(st);
  };

  // Manual override used by the "Force Status Mutation" controls so users can
  // set up specific edge cases (e.g. mark a buffer delayed-write to trigger
  // scenario 3). This is a debugging aid, not part of the kernel algorithm.
  const changeStatus = (blkno, newStatus) => {
    if (isNaN(blkno) || blkno <= 0) return;
    const st = makeWorking();
    const rem = blkno % st.numQueues;
    const idx = st.hq[rem].findIndex((b) => b.id === blkno);

    if (idx === -1) {
      st.log.push(`[status] block ${blkno} is not in the cache.`);
      commit(st);
      return;
    }

    st.hq[rem][idx].status = newStatus;
    if (isLocked(newStatus)) {
      // Locked buffers ("b"/"a") are not reusable, so drop them from the free list.
      st.fl = st.fl.filter((b) => b.id !== blkno);
    } else {
      // "f" and "d" buffers stay on the free list. A delayed-write buffer is
      // still available for reuse (getblk will flush it), so it must remain
      // listed with its real status.
      const flIdx = st.fl.findIndex((b) => b.id === blkno);
      if (flIdx !== -1) st.fl[flIdx].status = newStatus;
      else st.fl.push({ id: blkno, status: newStatus });
    }

    st.log.push(`[status] block ${blkno} set to '${newStatus.toUpperCase()}'.`);
    commit(st);
  };

  const addBlock = (blkno) => {
    if (isNaN(blkno) || blkno <= 0) return;
    const st = makeWorking();
    const rem = blkno % st.numQueues;

    if (st.hq[rem].some((b) => b.id === blkno)) {
      st.log.push(`[add] block ${blkno} already exists in the cache.`);
      commit(st);
      return;
    }

    st.hq[rem].push({ id: blkno, status: "f" });
    st.fl.push({ id: blkno, status: "f" });
    st.log.push(`[add] block ${blkno} injected as a free buffer.`);
    commit(st);
  };

  return {
    isConfigured,
    initializeSystem,
    numQueues,
    hashQueues,
    freeList,
    waitingQueue,
    logs,
    getblk,
    brelse,
    changeStatus,
    addBlock,
  };
}
