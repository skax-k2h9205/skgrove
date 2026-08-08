package com.hyubs.skonnection.net

/**
 * 웹앱·iOS 앱과 **같은** Supabase 프로젝트를 공유한다. anon 키는 웹 번들에 그대로
 * 노출되는 공개값(JWT role=anon)이라 클라이언트에 임베드해도 안전하다(서버측 RLS 보호).
 */
object SupabaseConfig {
    const val URL = "https://sjymcpjbmsqapsptvlml.supabase.co"
    const val ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeW1jcGpibXNxYXBzcHR2bG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjMzOTYsImV4cCI6MjEwMTI5OTM5Nn0.pgAVA8T9fJ-Fg9YHhlgbzR8dw6OVkPn53mX6H-GM3Wo"
}
