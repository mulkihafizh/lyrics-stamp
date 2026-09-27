<script setup lang="ts">
/**
 * LibraryDrawer.vue — Library Census & File Ingestion Panel
 *
 * Features:
 * - Direct D:\Music local library integration (553+ tracks)
 * - Status filter pills (ALL, UNSYNCED, SYNCED, NO LYRICS)
 * - Live search across title, artist, album, and filename
 * - One-click re-scan D:\Music button
 * - Drag-and-drop audio file ingestion (.flac, .mp3, .ogg, .wav)
 * - Status badges for companion LRC and embedded Vorbis tags
 */
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import { formatSecondsToLength } from '@/utils/timeFormat';

const store = useLyricsStudioStore();

const isDragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const isDirModalOpen = ref(false);
const customDirInput = ref('');

function openDirModal() {
  customDirInput.value = store.activeMusicDir || 'D:\\Music';
  isDirModalOpen.value = true;
}

async function applyCustomDir() {
  if (!customDirInput.value.trim()) return;
  const ok = await store.setMusicDirectory(customDirInput.value.trim());
  if (ok) {
    isDirModalOpen.value = false;
  }
}

const displayDirName = computed(() => {
  if (!store.activeMusicDir) return 'D:\\Music';
  const parts = store.activeMusicDir.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || store.activeMusicDir;
});

const filterTabs = computed(() => [
  { key: 'all' as const, label: 'ALL', count: store.censusStats.total },
  { key: 'unsynced' as const, label: 'UNSYNCED', count: store.censusStats.unsynced },
  { key: 'synced' as const, label: 'SYNCED', count: store.censusStats.synced },
  { key: 'missing' as const, label: 'NO LYRICS', count: store.censusStats.missing },
]);

// ── Drag & Drop ──
function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function onDragLeave() {
  isDragOver.value = false;
}

async function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  if (e.dataTransfer?.files) {
    await store.handleFileImport(e.dataTransfer.files);
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    await store.handleFileImport(input.files);
  }
  input.value = '';
}

function getFormatTag(track: { fileType: string; fileName: string }): string {
  const ext = track.fileName.split('.').pop()?.toUpperCase() || '';
  if (ext === 'FLAC') return 'FLAC';
  if (ext === 'MP3') return 'MP3';
  if (ext === 'OGG') return 'OGG';
  if (ext === 'WAV') return 'WAV';
  return ext;
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface border-r border-hairline">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-hairline">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:library" class="w-3.5 h-3.5 text-zinc-500" />
          <span class="font-mono text-[10px] tracking-monastic text-zinc-500 uppercase">LIBRARY CENSUS</span>
        </div>
        <button
          class="flex items-center gap-1.5 font-mono text-[9px] tracking-monastic text-zinc-400 hover:text-white px-2 py-0.5 border border-hairline hover:border-hairline-light transition-surface cursor-pointer bg-canvas/60"
          :disabled="store.isScanning"
          :title="`Re-scan ${store.activeMusicDir || 'library'}`"
          @click="store.fetchLocalLibrary(true)"
        >
          <Icon
            icon="lucide:refresh-cw"
            class="w-2.5 h-2.5"
            :class="store.isScanning ? 'animate-spin text-accent-indigo' : 'text-zinc-500'"
          />
          <span>{{ store.isScanning ? 'SCANNING...' : `SCAN ${displayDirName.toUpperCase()}` }}</span>
        </button>
      </div>

      <!-- Active Directory Bar -->
      <div class="flex items-center justify-between gap-1.5 px-2 py-1 bg-canvas/60 border border-hairline/60 mb-2">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="store.dirExists ? 'bg-accent-emerald' : 'bg-accent-terracotta animate-pulse'"
            :title="store.dirExists ? 'Directory connected' : 'Directory not found'"
          />
          <span class="font-mono text-[9px] text-zinc-400 truncate" :title="store.activeMusicDir || 'D:\\Music'">
            {{ store.activeMusicDir || 'D:\\Music' }}
          </span>
        </div>
        <button
          class="text-zinc-500 hover:text-accent-gold transition-colors p-0.5 cursor-pointer shrink-0"
          title="Change Music Directory"
          @click="openDirModal"
        >
          <Icon icon="lucide:folder-cog" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <Icon icon="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
        <input
          v-model="store.searchQuery"
          type="text"
          placeholder="Search 550+ tracks by artist, title, album..."
          class="w-full bg-canvas text-zinc-300 text-xs font-sans pl-8 pr-8 py-2 border border-hairline focus:border-hairline-light focus:outline-none placeholder:text-zinc-700"
        />
        <button
          v-if="store.searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer"
          @click="store.searchQuery = ''"
        >
          <Icon icon="lucide:x" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Filter Pills -->
      <div class="grid grid-cols-4 gap-1 mt-2.5">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          class="font-mono text-[9px] tracking-tight uppercase py-1 border transition-surface cursor-pointer flex flex-col items-center justify-center"
          :class="
            store.statusFilter === tab.key
              ? 'bg-white text-[#0e0e11] border-white font-semibold'
              : 'bg-transparent text-zinc-500 border-hairline hover:text-zinc-300 hover:border-hairline-light'
          "
          @click="store.statusFilter = tab.key"
        >
          <span class="truncate">{{ tab.label }}</span>
          <span class="text-[8px] opacity-80">{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <!-- Dropzone / Ingestion Status -->
    <div
      class="mx-4 mt-2.5 mb-2 border border-dashed border-hairline-light py-2 px-3 flex items-center justify-between transition-surface cursor-pointer hover:border-zinc-500 bg-canvas/40"
      :class="isDragOver && 'dropzone-active'"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="triggerFileInput"
    >
      <div class="flex items-center gap-2">
        <Icon icon="lucide:file-audio" class="w-4 h-4 text-zinc-500 shrink-0" />
        <div class="flex flex-col">
          <span class="font-mono text-[9px] tracking-monastic text-zinc-400">
            IMPORT EXTRA AUDIO
          </span>
          <span class="font-mono text-[8px] text-zinc-600">Drag files or click here</span>
        </div>
      </div>
      <span class="font-mono text-[8px] text-zinc-600 border border-hairline px-1 py-0.5">.FLAC .MP3</span>
    </div>
    <input
      ref="fileInput"
      type="file"
      multiple
      accept=".flac,.mp3,.ogg,.wav,audio/*"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Track Ledger -->
    <div class="flex-1 overflow-y-auto divide-y divide-hairline/60">
      <div
        v-for="(track, idx) in store.filteredTracks"
        :key="track.id"
        class="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-surface"
        :class="
          track.id === store.activeTrackId
            ? 'bg-surface-subtle border-l-2 border-l-accent-indigo'
            : 'hover:bg-surface-hover'
        "
        @click="store.selectTrack(track.id)"
      >
        <!-- Index -->
        <span class="font-mono text-[10px] text-zinc-600 w-5 text-right shrink-0">
          {{ String(idx + 1).padStart(2, '0') }}
        </span>

        <!-- Track Info -->
        <div class="flex-1 min-w-0">
          <div class="text-[12px] font-sans font-medium text-zinc-200 truncate leading-snug">
            {{ track.metadata.title }}
          </div>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[10px] font-sans text-zinc-500 truncate max-w-[120px]">{{ track.metadata.artist }}</span>
            <span class="font-mono text-[8px] text-zinc-600 border border-hairline px-1 py-0.2">
              {{ getFormatTag(track) }}
            </span>
            <span
              v-if="track.hasCompanionLrc"
              class="font-mono text-[8px] text-accent-emerald/80 border border-accent-emerald/30 px-1 py-0.2"
              title="Companion .LRC file found"
            >
              LRC
            </span>
            <span
              v-else-if="track.hasEmbeddedLyrics"
              class="font-mono text-[8px] text-zinc-500 border border-hairline px-1 py-0.2"
              title="Embedded Vorbis LYRICS tag"
            >
              TAG
            </span>
          </div>
        </div>

        <!-- Duration & Status -->
        <div class="flex flex-col items-end shrink-0 pl-1">
          <span class="font-mono text-[9px] text-zinc-500">
            {{ formatSecondsToLength(track.metadata.lengthSeconds) }}
          </span>
          <div class="mt-1 flex items-center gap-1">
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="
                track.status === 'synced'
                  ? 'bg-accent-emerald'
                  : track.status === 'unsynced'
                    ? 'bg-accent-terracotta animate-pulse'
                    : 'bg-zinc-700'
              "
              :title="
                track.status === 'synced'
                  ? 'Synced (LRC timestamps ready)'
                  : track.status === 'unsynced'
                    ? 'Unsynced (Lyrics text ready for stamping)'
                    : 'No lyrics found'
              "
            />
            <span
              class="font-mono text-[8px] uppercase tracking-tight"
              :class="
                track.status === 'synced'
                  ? 'text-accent-emerald'
                  : track.status === 'unsynced'
                    ? 'text-accent-terracotta'
                    : 'text-zinc-600'
              "
            >
              {{ track.status === 'synced' ? 'SYNC' : track.status === 'unsynced' ? 'STAMP' : 'EMPTY' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="store.filteredTracks.length === 0"
        class="px-4 py-10 text-center"
      >
        <div v-if="!store.dirExists" class="mb-4">
          <Icon icon="lucide:folder-x" class="w-8 h-8 text-accent-terracotta mx-auto mb-2 opacity-80" />
          <p class="font-mono text-[10px] text-accent-terracotta tracking-monastic uppercase">DIRECTORY NOT FOUND</p>
          <p class="font-mono text-[10px] text-zinc-500 mt-1 break-all">{{ store.activeMusicDir }}</p>
          <button
            class="mt-3 font-mono text-[9px] uppercase tracking-monastic px-3 py-1.5 bg-accent-gold/15 border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/25 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            @click="openDirModal"
          >
            <Icon icon="lucide:folder-cog" class="w-3.5 h-3.5" />
            <span>Configure Music Folder</span>
          </button>
        </div>
        <div v-else>
          <Icon icon="lucide:music" class="w-6 h-6 text-zinc-700 mx-auto mb-2" />
          <p class="font-mono text-[10px] text-zinc-500 tracking-monastic">NO TRACKS FOUND</p>
          <p class="font-sans text-[11px] text-zinc-600 mt-1">Try clearing your search query or switching filters.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Directory Settings Modal -->
  <Teleport to="body">
    <div
      v-if="isDirModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      @click.self="isDirModalOpen = false"
    >
      <div class="w-full max-w-md bg-surface border border-hairline p-5 shadow-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-hairline mb-4">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:folder-search" class="w-4 h-4 text-accent-gold" />
            <h3 class="font-mono text-xs tracking-monastic text-white uppercase">
              CONFIGURE MUSIC DIRECTORY
            </h3>
          </div>
          <button
            class="text-zinc-500 hover:text-white cursor-pointer"
            @click="isDirModalOpen = false"
          >
            <Icon icon="lucide:x" class="w-4 h-4" />
          </button>
        </div>

        <p class="font-sans text-xs text-zinc-400 leading-relaxed mb-3">
          Set the local directory path where your audio files (<code class="text-zinc-300">.flac</code>, <code class="text-zinc-300">.mp3</code>, <code class="text-zinc-300">.ogg</code>, <code class="text-zinc-300">.wav</code>) and companion <code class="text-zinc-300">.lrc</code> files are stored.
        </p>

        <div class="mb-3">
          <label class="block font-mono text-[10px] text-zinc-500 uppercase tracking-monastic mb-1">
            Directory Path
          </label>
          <input
            v-model="customDirInput"
            type="text"
            class="w-full bg-canvas text-zinc-200 text-xs font-mono px-3 py-2 border border-hairline focus:border-accent-gold/60 focus:outline-none"
            placeholder="e.g. D:\Music or /home/user/Music"
            @keydown.enter="applyCustomDir"
          />
        </div>

        <!-- Quick Presets -->
        <div class="mb-4">
          <span class="block font-mono text-[9px] text-zinc-600 uppercase tracking-monastic mb-1">Quick Presets:</span>
          <div class="flex flex-wrap gap-1.5">
            <button
              class="font-mono text-[9px] px-2 py-0.5 bg-canvas border border-hairline hover:border-zinc-500 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              @click="customDirInput = 'D:\\Music'"
            >
              D:\Music
            </button>
            <button
              class="font-mono text-[9px] px-2 py-0.5 bg-canvas border border-hairline hover:border-zinc-500 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              @click="customDirInput = './music'"
            >
              ./music
            </button>
            <button
              class="font-mono text-[9px] px-2 py-0.5 bg-canvas border border-hairline hover:border-zinc-500 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              @click="customDirInput = '~/Music'"
            >
              ~/Music
            </button>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
          <button
            class="font-mono text-[10px] tracking-monastic uppercase px-3 py-1.5 border border-hairline text-zinc-400 hover:text-white hover:border-zinc-500 cursor-pointer"
            @click="isDirModalOpen = false"
          >
            Cancel
          </button>
          <button
            class="font-mono text-[10px] tracking-monastic uppercase px-4 py-1.5 bg-accent-gold/20 border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/30 cursor-pointer flex items-center gap-1.5"
            :disabled="store.isScanning"
            @click="applyCustomDir"
          >
            <Icon v-if="store.isScanning" icon="lucide:refresh-cw" class="w-3 h-3 animate-spin" />
            <span>{{ store.isScanning ? 'Scanning...' : 'Scan & Apply' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
