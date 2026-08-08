package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class IssueRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Issue> =
        supabase.select("issues", "select=*&order=created_at.desc", ListSerializer(IssueRow.serializer()))
            .map { it.toIssue() }
}

class AgendaRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Agenda> =
        supabase.select("agendas", "select=*&order=created_at.desc", ListSerializer(AgendaRow.serializer()))
            .map { it.toAgenda() }
}

class ActionRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<ActionItem> =
        supabase.select("action_items", "select=*&order=created_at.desc", ListSerializer(ActionRow.serializer()))
            .map { it.toActionItem() }
}

class NotificationRepository(private val supabase: SupabaseClient) {
    suspend fun loadFor(recipientName: String): List<AppNotification> =
        supabase.select(
            "notifications",
            "select=*&recipient_name=eq.$recipientName&order=created_at.desc",
            ListSerializer(NotificationRow.serializer()),
        ).map { it.toNotification() }
}
