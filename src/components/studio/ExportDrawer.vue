<script setup lang="ts">
/**
 * ExportDrawer.vue — foobar2000 Export Deck
 *
 * Features:
 * - Download .LRC file (standard foobar2000 format)
 * - Download Enhanced .LRC (with per-word timestamps)
 * - Copy Vorbis LYRICS tag to clipboard
 * - Batch export all tracks as .zip
 */
import { Icon } from '@iconify/vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import MonasticButton from '@/components/ui/MonasticButton.vue';
import {
  serializeToFoobarLRC,
  serializeToEnhancedLRC,
  serializeToVorbisTag,
  generateLRCFilename,
} from '@/utils/lrcEngine';
import JSZip from 'jszip';

const store = useLyricsStudioStore();

function downloadLRC(enhanced = false, extension = 'lrc') {
  const track = store.activeTrack;
  if (!track) return;

  const content = enhanced
    ? serializeToEnhancedLRC(track)
    : serializeToFoobarLRC(track);
  const filename = generateLRCFilename(track, extension);

  // Use application/octet-stream to prevent Windows/Chrome from appending .txt
  const blob = new Blob([content], { type: 'application/octet-stream;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  // Defer cleanup so Chrome's download manager has time to resolve the blob and filename
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);

  store.showToast(`Downloaded ${filename}`);
}

async function copyVorbisTag() {
  const track = store.activeTrack;
  if (!track) return;

  const tag = serializeToVorbisTag(track);

  try {
    await navigator.clipboard.writeText(tag);
    store.showToast('Vorbis LYRICS tag copied to clipboard');
  } catch {
    store.showToast('Failed to copy to clipboard');
  }
}

async function batchExportZip() {
  const syncedTracks = store.tracks.filter(t => t.status === 'synced');
  if (syncedTracks.length === 0) {
    store.showToast('No synced tracks to export');
    return;
  }

  const zip = new JSZip();
  for (const track of syncedTracks) {
    const content = serializeToFoobarLRC(track);
    const filename = generateLRCFilename(track);
    zip.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'lyrics-stamp-export.zip';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);

  store.showToast(`Exported ${syncedTracks.length} .lrc files as ZIP`);
}
</script>

<template>
  <div class="bg-surface border-t border-hairline px-4 py-3">
    <div class="flex items-center gap-2 mb-2">
      <Icon icon="lucide:download" class="w-3.5 h-3.5 text-zinc-500" />
      <span class="font-mono text-[10px] tracking-monastic text-zinc-500 uppercase">FOOBAR2000 EXPORT</span>
    </div>

    <div class="flex flex-wrap gap-2">
      <!-- Direct Local Disk Save Button -->
      <MonasticButton
        v-if="store.activeTrack?.filePath || store.activeTrack?.dirHandle"
        variant="primary"
        size="sm"
        @click="store.saveLrcToDisk()"
      >
        <Icon icon="lucide:hard-drive-download" class="w-3 h-3 text-accent-emerald" />
        Save .LRC to Local Disk
      </MonasticButton>

      <MonasticButton variant="secondary" size="sm" @click="downloadLRC(false, 'lrc')">
        <Icon icon="lucide:download" class="w-3 h-3" />
        .LRC Standard
      </MonasticButton>

      <MonasticButton variant="secondary" size="sm" @click="downloadLRC(true, 'lrc')">
        <Icon icon="lucide:sparkles" class="w-3 h-3" />
        .LRC Enhanced
      </MonasticButton>

      <MonasticButton variant="secondary" size="sm" @click="downloadLRC(true, 'elrc')" title="Download with .elrc extension for players that require it">
        <Icon icon="lucide:file-code" class="w-3 h-3 text-accent-indigo" />
        .ELRC
      </MonasticButton>

      <MonasticButton variant="secondary" size="sm" @click="copyVorbisTag">
        <Icon icon="lucide:copy" class="w-3 h-3" />
        Vorbis Tag
      </MonasticButton>

      <MonasticButton variant="secondary" size="sm" @click="batchExportZip">
        <Icon icon="lucide:archive" class="w-3 h-3" />
        Batch .ZIP
      </MonasticButton>
    </div>
  </div>
</template>
