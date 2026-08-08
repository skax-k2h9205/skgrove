import { supabase } from './supabaseClient';
import type { CurrentUser, Profile } from './types';

const PROFILE_STORAGE_KEY = 'skgrove:profiles';
const PROFILE_USER_KEY_PREFIX = 'skgrove:profile:';
const PROFILE_TABLE = 'profiles';

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
};

export async function loadProfiles(fallback: Profile[], currentUser: CurrentUser) {
  if (supabase) {
    const { data, error } = await supabase.from(PROFILE_TABLE).select('*').order('part').order('name');

    if (!error && data) {
      const loaded = (data as ProfileRow[]).map(profileFromRow);
      const merged = mergeCurrentUserProfile(loaded.length > 0 ? loaded : fallback, currentUser);
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

  if (!supabase) return;

  const { error } = await supabase.from(PROFILE_TABLE).upsert(profiles.map((profile) => profileToRow(profile)), {
    onConflict: 'profile_key',
  });

  if (error) {
    console.warn('Supabase profile save failed. Local fallback is still updated.', error);
  }
}

export async function saveProfileForUser(profile: Profile, currentUser: CurrentUser, profiles: Profile[]) {
  const nextProfiles = [profile, ...profiles.filter((item) => item.name !== profile.name)];
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
  window.localStorage.setItem(`${PROFILE_USER_KEY_PREFIX}${currentUser.email.toLowerCase()}`, JSON.stringify(profile));

  if (!supabase) return;

  const { error } = await supabase.from(PROFILE_TABLE).upsert(profileToRow(profile, currentUser.email), {
    onConflict: 'profile_key',
  });

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

function profileFromRow(row: ProfileRow): Profile {
  return {
    name: row.name,
    part: row.part,
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
  };
}
