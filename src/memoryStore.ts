import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import type { MemoryAsset, TeamMemory } from './types';

const MEMORY_STORAGE_KEY = 'skgrove:teamMemories';
const MEMORY_TABLE = 'team_memories';
const MEMORY_WRITE_KEYS = ['id','title','event_date','place','host','created_by','summary','tags',
  'drive_folder_id','drive_folder_url','comments','reactions'];
const ASSET_WRITE_KEYS = ['id','memory_id','type','title','uploader','tone','uploaded_at','reactions',
  'comments','preview_url','storage_path','drive_file_id','drive_view_url','drive_download_url'];
const MEMORY_ASSET_TABLE = 'team_memory_assets';
const MEMORY_BUCKET = 'team-memory-assets';

type MemoryRow = {
  id: number;
  title: string;
  event_date: string;
  place: string;
  host: string;
  created_by: string;
  summary: string;
  tags?: string[] | null;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  comments?: string[] | null;
  reactions?: TeamMemory['reactions'] | null;
};

type MemoryAssetRow = {
  id: number;
  memory_id: number;
  type: MemoryAsset['type'];
  title: string;
  uploader: string;
  tone: MemoryAsset['tone'];
  uploaded_at: string;
  reactions?: MemoryAsset['reactions'] | null;
  comments?: string[] | null;
  preview_url?: string | null;
  storage_path?: string | null;
  drive_file_id?: string | null;
  drive_view_url?: string | null;
  drive_download_url?: string | null;
};

export async function loadMemories(fallback: TeamMemory[]) {
  if (supabase) {
    const [{ data: memoryRows, error: memoryError }, { data: assetRows, error: assetError }] = await Promise.all([
      supabase.from(MEMORY_TABLE).select('*').order('event_date', { ascending: true }),
      supabase.from(MEMORY_ASSET_TABLE).select('*').order('uploaded_at', { ascending: false }),
    ]);

    if (!memoryError && !assetError && memoryRows) {
      const assetsByMemory = new Map<number, MemoryAsset[]>();
      (assetRows ?? []).forEach((row) => {
        const asset = assetFromRow(row as MemoryAssetRow);
        assetsByMemory.set(row.memory_id, [asset, ...(assetsByMemory.get(row.memory_id) ?? [])]);
      });
      const memories = (memoryRows as MemoryRow[]).map((row) => memoryFromRow(row, assetsByMemory.get(row.id) ?? []));
      rememberRemote(MEMORY_TABLE, memoryRows as unknown as Record<string, unknown>[], MEMORY_WRITE_KEYS);
      rememberRemote(MEMORY_ASSET_TABLE, (assetRows ?? []) as unknown as Record<string, unknown>[], ASSET_WRITE_KEYS);
      window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
      // 비어 있으면 비어 있는 것이다 — 시드를 돌려주면 저장을 타고 DB 로 되돌아간다.
      return memories;
    }
  }

  try {
    const saved = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as TeamMemory[];
    return parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveMemories(memories: TeamMemory[]) {
  window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));

  const memoryRows = memories.map(memoryToRow);
  const assetRows = memories.flatMap((memory) => memory.assets.map((asset) => assetToRow(memory.id, asset)));
  if (!(await syncRows(MEMORY_TABLE, memoryRows as unknown as Record<string, unknown>[]))) return;
  await syncRows(MEMORY_ASSET_TABLE, assetRows as unknown as Record<string, unknown>[]);
}

export async function deleteMemoryRecord(memoryId: number) {
  if (!supabase) return;

  const { error } = await supabase.from(MEMORY_TABLE).delete().eq('id', memoryId);
  if (error) {
    console.warn('Supabase memory delete failed. Local fallback is still updated.', error);
  }
}

export async function deleteMemoryAssetRecord(asset: MemoryAsset) {
  if (!supabase) return;

  if (asset.storagePath) {
    const { error: storageError } = await supabase.storage.from(MEMORY_BUCKET).remove([asset.storagePath]);
    if (storageError) {
      console.warn('Supabase memory file delete failed. Metadata delete will still run.', storageError);
    }
  }

  const { error } = await supabase.from(MEMORY_ASSET_TABLE).delete().eq('id', asset.id);
  if (error) {
    console.warn('Supabase memory asset delete failed. Local fallback is still updated.', error);
  }
}

export async function uploadMemoryAssetFile(memoryId: number, assetId: number, file: File) {
  if (!supabase) return { previewUrl: '', storagePath: '' };

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${memoryId}/${assetId}-${safeName}`;
  const { error } = await supabase.storage.from(MEMORY_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.warn('Supabase memory file upload failed. Browser preview is still available.', error);
    return { previewUrl: '', storagePath: '' };
  }

  const { data } = supabase.storage.from(MEMORY_BUCKET).getPublicUrl(storagePath);
  return { previewUrl: data.publicUrl, storagePath };
}

function memoryFromRow(row: MemoryRow, assets: MemoryAsset[]): TeamMemory {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date?.slice(0, 10) ?? '',
    place: row.place,
    host: row.host,
    createdBy: row.created_by,
    summary: row.summary,
    tags: row.tags ?? [],
    driveFolderId: row.drive_folder_id ?? undefined,
    driveFolderUrl: row.drive_folder_url ?? undefined,
    assets,
    comments: row.comments ?? [],
    reactions: row.reactions ?? { 좋아요: 0, 웃겨요: 0, 또가요: 0 },
  };
}

function memoryToRow(memory: TeamMemory): MemoryRow {
  return {
    id: memory.id,
    title: memory.title,
    event_date: memory.date,
    place: memory.place,
    host: memory.host,
    created_by: memory.createdBy,
    summary: memory.summary,
    tags: memory.tags,
    drive_folder_id: memory.driveFolderId ?? null,
    drive_folder_url: memory.driveFolderUrl ?? null,
    comments: memory.comments,
    reactions: memory.reactions,
  };
}

function assetFromRow(row: MemoryAssetRow): MemoryAsset {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    uploader: row.uploader,
    tone: row.tone,
    uploadedAt: row.uploaded_at,
    reactions: row.reactions ?? { '👍': 0, '👏': 0, '😂': 0, '🔥': 0, '💚': 0 },
    comments: row.comments ?? [],
    previewUrl: row.preview_url ?? undefined,
    storagePath: row.storage_path ?? undefined,
    driveFileId: row.drive_file_id ?? undefined,
    driveViewUrl: row.drive_view_url ?? undefined,
    driveDownloadUrl: row.drive_download_url ?? undefined,
  };
}

function assetToRow(memoryId: number, asset: MemoryAsset): MemoryAssetRow {
  return {
    id: asset.id,
    memory_id: memoryId,
    type: asset.type,
    title: asset.title,
    uploader: asset.uploader,
    tone: asset.tone,
    uploaded_at: asset.uploadedAt,
    reactions: asset.reactions,
    comments: asset.comments,
    preview_url: asset.previewUrl ?? null,
    storage_path: asset.storagePath ?? null,
    drive_file_id: asset.driveFileId ?? null,
    drive_view_url: asset.driveViewUrl ?? null,
    drive_download_url: asset.driveDownloadUrl ?? null,
  };
}
