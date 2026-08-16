package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class ProfileRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Profile> =
        supabase.select("profiles", "select=*", ListSerializer(ProfileRow.serializer())).map { it.toProfile() }

    /** 마이페이지 저장 — profile_key(=이메일) 기준 업서트. 웹·iOS와 같은 profiles 테이블. */
    suspend fun upsertMine(email: String, name: String, part: String, mbti: String, disc: String, collabGuide: String) =
        supabase.upsert(
            "profiles",
            ProfileUpsert(profile_key = email, owner_email = email, name = name, part = part,
                mbti_type = mbti, disc_type = disc, collab_guide = collabGuide),
            ProfileUpsert.serializer(),
            onConflict = "profile_key",
        )
}

/** 마이페이지 → profiles 업서트 페이로드(iOS SupabaseProfileUpsert 대응). */
@kotlinx.serialization.Serializable
data class ProfileUpsert(
    val profile_key: String,
    val owner_email: String,
    val name: String,
    val part: String,
    val mbti_type: String,
    val disc_type: String,
    val collab_guide: String,
)

/** 조 뽑기 결과 저장(connect_results). */
class ConnectRepository(private val supabase: SupabaseClient) {
    suspend fun save(row: ConnectResultRow) = supabase.insert("connect_results", row, ConnectResultRow.serializer())
}

class MemoryRepository(private val supabase: SupabaseClient) {
    /**
     * 앨범과 사진을 함께 읽는다.
     *
     * 사진은 team_memories가 아니라 team_memory_assets에 따로 있다. 앨범만 읽으면
     * 화면에 제목·날짜만 남아 "사진이 안 보이는" 상태가 된다.
     * 두 번 조회하고 memory_id로 묶는다 — 앨범 수가 수십 단위라 조인 없이 충분하다.
     */
    suspend fun loadAll(): List<TeamMemory> {
        val memories = supabase.select(
            "team_memories", "select=*&order=event_date.desc", ListSerializer(MemoryRow.serializer()),
        )
        val byMemory = supabase.select(
            "team_memory_assets", "select=*&order=uploaded_at.desc", ListSerializer(MemoryAssetRow.serializer()),
        ).map { it.toAsset() }.groupBy { it.memoryId }
        return memories.map { it.toMemory(byMemory[it.id].orEmpty()) }
    }
}

class MeetingRepository(private val supabase: SupabaseClient) {
    suspend fun loadCanSessions(): List<CanSession> =
        supabase.select("can_sessions", "select=*", ListSerializer(CanSessionRow.serializer())).map { it.toCanSession() }

    suspend fun loadTeaSessions(): List<TeaSession> =
        supabase.select("tea_sessions", "select=*", ListSerializer(TeaSessionRow.serializer())).map { it.toTeaSession() }
}
