package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class ProfileRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Profile> =
        supabase.select("profiles", "select=*", ListSerializer(ProfileRow.serializer())).map { it.toProfile() }
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
