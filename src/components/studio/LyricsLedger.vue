<script setup lang="ts">
/**
 * LyricsLedger.vue — Central Lyrics Stamping Matrix & Real-time Verifier
 *
 * Features:
 * - Archival spec header toolbar with live sync progress & track specs
 * - Real-time follow-along (karaoke mode) highlighting playing line as audio progresses
 * - Click-to-seek on any timestamp to verify sync alignment against vocals
 * - Per-word karaoke highlighting in word mode
 * - "Paste / Edit Lyrics" modal allowing instant ingestion of raw lyrics
 * - "Reset All Timestamps (Re-Sync)" to start stamping fresh
 * - Micro-controls on hover (±50ms nudge, play, reset line)
 */
import { ref, watch, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import Badge from '@/components/ui/Badge.vue';
import MonasticButton from '@/components/ui/MonasticButton.vue';

const store = useLyricsStudioStore();
const ledgerRef = ref<HTMLDivElement | null>(null);
const hoveredLine = ref<number | null>(null);
const showLyricsModal = ref(false);
const rawLyricsInput = ref('');

const emit = defineEmits<{
  'seek-line': [time: number];
}>();

const activeTrack = computed(() => store.activeTrack);
const activeLineIndex = computed(() => store.playback.activeLineIndex);
const currentPlayingLineIndex = computed(() => store.currentPlayingLineIndex);
const isPlaying = computed(() => store.playback.isPlaying);
const stampingMode = computed(() => store.playback.stampingMode);
const currentTime = computed(() => store.playback.currentTime);

// ── Auto-scroll to active stamping line or current playing line ──
watch([activeLineIndex, currentPlayingLineIndex], async () => {
  if (!store.playback.autoScrollLocked) return;
  await nextTick();
  // If playing, prefer scrolling to the currently singing line
  const targetIndex = isPlaying.value && currentPlayingLineIndex.value !== -1
    ? currentPlayingLineIndex.value
    : activeLineIndex.value;

  const activeEl = ledgerRef.value?.querySelector(`[data-line-index="${targetIndex}"]`);
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

function seekToLine(lineIndex: number) {
  const track = activeTrack.value;
  if (!track) return;
  const line = track.lyrics[lineIndex];
  if (line?.timestamp !== null && line?.timestamp !== undefined) {
    emit('seek-line', line.timestamp);
    store.playback.activeLineIndex = lineIndex;
  }
}

function goToLine(lineIndex: number) {
  store.playback.activeLineIndex = lineIndex;
}

function openLyricsEditor() {
  const track = activeTrack.value;
  if (track) {
    rawLyricsInput.value = track.originalRawLyrics || track.lyrics.map(l => l.rawText).join('\n');
  } else {
    rawLyricsInput.value = '';
  }
  showLyricsModal.value = true;
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      rawLyricsInput.value = text;
      store.showToast('Pasted from clipboard');
    }
  } catch {
    store.showToast('Please paste manually using Ctrl+V');
  }
}

function applyLyrics() {
  if (!rawLyricsInput.value.trim()) {
    store.showToast('Please enter or paste lyrics first');
    return;
  }
  store.updateTrackLyrics(rawLyricsInput.value);
  showLyricsModal.value = false;
}

function handleResetAll() {
  if (confirm('Reset all timestamps for this track to start re-syncing from scratch?')) {
    store.resetAllTimestamps();
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-canvas overflow-hidden">
    <!-- Top Ledger Toolbar -->
    <div class="px-4 py-2.5 bg-surface border-b border-hairline flex items-center justify-between gap-3 shrink-0">
      <!-- Left: Track Title & Progress -->
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-sans font-semibold text-zinc-100 truncate max-w-[240px]">
              {{ activeTrack ? activeTrack.metadata.title : 'NO TRACK LOADED' }}
            </span>
            <span
              v-if="activeTrack"
              class="font-mono text-[9px] px-1.5 py-0.2 border"
              :class="
                activeTrack.status === 'synced'
                  ? 'border-accent-emerald/40 text-accent-emerald bg-accent-emerald/10'
                  : activeTrack.status === 'unsynced'
                    ? 'border-accent-terracotta/40 text-accent-terracotta bg-accent-terracotta/10'
                    : 'border-zinc-700 text-zinc-500'
              "
            >
              {{ activeTrack.status === 'synced' ? 'SYNCED' : activeTrack.status === 'unsynced' ? 'PENDING SYNC' : 'EMPTY' }}
            </span>
          </div>
          <span class="font-mono text-[9px] text-zinc-500 truncate">
            {{ activeTrack?.metadata.artist || 'Select a song from Library' }}
          </span>
        </div>

        <!-- Sync Progress Tag -->
        <div
          v-if="activeTrack && activeTrack.lyrics.length > 0"
          class="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-hairline"
        >
          <span class="font-mono text-[10px] text-zinc-400 tabular-nums">
            {{ activeTrack.lyrics.filter(l => l.timestamp !== null).length }}/{{ activeTrack.lyrics.length }}
          </span>
          <span class="font-mono text-[9px] text-zinc-600">({{ store.syncProgress }}%)</span>
        </div>
      </div>

      <!-- Right: Action Buttons (Edit, Reset, Scroll Lock) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Edit / Paste Lyrics -->
        <button
          class="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono tracking-monastic border border-hairline hover:border-hairline-light hover:text-white text-zinc-400 bg-surface-subtle transition-surface cursor-pointer"
          title="Paste or edit song lyrics text"
          @click="openLyricsEditor"
        >
          <Icon icon="lucide:file-edit" class="w-3 h-3 text-accent-indigo" />
          <span>PASTE / EDIT LYRICS</span>
        </button>

        <!-- Reset All Timestamps (Re-sync) -->
        <button
          v-if="activeTrack && activeTrack.lyrics.some(l => l.timestamp !== null)"
          class="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono tracking-monastic border border-hairline hover:border-accent-rose/50 hover:text-accent-rose text-zinc-500 bg-surface-subtle transition-surface cursor-pointer"
          title="Clear all timestamps to re-sync this track from scratch"
          @click="handleResetAll"
        >
          <Icon icon="lucide:rotate-ccw" class="w-3 h-3 text-accent-rose/70" />
          <span>RE-SYNC</span>
        </button>

        <!-- Auto-scroll lock toggle -->
        <button
          class="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border transition-surface cursor-pointer"
          :class="
            store.playback.autoScrollLocked
              ? 'border-hairline text-zinc-400 bg-surface-subtle hover:text-zinc-200'
              : 'border-zinc-700 text-zinc-600 hover:text-zinc-400'
          "
          :title="store.playback.autoScrollLocked ? 'Auto-scroll is ON' : 'Auto-scroll is PAUSED'"
          @click="store.playback.autoScrollLocked = !store.playback.autoScrollLocked"
        >
          <Icon
            :icon="store.playback.autoScrollLocked ? 'lucide:lock' : 'lucide:unlock'"
            class="w-3 h-3"
          />
          <span class="hidden md:inline">{{ store.playback.autoScrollLocked ? 'LOCKED' : 'FREE' }}</span>
        </button>
      </div>
    </div>

    <!-- Central Ledger Scroll Matrix -->
    <div
      ref="ledgerRef"
      class="flex-1 overflow-y-auto bg-canvas"
    >
      <!-- Empty state -->
      <div
        v-if="!activeTrack || activeTrack.lyrics.length === 0"
        class="flex flex-col items-center justify-center h-full gap-4 py-16 px-4 text-center"
      >
        <div class="w-12 h-12 rounded-full border border-hairline-light flex items-center justify-center bg-surface">
          <Icon icon="lucide:file-text" class="w-6 h-6 text-zinc-500" />
        </div>
        <div>
          <p class="font-mono text-xs tracking-monastic text-zinc-300 font-semibold mb-1">
            NO LYRICS LOADED FOR THIS TRACK
          </p>
          <p class="font-sans text-xs text-zinc-500 max-w-sm">
            This audio file has no embedded Vorbis lyrics or companion .lrc file yet. Paste your lyrics text to start timestamping.
          </p>
        </div>

        <div class="flex items-center gap-2 mt-2">
          <MonasticButton variant="primary" size="md" @click="openLyricsEditor">
            <Icon icon="lucide:clipboard-paste" class="w-3.5 h-3.5" />
            Paste Lyrics from Clipboard
          </MonasticButton>
        </div>
      </div>

      <!-- Lyrics Lines -->
      <div v-else class="py-2">
        <div
          v-for="(line, idx) in activeTrack.lyrics"
          :key="line.id"
          :data-line-index="idx"
          class="group flex items-start gap-0 border-b border-hairline/30 transition-all duration-100 cursor-pointer"
          :class="[
            // Stamping cursor line
            idx === activeLineIndex
              ? 'bg-surface-subtle/80 border-l-2 border-l-accent-gold'
              : idx === currentPlayingLineIndex && isPlaying
                ? 'bg-accent-emerald/10 border-l-2 border-l-accent-emerald'
                : 'border-l-2 border-l-transparent hover:bg-surface-hover/70',
          ]"
          @mouseenter="hoveredLine = idx"
          @mouseleave="hoveredLine = null"
          @click="goToLine(idx)"
        >
          <!-- Timestamp Column (Clickable to seek!) -->
          <div
            class="w-[100px] shrink-0 px-3 py-2 font-mono text-[12px] tabular-nums text-right select-none transition-colors"
            :class="[
              idx === currentPlayingLineIndex && isPlaying
                ? 'text-accent-emerald font-bold'
                : line.timestamp !== null
                  ? 'text-accent-emerald/80 hover:text-accent-emerald hover:underline'
                  : 'text-zinc-700',
            ]"
            :title="line.timestamp !== null ? 'Click to seek audio to this timestamp' : 'Unstamped'"
            @click.stop="seekToLine(idx)"
          >
            {{ line.formattedTime }}
          </div>

          <!-- Active / Playing Indicator Cursor -->
          <div class="w-6 shrink-0 py-2 text-center flex items-center justify-center">
            <!-- Active stamping line cursor -->
            <span
              v-if="idx === activeLineIndex"
              class="text-accent-gold text-xs animate-cursor-pulse leading-none"
              title="Next line to stamp"
            >
              ▶
            </span>
            <!-- Currently playing karaoke voice indicator -->
            <span
              v-else-if="idx === currentPlayingLineIndex && isPlaying"
              class="text-accent-emerald text-xs animate-pulse leading-none"
              title="Currently singing"
            >
              ♪
            </span>
          </div>

          <!-- Gap Badge -->
          <div class="w-12 shrink-0 py-2 flex items-center">
            <Badge
              v-if="line.isInstrumentalGap"
              variant="gap"
              label="GAP"
              :small="true"
            />
          </div>

          <!-- Lyric Text with Real-time Follow Along & Word Highlighting -->
          <div class="flex-1 py-2 pr-3 min-w-0">
            <!-- Word mode: render words individually with karaoke highlighting -->
            <template v-if="stampingMode === 'word' && line.wordStamps.length > 0 && !line.isInstrumentalGap">
              <span class="flex flex-wrap gap-x-1.5 gap-y-0.5">
                <span
                  v-for="(word, wi) in line.wordStamps"
                  :key="wi"
                  class="font-sans text-[14px] leading-relaxed px-0.5 transition-all duration-100"
                  :class="[
                    // Word currently singing in playback
                    isPlaying && word.startTime !== null && currentTime >= word.startTime && (
                      word.endTime != null
                        ? currentTime <= word.endTime
                        : (wi === line.wordStamps.length - 1 || (line.wordStamps[wi + 1].startTime !== null && currentTime < (line.wordStamps[wi + 1].startTime || 0)))
                    )
                      ? 'text-accent-emerald font-bold bg-accent-emerald/20 shadow-sm scale-105 ring-1 ring-accent-emerald/40'
                      // Word active in manual stamping mode
                      : wi === line.activeWordIndex && idx === activeLineIndex
                        ? (word.startTime !== null && word.endTime == null
                            ? 'text-accent-emerald font-bold bg-accent-emerald/20 ring-1 ring-accent-emerald/50 animate-pulse'
                            : 'text-accent-gold font-semibold bg-accent-gold/15 ring-1 ring-accent-gold/30')
                        : word.startTime !== null
                          ? 'text-white'
                          : 'text-zinc-500',
                  ]"
                >
                  {{ word.word }}
                  <span
                    v-if="word.startTime !== null"
                    class="font-mono text-[9px] text-zinc-500/70 ml-0.5 tracking-tighter select-none"
                  >
                    {{ word.formattedTime }}<template v-if="word.endTime != null">-{{ word.endFormattedTime }}</template>
                  </span>
                </span>
              </span>
            </template>

            <!-- Standard text display -->
            <template v-else>
              <span
                v-if="line.rawText"
                class="font-sans text-[14px] leading-relaxed transition-colors"
                :class="[
                  // Karaoke currently playing line
                  idx === currentPlayingLineIndex && isPlaying
                    ? 'text-white font-semibold'
                    : idx === activeLineIndex
                      ? 'text-white font-medium'
                      : line.timestamp !== null
                        ? 'text-zinc-300'
                        : 'text-zinc-500',
                ]"
              >
                {{ line.rawText }}
              </span>
              <span
                v-else-if="!line.isInstrumentalGap"
                class="font-mono text-[11px] text-zinc-700 italic"
              >
                ¶
              </span>
            </template>
          </div>

          <!-- Micro-Controls (on hover) -->
          <div
            class="shrink-0 py-1.5 pr-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          >
            <button
              v-if="line.timestamp !== null"
              class="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer"
              title="Nudge -50ms earlier"
              @click.stop="store.nudgeLine(idx, -50)"
            >
              <span class="font-mono text-[9px]">-50</span>
            </button>
            <button
              v-if="line.timestamp !== null"
              class="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer"
              title="Nudge +50ms later"
              @click.stop="store.nudgeLine(idx, 50)"
            >
              <span class="font-mono text-[9px]">+50</span>
            </button>
            <button
              v-if="line.timestamp !== null"
              class="p-1 text-zinc-500 hover:text-accent-indigo cursor-pointer"
              title="Play from this line"
              @click.stop="seekToLine(idx)"
            >
              <Icon icon="lucide:play" class="w-3 h-3" />
            </button>
            <button
              v-if="line.timestamp !== null"
              class="p-1 text-zinc-500 hover:text-accent-rose cursor-pointer"
              title="Clear timestamp for this line"
              @click.stop="store.resetLineTimestamp(idx)"
            >
              <Icon icon="lucide:rotate-ccw" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Paste / Edit Lyrics Modal -->
    <div
      v-if="showLyricsModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div class="bg-surface border border-hairline w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh]">
        <!-- Modal Header -->
        <div class="px-5 py-3 border-b border-hairline flex items-center justify-between bg-surface-subtle">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:file-text" class="w-4 h-4 text-accent-indigo" />
            <span class="font-mono text-xs tracking-monastic text-zinc-200 uppercase font-semibold">
              INGEST / EDIT TRACK LYRICS
            </span>
          </div>
          <button
            class="text-zinc-500 hover:text-zinc-200 cursor-pointer"
            @click="showLyricsModal = false"
          >
            <Icon icon="lucide:x" class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-sans text-zinc-400">
              Paste lyrics from Google or text file (plain lines or timestamped LRC):
            </span>
            <button
              class="flex items-center gap-1 font-mono text-[10px] text-accent-indigo hover:text-indigo-400 cursor-pointer"
              @click="pasteFromClipboard"
            >
              <Icon icon="lucide:clipboard" class="w-3 h-3" />
              <span>PASTE CLIPBOARD</span>
            </button>
          </div>

          <textarea
            v-model="rawLyricsInput"
            rows="14"
            placeholder="Paste your lyrics here...
Line 1
Line 2
Line 3
Or [00:12.30] Timestamped lyrics"
            class="w-full flex-1 bg-canvas border border-hairline focus:border-accent-indigo focus:outline-none p-3 font-sans text-xs text-zinc-200 leading-relaxed resize-none placeholder:text-zinc-700"
          />
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3 border-t border-hairline flex items-center justify-between bg-surface-subtle">
          <span class="font-mono text-[10px] text-zinc-500">
            {{ rawLyricsInput.split('\n').filter(l => l.trim()).length }} lines detected
          </span>
          <div class="flex items-center gap-2">
            <MonasticButton variant="secondary" size="sm" @click="showLyricsModal = false">
              Cancel
            </MonasticButton>
            <MonasticButton variant="primary" size="sm" @click="applyLyrics">
              <Icon icon="lucide:check" class="w-3.5 h-3.5" />
              Apply Lyrics to Track
            </MonasticButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
