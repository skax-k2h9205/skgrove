import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import { normalizeTeamPart } from './auth';
import type { CurrentUser, Profile } from './types';
import { getCurrentTenantId, tenantPath, withTenant } from './tenantContext';

const PROFILE_STORAGE_KEY = 'skgrove:profiles';
const PROFILE_USER_KEY_PREFIX = 'skgrove:profile:';
const PROFILE_TABLE = 'profiles';
const PROFILE_WRITE_KEYS = ['profile_key','owner_email','name','part','role','english_name','birth_year',
  'birthday','character','trait','style','collaboration','feedback','guide','color','mbti_type',
  'mbti_scores','disc_type','disc_secondary','disc_scores','collab_guide',
  'avatar_kind','desk_item','into_lately','energy_time','character_url'];
const profileId = (r: Record<string, unknown>) => String(r.profile_key ?? '');

type ProfileRow = {
  profile_key: string;
  owner_email?: string | null;
  name: string;
  part: string;
  role: string;
  english_name: string;
  birth_year: string;
  birthday: string;
  character: string;
  trait: string;
  style: string;
  collaboration: string;
  feedback: string;
  guide: string;
  color: Profile['color'];
  mbti_type?: string | null;
  mbti_scores?: unknown;
  disc_type?: string | null;
  disc_secondary?: string | null;
  disc_scores?: unknown;
  collab_guide?: string | null;
  avatar_kind?: string | null;
  desk_item?: string | null;
  into_lately?: string | null;
  energy_time?: string | null;
  character_url?: string | null;
};

export async function loadProfiles(fallback: Profile[], currentUser: CurrentUser) {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(PROFILE_TABLE).select('*')).order('part').order('name');

    if (!error && data) {
      const loaded = dedupeProfileRows(data as ProfileRow[]).map(profileFromRow);
      rememberRemote(PROFILE_TABLE, data as unknown as Record<string, unknown>[], PROFILE_WRITE_KEYS, profileId);
      // 테넌트 스코프 결과가 비어도 시드(fallback=SK mock)로 채우지 않는다 — 다른 팀에
      // SK 프로필(이선민 등)이 새어 들어가던 원인. 빈 팀은 빈 채로 둔다(본인 것만 병합).
      const merged = mergeCurrentUserProfile(loaded, currentUser);
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  }

  try {
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    const base = saved ? JSON.parse(saved) as Profile[] : fallback;
    return mergeCurrentUserProfile(base.length > 0 ? base : fallback, currentUser);
  } catch {
    return mergeCurrentUserProfile(fallback, currentUser);
  }
}

export async function saveProfiles(profiles: Profile[]) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));

  await syncRows(PROFILE_TABLE, profiles.map((profile) => profileToRow(profile)),
                 { onConflict: 'profile_key', idOf: profileId });
}

export async function saveProfileForUser(profile: Profile, currentUser: CurrentUser, profiles: Profile[]) {
  const nextProfiles = [profile, ...profiles.filter((item) => item.name !== profile.name)];
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
  window.localStorage.setItem(`${PROFILE_USER_KEY_PREFIX}${currentUser.email.toLowerCase()}`, JSON.stringify(profile));

  if (!supabase) return;

  const { error } = await supabase.from(PROFILE_TABLE).upsert(
    { ...profileToRow(profile, currentUser.email), tenant_id: getCurrentTenantId() },
    { onConflict: 'profile_key' },
  );

  if (error) {
    console.warn('Supabase user profile save failed. Local fallback is still updated.', error);
  }
}

function mergeCurrentUserProfile(profiles: Profile[], currentUser: CurrentUser) {
  try {
    const saved = window.localStorage.getItem(`${PROFILE_USER_KEY_PREFIX}${currentUser.email.toLowerCase()}`);
    if (!saved) return profiles;
    const profile = JSON.parse(saved) as Profile;
    return [profile, ...profiles.filter((item) => item.name !== profile.name)];
  } catch {
    return profiles;
  }
}

// 같은 사람이 이름키 행(시드 saveProfiles → profile_key=이름)과 이메일키 행(본인 진단
// saveProfileForUser → profile_key=이메일)으로 두 번 저장되면 upsert 가 서로를 못 덮어
// 동료성향 목록에 같은 이름이 두 번 뜬다. 같은 이름에 '주인 있는(owner_email) 행'이 있으면
// 이름키 시드 행은 버려 한 명만 남긴다. 둘 다 주인이 있는 동명이인은 그대로 둔다(안 합침).
export function dedupeProfileRows(rows: ProfileRow[]): ProfileRow[] {
  const ownedNames = new Set(rows.filter((row) => row.owner_email).map((row) => row.name.trim()));
  return rows.filter((row) => row.owner_email || !ownedNames.has(row.name.trim()));
}

function profileFromRow(row: ProfileRow): Profile {
  return {
    name: row.name,
    // 옛 파트 이름('혁신도구파트')이 저장돼 있으면 지금 이름(PM혁신파트)으로 갈아끼운다.
    part: normalizeTeamPart(row.part),
    role: row.role,
    englishName: row.english_name,
    birthYear: row.birth_year,
    birthday: row.birthday,
    character: row.character,
    trait: row.trait,
    style: row.style,
    collaboration: row.collaboration,
    feedback: row.feedback,
    guide: row.guide,
    color: row.color,
    mbtiType: row.mbti_type ?? undefined,
    mbtiScores: (row.mbti_scores as Profile['mbtiScores']) ?? undefined,
    discType: (row.disc_type as Profile['discType']) ?? undefined,
    discSecondary: (row.disc_secondary as Profile['discSecondary']) ?? undefined,
    discScores: (row.disc_scores as Profile['discScores']) ?? undefined,
    collabGuide: row.collab_guide ?? undefined,
    avatarKind: row.avatar_kind ?? undefined,
    deskItem: row.desk_item ?? undefined,
    intoLately: row.into_lately ?? undefined,
    energyTime: (row.energy_time as Profile['energyTime']) ?? undefined,
    characterUrl: row.character_url ?? undefined,
  };
}

function profileToRow(profile: Profile, ownerEmail?: string): ProfileRow {
  return {
    profile_key: ownerEmail?.toLowerCase() ?? profile.name,
    owner_email: ownerEmail?.toLowerCase() ?? null,
    name: profile.name,
    part: profile.part,
    role: profile.role,
    english_name: profile.englishName,
    birth_year: profile.birthYear,
    birthday: profile.birthday,
    character: profile.character,
    trait: profile.trait,
    style: profile.style,
    collaboration: profile.collaboration,
    feedback: profile.feedback,
    guide: profile.guide,
    color: profile.color,
    mbti_type: profile.mbtiType ?? null,
    mbti_scores: profile.mbtiScores ?? null,
    disc_type: profile.discType ?? null,
    disc_secondary: profile.discSecondary ?? null,
    disc_scores: profile.discScores ?? null,
    collab_guide: profile.collabGuide ?? null,
    avatar_kind: profile.avatarKind ?? null,
    desk_item: profile.deskItem ?? null,
    into_lately: profile.intoLately ?? null,
    energy_time: profile.energyTime ?? null,
    character_url: profile.characterUrl ?? null,
  };
}

const CHARACTER_BUCKET = 'profile-characters';

/**
 * 캐릭터 그림을 Storage 에 올리고 공개 URL 을 돌려준다.
 * 모임 포스터(uploadGatheringImage)와 같은 규약 — 업로드가 실패하면 빈 문자열이다.
 * objectURL 을 돌려주면 안 된다: blob: 은 만든 탭에서만 열려 다른 사람에겐 영영 깨진 이미지가 된다.
 *
 * 경로에 이름·이메일을 쓰지 않는다. 버킷이 공개라 경로가 그대로 URL 이 되기 때문이다.
 */
export async function uploadCharacterImage(profileKey: string, file: File): Promise<string> {
  if (!supabase) return '';

  const safeKey = profileKey.replace(/[^\w.\-]+/g, '_');
  const storagePath = tenantPath(`${safeKey}/${file.name}`);
  const { error } = await supabase.storage.from(CHARACTER_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.warn('Supabase character image upload failed. 캐릭터 없이 저장합니다.', error);
    return '';
  }

  const { data } = supabase.storage.from(CHARACTER_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
