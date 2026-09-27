# LYRICS-STAMP 🎵
> **Audio Lyrics Specification Studio & foobar2000 Atelier**

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4fc08d?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![foobar2000 Ready](https://img.shields.io/badge/foobar2000-Compliant%20LRC-orange)](https://www.foobar2000.org/)

Whenever I buy music on Bandcamp or rip CDs to FLAC, I almost always hit the same wall: the lyrics are either completely missing, or they're just dumped in as raw, static blocks of text.

I love watching lyrics scroll in sync while listening on foobar2000, but trying to time `.lrc` files by hand—or wrestling with clunky abandonware from fifteen years ago—takes all the fun out of it.

I wanted something tactile, responsive, and satisfying: drop in a track, press play, and tap along to the music.

So I put **LYRICS-STAMP** together. It’s a clean, local-first audio atelier made for digital crate-diggers, CD rippers, and anyone who still cares about curating a well-tagged, offline music library.

---

## ✨ Features

- 📁 **Configurable Local Music Library**:
  - Automatically scans local folders recursively for `.flac`, `.mp3`, `.ogg`, `.wav`, and `.m4a` files.
  - Native FLAC Vorbis comment extraction (`TITLE`, `ARTIST`, `ALBUM`, `LYRICS`, `UNSYNCEDLYRICS`).
  - Companion `.lrc` detection and status census (`SYNC`, `STAMP`, `EMPTY`).
  - Configure via `.env.local` (`MUSIC_DIR`), via the in-app Directory Settings modal, or by drag-and-dropping files.
- 🎛️ **Dual Stamping Modes**:
  - **Line Mode**: Instant line-by-line timestamping (`[mm:ss.xx]`) with one-key advance and instrumental solo clearance (`[mm:ss.xx]`).
  - **Word Mode (Enhanced LRC / eLRC)**: Karaoke-style per-word synchronization (`<mm:ss.xx> word <mm:ss.xx>`) with dedicated word start (<kbd>Space</kbd>) and word end (<kbd>Ctrl+Space</kbd> / <kbd>Alt+Space</kbd>) shortcuts.
- 💾 **Direct Disk Persistence**:
  - 1-click **"Save .LRC to Local Disk"** writes `.lrc` files directly next to your audio tracks without browser download dialogs.
  - Preserves standardized foobar2000 headers (`[ti:]`, `[ar:]`, `[al:]`, `[length:]`, `[offset:0]`).
- 🎧 **Audiophile Playback Engine**:
  - Web Audio API with pitch-preserved variable speeds (0.75x, 0.85x, 1.00x, 1.15x).
  - High-precision waveform ribbon scrubbing and visual playback follower.
  - Tunable latency compensation slider (default: `-120ms` human reaction adjustment).
  - Integrated Volume Deck with persistent volume memory and instant mute (<kbd>M</kbd>).
- 📦 **foobar2000 & ESLyric Export**:
  - Standard `.lrc` download.
  - Enhanced `.elrc` download with per-word karaoke tags.
  - Direct Vorbis `LYRICS` tag copy to clipboard.
  - Batch export of all synchronized tracks as a `.zip` archive.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** 18.0 or newer
- **npm**, **pnpm**, or **yarn**

### 2. Installation
```bash
# Clone repository
git clone https://github.com/mulkihafizh/lyrics-stamp.git
cd lyrics-stamp

# Install dependencies
npm install
```

### 3. Configure Your Music Directory
Copy the template configuration file:
```bash
cp .env.example .env.local
```
Open `.env.local` and set `MUSIC_DIR` to the folder containing your music:

```env
# Windows example:
MUSIC_DIR=D:/Music

# macOS example:
# MUSIC_DIR=/Users/yourname/Music

# Linux example:
# MUSIC_DIR=/home/yourname/Music

# Project relative example:
# MUSIC_DIR=./music
```

> **Note:** If `MUSIC_DIR` is not set, LYRICS-STAMP will automatically look for `D:\Music` (Windows default), `~/Music` (macOS/Linux default), or `./music` inside the repository. You can also switch directories at any time directly inside the UI.

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>SPACE</kbd> | **Stamp & Advance** | Records current timestamp for active line (or starts word in Word Mode) |
| <kbd>CTRL</kbd> + <kbd>SPACE</kbd> | **End Word Stamp** | Stamped word ends here before pausing or moving to next word |
| <kbd>ALT</kbd> + <kbd>SPACE</kbd> | **End Word Stamp** | Alternative shortcut to end word timestamp |
| <kbd>⇧ SHIFT</kbd> + <kbd>SPACE</kbd> | **Instrumental Solo** | Inserts blank timestamp line to clear lyrics display in foobar2000 |
| <kbd>⌫ Backspace</kbd> | **Undo & Rewind** | Reverts last stamp and rewinds audio 2.5s for immediate re-take |
| <kbd>[</kbd> / <kbd>]</kbd> | **Nudge Line ±50ms** | Fine-tunes active line timestamp by ±50ms |
| <kbd>⇧ SHIFT</kbd> + <kbd>[</kbd> / <kbd>]</kbd> | **Nudge Track ±50ms** | Applies global ±50ms offset to all lines in track |
| <kbd>ENTER</kbd> | **Seek Active Line** | Jumps audio playback to active line timestamp |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Navigate Lines** | Moves active line selection up or down without modifying timestamps |
| <kbd>1</kbd> – <kbd>4</kbd> | **Playback Speed** | Selects velocity: `1` (0.75x), `2` (0.85x), `3` (1.00x), `4` (1.15x) |
| <kbd>M</kbd> | **Toggle Mute** | Instantly mutes or restores audio playback |

---

## 🎯 Enhanced LRC (Word-by-Word) Guide

To create Apple Music / ESLyric style karaoke lyrics:
1. Toggle the stamping mode button to **`⊞ WORD`** in the playback bar.
2. Hit <kbd>Space</kbd> when the singer starts pronouncing a word. The word glows green (`ACTIVE`).
3. When the singer stops holding the word, press **<kbd>Ctrl+Space</kbd>** (or **<kbd>Alt+Space</kbd>**) to record the word's end timestamp.
4. If words flow continuously with no pause, simply press <kbd>Space</kbd> again — it will automatically close the previous word and start the next.
5. Export with **`.ELRC`** or **`.LRC ENHANCED`** for foobar2000 (with ESLyric component) or AIMP.

---

## 📂 Project Architecture

```
lyrics-stamp/
├── src/
│   ├── components/
│   │   ├── studio/
│   │   │   ├── LibraryDrawer.vue       # Local library census, search, filters & folder config
│   │   │   ├── LyricsLedger.vue        # Monastic lyrics ledger with real-time karaoke sweep
│   │   │   ├── WaveformRibbon.vue      # Audio visualizer & scrubber
│   │   │   ├── PlaybackControls.vue    # Transport, speed chips, volume deck & mode toggle
│   │   │   ├── ExportDrawer.vue        # foobar2000 export & direct disk save
│   │   │   ├── Masthead.vue            # Studio branding & telemetry status
│   │   │   ├── MetricMatrix.vue        # Real-time synchronization progress metrics
│   │   │   └── ShortcutLegend.vue      # Footer engineering keyboard reference
│   │   └── ui/                         # Monastic design system components
│   ├── stores/
│   │   └── lyricsStudio.ts             # Pinia store managing library, sync state & undo stack
│   ├── utils/
│   │   ├── lrcEngine.ts                # foobar2000 LRC parser & Enhanced LRC serializer
│   │   ├── timeFormat.ts               # Sub-millisecond formatting ([mm:ss.xx], <mm:ss.xx>)
│   │   └── audioEngine.ts              # Web Audio API engine with volume persistence
│   └── types/
│       └── index.ts                    # TypeScript domain interfaces
├── vite-plugin-music.ts                # Vite plugin providing local folder scanning & streaming
├── .env.example                        # Template environment variables
├── vite.config.ts                      # Vite configuration
└── package.json                        # Project metadata and dependencies
```

---

## 🤝 Contributing

Contributions are welcome! To get started:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
