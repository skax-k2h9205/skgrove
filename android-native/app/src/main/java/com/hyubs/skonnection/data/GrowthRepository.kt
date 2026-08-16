package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

/** 성장 카드 데이터 — 웹·iOS와 공유하는 Supabase 3테이블(growth_goals/competencies/log). */
class GrowthRepository(private val supabase: SupabaseClient) {
    suspend fun loadGoals(): List<GrowthGoal> =
        supabase.select("growth_goals", "select=*", ListSerializer(GoalRow.serializer())).map { it.toModel() }

    suspend fun loadLevels(): List<CompetencyLevel> =
        supabase.select("growth_competencies", "select=*", ListSerializer(LevelRow.serializer())).map { it.toModel() }

    suspend fun loadLog(): List<CompetencyLogEntry> =
        supabase.select("growth_competency_log", "select=*&order=at.asc", ListSerializer(LogRow.serializer())).map { it.toModel() }

    suspend fun upsertGoal(g: GrowthGoal) = supabase.upsert("growth_goals", GoalRow.of(g), GoalRow.serializer(), "id")
    suspend fun upsertLevel(l: CompetencyLevel) = supabase.upsert("growth_competencies", LevelRow.of(l), LevelRow.serializer(), "id")
    suspend fun insertLog(e: CompetencyLogEntry) = supabase.insert("growth_competency_log", LogRow.of(e), LogRow.serializer())
}
