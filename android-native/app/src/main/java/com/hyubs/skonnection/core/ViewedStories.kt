package com.hyubs.skonnection.core

import android.content.Context

/**
 * 인스타처럼 '본 스토리'를 기록한다 — 본 번개는 트레이 뒤로 밀리고 링이 회색이 된다.
 * 웹(localStorage `skgrove:viewedStories`)·iOS(UserDefaults `skonnection.viewedStories`)와 같은 규칙.
 * 화면 정렬에만 쓰는 값이라 동기 SharedPreferences 로 충분하다(DataStore 의 비동기가 정렬을 늦춘다).
 */
class ViewedStories(context: Context) {
    private val prefs = context.getSharedPreferences("skonnection_viewed_stories", Context.MODE_PRIVATE)
    private val key = "ids"

    fun all(): Set<String> = prefs.getStringSet(key, emptySet()).orEmpty()

    fun mark(id: String) {
        prefs.edit().putStringSet(key, all() + id).apply()
    }
}
