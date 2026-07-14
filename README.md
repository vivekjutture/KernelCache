# UNIX Buffer Cache Simulator 🐧💾

A professional, interactive visual simulator for the classic **UNIX System V** buffer cache management algorithms (`getblk` and `brelse`). This tool is designed for Computer Science students to visualize kernel-level disk I/O buffering.


---

## ✨ Features

* **Dynamic Initialization:** Configure the number of Hash Queues and initial disk blocks via a sleek Setup Wizard upon launch.
* **Real-time Animations:** Watch blocks physically slide between Hash Queues, the Free List, and Waiting Queues using Framer Motion layout transitions.
* **Textbook Logic:** Faithful implementation of all 5 textbook scenarios of the `getblk` algorithm.
* **Interactive Controls:** Request blocks, release them, or manually mutate states (Free, Busy, Delayed) to trigger specific kernel behaviors.
* **Live Terminal Logs:** A dedicated system log tracks every kernel decision, process sleep, and wakeup signal.
* **Educational Documentation:** Always-visible guides and a VS Code-themed pseudocode editor to learn the theory while you play.

---

## 🧠 The Algorithm: A Deep Dive

The UNIX kernel rarely reads/writes directly to a hard disk. Instead, it uses a **Buffer Cache** in main memory to speed up operations. The `getblk` algorithm is the "manager" that finds or allocates memory for disk blocks.

### The 5 Scenarios of `getblk` (Bach, Ch. 3 numbering)
1. **Buffer on hash queue, free (Cache Hit):** The block is already in the Hash Queue and is **Free**. The kernel locks it and hands it to the process.
2. **Not on hash queue, free list has buffers (Cache Miss):** The kernel grabs the **oldest** buffer from the Free List (Least Recently Used), reassigns it to the new block, and moves it to the correct Hash Queue.
3. **Reused buffer is a Delayed Write:** The buffer taken from the Free List contains unsaved modifications. The kernel starts an **Asynchronous Write** to disk and restarts the search.
4. **Not on hash queue, free list empty:** No buffers are available to reuse. The process goes to sleep waiting for *any* buffer to be released, then restarts.
5. **Buffer on hash queue, busy (Locked):** The block is found, but it is **Busy** (locked / mid-I/O). The requesting process sleeps until that buffer is released, then restarts.

`brelse` returns a locked buffer to the Free List — to the **back** if its contents are still valid, or the **front** if the buffer is aged (e.g. its async write just finished) — and wakes any processes sleeping for it, which then retry `getblk`.

---

## 🎮 How to Use the Simulator

### 1. Initialization
When you first load the app, you will see the **System Setup** screen. 
- **Hash Queues:** Enter how many bins you want to organize blocks into (Default is 4).
- **Initial Blocks:** Enter the total number of blocks to start with.
- **Assign Block Numbers:** A list of emerald-bordered inputs will appear. Enter your starting block IDs here. These inputs strictly allow only numbers and highlight individually on focus.

### 2. Main Dashboard
Once initialized, you have full control over the kernel:
- **[getblk]**: Type a Block ID in the control panel to request it. Watch the animations as blocks slide between Hash Queues and the Free List.
- **[brelse]**: Type a Busy block's ID and click release to return it to the back of the Free List (LRU policy).
- **Force Status**: Manually set blocks to **Delayed** or **Busy** to test how the algorithm reacts to Scenario 3 or Scenario 5.

---

## 🛠️ Technical Implementation

### File Structure
- `App.jsx`: Main entry point and high-level layout.
- `hooks/useBufferCache.js`: The "Brain" - holds the full `getblk`/`brelse` logic translated to React state.
- `components/SetupScreen.jsx`: Dynamic initialization wizard with numeric validation.
- `components/AlgorithmDetails.jsx`: Comprehensive theory guide modal with VS Code-style syntax highlighting.
- `components/HowToUseGuide.jsx`: Step-by-step interactive user walkthrough modal.
- `components/Controls.jsx`: Control panel for `getblk`, `brelse`, block injection, and status mutation.
- `components/Block.jsx`: Animated UI component for the disk blocks.
- `components/Legend.jsx` / `LogViewer.jsx`: Status legend and live system-log terminal.

### Tech Stack
- **React 19.2**: Utilizing Concurrent Rendering and optimized hooks.
- **Tailwind CSS v4.2**: Ultra-fast CSS-first styling engine.
- **Framer Motion**: Smooth "sliding" layout animations.
- **Lucide React**: Professional system iconography.

---

## 🚀 Installation & Setup

1. Clone the repository

2. Install Dependencies:
   npm install

3. Run Development Server:
   npm run dev

---

## 📄 License
MIT License - Feel free to use this for educational purposes.
