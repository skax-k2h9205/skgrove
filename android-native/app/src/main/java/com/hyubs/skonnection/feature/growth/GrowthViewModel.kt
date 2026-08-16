package com.hyubs.skonnection.feature.growth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.CompetencyLevel
import com.hyubs.skonnection.data.CompetencyLogEntry
import com.hyubs.skonnection.data.GrowthGoal
import com.hyubs.skonnection.data.GrowthRules
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 성장 카드 상태·액션 — iOS GrowthStore 이식. 낙관적 반영 후 Supabase 영속. */
class GrowthViewModel(private val c: AppContainer) : ViewModel() {
    private val _goals = MutableStateFlow<List<GrowthGoal>>(emptyList()); val goals = _goals.asStateFlow()
    private val _levels = MutableStateFlow<List<CompetencyLevel>>(emptyList()); val levels = _levels.asStateFlow()
    private val _log = MutableStateFlow<List<CompetencyLogEntry>>(emptyList()); val log = _log.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _loading.value = true
        runCatching { c.growthRepository.loadGoals() }.getOrNull()?.let { _goals.value = it }
        runCatching { c.growthRepository.loadLevels() }.getOrNull()?.let { _levels.value = it }
        runCatching { c.growthRepository.loadLog() }.getOrNull()?.let { _log.value = it }
        _loading.value = false
    }

    private fun today() = java.time.LocalDate.now().toString()
    private fun makeId(prefix: String) = "$prefix-" + System.currentTimeMillis().toString(36).uppercase()

    fun levelFor(ownerEmail: String, competency: String): CompetencyLevel? =
        _levels.value.firstOrNull { it.ownerEmail.equals(ownerEmail, true) && it.competency == competency }

    // ── 목표 ──
    fun addGoal(ownerEmail: String, title: String, detail: String, due: String) {
        val g = GrowthGoal(makeId("GRW"), ownerEmail, title, detail, due, 0, "진행중", "", today(), today())
        _goals.value = listOf(g) + _goals.value
        viewModelScope.launch { runCatching { c.growthRepository.upsertGoal(g) } }
    }

    fun updateGoal(id: String, mutate: (GrowthGoal) -> GrowthGoal) {
        val cur = _goals.value.firstOrNull { it.id == id } ?: return
        val next = mutate(cur).copy(updatedAt = today())
        _goals.value = _goals.value.map { if (it.id == id) next else it }
        viewModelScope.launch { runCatching { c.growthRepository.upsertGoal(next) } }
    }

    fun setProgress(id: String, progress: Int) = updateGoal(id) {
        it.copy(progress = GrowthRules.clampProgress(progress), status = GrowthRules.nextStatus(progress))
    }
    fun setLeaderComment(id: String, comment: String) = updateGoal(id) { it.copy(leaderComment = comment) }

    // ── 역량 레벨 ──
    fun setSelfLevel(ownerEmail: String, competency: String, level: Int) {
        val lv = GrowthRules.clampLevel(level)
        upsertLevel(ownerEmail, competency) { it.copy(selfLevel = lv) }
        appendLog(ownerEmail, competency, lv, "self")
    }
    fun setEvidence(ownerEmail: String, competency: String, evidence: String) {
        upsertLevel(ownerEmail, competency) { it.copy(evidence = evidence) }
    }
    fun setLeaderLevel(lvl: CompetencyLevel, level: Int) {
        val v = GrowthRules.clampLevel(level)
        val next = lvl.copy(leaderLevel = v, updatedAt = today())
        _levels.value = _levels.value.map { if (it.id == lvl.id) next else it }
        viewModelScope.launch { runCatching { c.growthRepository.upsertLevel(next) } }
        appendLog(lvl.ownerEmail, lvl.competency, v, "leader")
    }

    private fun upsertLevel(ownerEmail: String, competency: String, mutate: (CompetencyLevel) -> CompetencyLevel) {
        val existing = _levels.value.firstOrNull { it.ownerEmail.equals(ownerEmail, true) && it.competency == competency }
        val next = if (existing != null) mutate(existing).copy(updatedAt = today())
        else mutate(CompetencyLevel(makeId("GRC"), ownerEmail, competency, 1, null, "", today())).copy(updatedAt = today())
        _levels.value = if (existing != null) _levels.value.map { if (it.id == next.id) next else it }
        else _levels.value + next
        viewModelScope.launch { runCatching { c.growthRepository.upsertLevel(next) } }
    }

    private fun appendLog(ownerEmail: String, competency: String, level: Int, by: String) {
        val e = CompetencyLogEntry(makeId("GLG"), ownerEmail, competency, level, by, java.time.Instant.now().toString())
        _log.value = _log.value + e
        viewModelScope.launch { runCatching { c.growthRepository.insertLog(e) } }
    }
}
