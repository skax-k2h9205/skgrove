package com.hyubs.skonnection.net

import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.json.Json

/**
 * iOS `Supabase.swift` 이식 — URLSession REST 대응 Ktor 클라이언트.
 * URL/헤더 구성은 순수 함수로 두어 단위테스트한다.
 */
class SupabaseClient(
    private val http: HttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true; encodeDefaults = true },
) {
    fun restUrl(table: String, query: String): String {
        val base = "${SupabaseConfig.URL}/rest/v1/$table"
        return if (query.isBlank()) base else "$base?$query"
    }

    fun headers(): Map<String, String> = mapOf(
        "apikey" to SupabaseConfig.ANON_KEY,
        "Authorization" to "Bearer ${SupabaseConfig.ANON_KEY}",
        "Content-Type" to "application/json",
    )

    private fun io.ktor.client.request.HttpRequestBuilder.applyHeaders() {
        headers().forEach { (k, v) -> if (k != "Content-Type") header(k, v) }
        contentType(ContentType.Application.Json)
    }

    /** 테이블 조회. query 예: "select=*&order=created_at.desc". */
    suspend fun <T> select(
        table: String,
        query: String = "select=*",
        deserializer: DeserializationStrategy<List<T>>,
    ): List<T> {
        val resp = http.get(restUrl(table, query)) { applyHeaders() }
        return json.decodeFromString(deserializer, resp.bodyAsText())
    }

    /** 업서트(PK 충돌 시 병합). iOS upsert(onConflict:) 대응. */
    suspend fun <T> upsert(
        table: String,
        row: T,
        serializer: SerializationStrategy<T>,
        onConflict: String = "id",
    ) {
        http.post(restUrl(table, "on_conflict=$onConflict")) {
            applyHeaders()
            header("Prefer", "resolution=merge-duplicates,return=minimal")
            setBody(json.encodeToString(serializer, row))
        }
    }

    /** 삽입(return=minimal). */
    suspend fun <T> insert(table: String, row: T, serializer: SerializationStrategy<T>) {
        http.post(restUrl(table, "")) {
            applyHeaders()
            header("Prefer", "return=minimal")
            setBody(json.encodeToString(serializer, row))
        }
    }

    /** id 기준 부분 수정. */
    suspend fun <T> patch(table: String, id: String, fields: T, serializer: SerializationStrategy<T>) {
        http.patch(restUrl(table, "id=eq.$id")) {
            applyHeaders()
            header("Prefer", "return=minimal")
            setBody(json.encodeToString(serializer, fields))
        }
    }

    /** 임의 필터로 부분 수정(예: filter = "recipient_name=eq.홍길동"). 여러 행을 한 번에 고칠 때. */
    suspend fun <T> patchWhere(table: String, filter: String, fields: T, serializer: SerializationStrategy<T>) {
        http.patch(restUrl(table, filter)) {
            applyHeaders()
            header("Prefer", "return=minimal")
            setBody(json.encodeToString(serializer, fields))
        }
    }

    /** 임의 필터로 삭제(예: filter = "id=eq.X"). */
    suspend fun delete(table: String, filter: String) {
        http.delete(restUrl(table, filter)) {
            applyHeaders()
            header("Prefer", "return=minimal")
        }
    }
}
