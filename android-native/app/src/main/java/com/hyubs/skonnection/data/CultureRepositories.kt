package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class ProfileRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Profile> =
        supabase.select("profiles", "select=*", ListSerializer(ProfileRow.serializer())).map { it.toProfile() }
}

class MemoryRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<TeamMemory> =
        supabase.select("team_memories", "select=*&order=event_date.desc", ListSerializer(MemoryRow.serializer()))
            .map { it.toMemory() }
}

class MeetingRepository(private val supabase: SupabaseClient) {
    suspend fun loadCanSessions(): List<CanSession> =
        supabase.select("can_sessions", "select=*", ListSerializer(CanSessionRow.serializer())).map { it.toCanSession() }

    suspend fun loadTeaSessions(): List<TeaSession> =
        supabase.select("tea_sessions", "select=*", ListSerializer(TeaSessionRow.serializer())).map { it.toTeaSession() }
}
