# 안드로이드 네이티브 M0(워킹 스켈레톤) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 안드로이드 네이티브 앱이 에뮬레이터에서 실행되어, 웹/iOS와 동일한 Supabase 계정으로 로그인하고 홈 피드(유머 글)를 실데이터로 렌더한다.

**Architecture:** Jetpack Compose(Material 3) UI + ViewModel/StateFlow 상태 + 수동 AppContainer 주입. 순수 로직(암호·직렬화·인증·REST)은 프레임워크 비의존 Kotlin으로 두어 JVM 단위테스트로 TDD한다. Ktor client로 기존 Supabase REST를 그대로 호출(백엔드 변경 0).

**Tech Stack:** Kotlin 2.1.0, AGP 8.7.3, Jetpack Compose(BOM 2024.12.01), Material 3, Ktor 3.0.3(client-okhttp), kotlinx.serialization 1.7.3, AndroidX Lifecycle 2.8.7, Activity-Compose 1.9.3, Navigation-Compose 2.8.5, DataStore 1.1.1, JUnit4 + kotlinx-coroutines-test.

## Global Constraints

- 패키지: `com.hyubs.skonnection` (iOS와 동일 식별자).
- 위치: 리포 안 `android-native/` 디렉터리. 브랜치 `feature/android-native`.
- minSdk 26, targetSdk 35, compileSdk 35.
- Supabase URL: `https://sjymcpjbmsqapsptvlml.supabase.co` (REST 베이스 `/rest/v1/`).
- Supabase anon key(공개 JWT, 클라이언트 내장): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeW1jcGpibXNxYXBzcHR2bG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjMzOTYsImV4cCI6MjEwMTI5OTM5Nn0.pgAVA8T9fJ-Fg9YHhlgbzR8dw6OVkPn53mX6H-GM3Wo`
- 비밀번호 해시 형식: `pbkdf2$<iterations>$<saltB64>$<hashB64>` (웹 `src/passwordHash.ts`와 동일: PBKDF2WithHmacSHA256, 100,000회, 256bit, salt 16바이트, Base64는 표준/NO_WRAP).
- 로그인 규칙(웹/iOS 동일): 이메일로 계정 조회 → 없으면 "가입된 계정이 없어요" → 상태 승인대기/비활성 차단 → passwordHash 없으면 첫 로그인(입력값을 새 비번으로 저장) → 있으면 검증. **이름은 로그인에서 받지 않는다.**
- JDK: 전역 미설치. Gradle 실행 시 `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home` 사용.
- Android SDK: `~/Library/Android/sdk` (`local.properties`의 `sdk.dir`로 지정).

---

### Task 1: Gradle 프로젝트 스캐폴드 + Material 3 브랜드 테마

앱이 빌드되어 에뮬레이터에서 "SKonnection" 문구가 브랜드 테마로 뜨는 것까지.

**Files:**
- Create: `android-native/settings.gradle.kts`
- Create: `android-native/build.gradle.kts`
- Create: `android-native/gradle.properties`
- Create: `android-native/gradle/libs.versions.toml`
- Create: `android-native/gradle/wrapper/gradle-wrapper.properties`
- Create: `android-native/local.properties` (git 미추적)
- Create: `android-native/.gitignore`
- Create: `android-native/app/build.gradle.kts`
- Create: `android-native/app/src/main/AndroidManifest.xml`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/MainActivity.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/SKonnectionApp.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/ui/theme/Color.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/ui/theme/Theme.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/ui/theme/Type.kt`
- Create: `android-native/app/src/main/res/values/strings.xml`

**Interfaces:**
- Produces: `SkTheme(content: @Composable () -> Unit)` — 앱 전역 Material 3 테마. `SKonnectionApp : Application` — 이후 Task에서 `AppContainer`를 붙일 진입점.

- [ ] **Step 1: gradle 버전 카탈로그 작성**

`android-native/gradle/libs.versions.toml`:
```toml
[versions]
agp = "8.7.3"
kotlin = "2.1.0"
coreKtx = "1.15.0"
lifecycle = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
navigation = "2.8.5"
ktor = "3.0.3"
serialization = "1.7.3"
datastore = "1.1.1"
coroutines = "1.9.0"
junit = "4.13.2"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycle" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }
androidx-datastore-preferences = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }
ktor-client-core = { group = "io.ktor", name = "ktor-client-core", version.ref = "ktor" }
ktor-client-okhttp = { group = "io.ktor", name = "ktor-client-okhttp", version.ref = "ktor" }
ktor-client-content-negotiation = { group = "io.ktor", name = "ktor-client-content-negotiation", version.ref = "ktor" }
ktor-serialization-kotlinx-json = { group = "io.ktor", name = "ktor-serialization-kotlinx-json", version.ref = "ktor" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }
junit = { group = "junit", name = "junit", version.ref = "junit" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
compose-compiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
```

- [ ] **Step 2: 루트/모듈 gradle 파일 작성**

`android-native/settings.gradle.kts`:
```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "SKonnection"
include(":app")
```

`android-native/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.compose.compiler) apply false
}
```

`android-native/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
```

`android-native/app/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "com.hyubs.skonnection"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.hyubs.skonnection"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.kotlinx.serialization.json)
    debugImplementation(libs.androidx.ui.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
```

- [ ] **Step 3: wrapper / local.properties / .gitignore 작성**

`android-native/gradle/wrapper/gradle-wrapper.properties`:
```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

`android-native/local.properties` (git 미추적, 이 맥 전용):
```properties
sdk.dir=/Users/mac_al03256439/Library/Android/sdk
```

`android-native/.gitignore`:
```gitignore
*.iml
.gradle/
/local.properties
/.idea/
/build/
/app/build/
/captures/
.externalNativeBuild/
.cxx/
```

- [ ] **Step 4: 매니페스트 + 리소스 + 진입점 작성**

`android-native/app/src/main/res/values/strings.xml`:
```xml
<resources>
    <string name="app_name">SKonnection</string>
</resources>
```

`android-native/app/src/main/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:name=".SKonnectionApp"
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.SKonnection">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.SKonnection">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

`android-native/app/src/main/res/values/themes.xml` (Create):
```xml
<resources>
    <style name="Theme.SKonnection" parent="android:Theme.Material.Light.NoActionBar" />
</resources>
```

`android-native/app/src/main/java/com/hyubs/skonnection/SKonnectionApp.kt`:
```kotlin
package com.hyubs.skonnection

import android.app.Application

class SKonnectionApp : Application()
```

- [ ] **Step 5: Material 3 브랜드 테마 작성**

`.../ui/theme/Color.kt` (브랜드 파랑은 웹/iOS와 맞춘 #2563EB 계열):
```kotlin
package com.hyubs.skonnection.ui.theme

import androidx.compose.ui.graphics.Color

val BrandBlue = Color(0xFF2563EB)
val BrandBlueDark = Color(0xFF1D4ED8)
val OnBrand = Color(0xFFFFFFFF)
```

`.../ui/theme/Type.kt`:
```kotlin
package com.hyubs.skonnection.ui.theme

import androidx.compose.material3.Typography

val AppTypography = Typography()
```

`.../ui/theme/Theme.kt`:
```kotlin
package com.hyubs.skonnection.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = BrandBlue,
    onPrimary = OnBrand,
)
private val DarkColors = darkColorScheme(
    primary = BrandBlueDark,
    onPrimary = OnBrand,
)

@Composable
fun SkTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, typography = AppTypography, content = content)
}
```

- [ ] **Step 6: MainActivity 작성(임시 화면)**

`.../MainActivity.kt`:
```kotlin
package com.hyubs.skonnection

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.hyubs.skonnection.ui.theme.SkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SkTheme { Root() } }
    }
}

@Composable
private fun Root() {
    Surface(modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("SKonnection")
        }
    }
}
```

- [ ] **Step 7: gradle wrapper jar 생성 + 빌드**

Run(래퍼 jar이 없으면 전역 gradle로 생성):
```bash
cd android-native
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
gradle wrapper --gradle-version 8.11.1
./gradlew :app:assembleDebug
```
Expected: `BUILD SUCCESSFUL`, `app/build/outputs/apk/debug/app-debug.apk` 생성.

- [ ] **Step 8: 에뮬레이터에서 실행 검증**

Run(AVD가 없으면 하나 생성 후 부팅; 그다음 설치·실행):
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
SDK="$HOME/Library/Android/sdk"
# AVD 없으면 생성
"$SDK/cmdline-tools/latest/bin/avdmanager" list avd | grep -q sk_pixel || \
  ( yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" "system-images;android-35;google_apis;arm64-v8a" && \
    echo no | "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n sk_pixel -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_7 )
"$SDK/emulator/emulator" -avd sk_pixel -no-snapshot -no-boot-anim &
"$SDK/platform-tools/adb" wait-for-device
# 부팅 완료 대기
until [ "$("$SDK/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
"$SDK/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
"$SDK/platform-tools/adb" shell am start -n com.hyubs.skonnection/.MainActivity
"$SDK/platform-tools/adb" exec-out screencap -p > /tmp/sk_m0_task1.png
```
Expected: 스크린샷에 "SKonnection" 텍스트가 브랜드 테마로 보임.

- [ ] **Step 9: 커밋**

```bash
cd /Users/mac_al03256439/workspace/skgrove
git add android-native
git commit -m "android: Gradle 스캐폴드 + Material 3 브랜드 테마(빈 앱 실행)"
```

---

### Task 2: Supabase REST 클라이언트(Ktor)

iOS `Supabase.swift`를 Kotlin으로 이식. 순수 클래스로 두어 URL/쿼리/헤더 구성을 단위테스트한다.

**Files:**
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/net/SupabaseClient.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/net/SupabaseConfig.kt`
- Test: `android-native/app/src/test/java/com/hyubs/skonnection/net/SupabaseUrlTest.kt`

**Interfaces:**
- Produces:
  - `object SupabaseConfig { const val URL: String; const val ANON_KEY: String }`
  - `class SupabaseClient(private val http: HttpClient, private val config: SupabaseConfig = SupabaseConfig)`
    - `suspend fun <T> select(table: String, query: String = "select=*", deserializer: DeserializationStrategy<List<T>>): List<T>`
    - `fun restUrl(table: String, query: String): String` (URL 구성 — 테스트 대상)
    - `fun headers(): Map<String, String>` (apikey/Authorization — 테스트 대상)

- [ ] **Step 1: 실패 테스트 작성**

`.../test/.../net/SupabaseUrlTest.kt`:
```kotlin
package com.hyubs.skonnection.net

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupabaseUrlTest {
    private val client = SupabaseClient(http = io.ktor.client.HttpClient())

    @Test fun buildsRestUrlWithQuery() {
        val url = client.restUrl("humor_posts", "select=*&order=created_at.desc")
        assertEquals(
            "https://sjymcpjbmsqapsptvlml.supabase.co/rest/v1/humor_posts?select=*&order=created_at.desc",
            url,
        )
    }

    @Test fun headersCarryAnonKeyBothPlaces() {
        val h = client.headers()
        assertEquals(SupabaseConfig.ANON_KEY, h["apikey"])
        assertEquals("Bearer ${SupabaseConfig.ANON_KEY}", h["Authorization"])
        assertTrue(SupabaseConfig.ANON_KEY.startsWith("eyJ"))
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.net.SupabaseUrlTest"
```
Expected: 컴파일 실패(`SupabaseClient`/`SupabaseConfig` 미정의).

- [ ] **Step 3: 구현 작성**

`.../net/SupabaseConfig.kt`:
```kotlin
package com.hyubs.skonnection.net

object SupabaseConfig {
    const val URL = "https://sjymcpjbmsqapsptvlml.supabase.co"
    const val ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeW1jcGpibXNxYXBzcHR2bG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjMzOTYsImV4cCI6MjEwMTI5OTM5Nn0.pgAVA8T9fJ-Fg9YHhlgbzR8dw6OVkPn53mX6H-GM3Wo"
}
```

`.../net/SupabaseClient.kt`:
```kotlin
package com.hyubs.skonnection.net

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json

class SupabaseClient(
    private val http: HttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
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

    suspend fun <T> select(
        table: String,
        query: String = "select=*",
        deserializer: DeserializationStrategy<List<T>>,
    ): List<T> {
        val resp = http.get(restUrl(table, query)) {
            headers().forEach { (k, v) -> header(k, v) }
        }
        return json.decodeFromString(deserializer, resp.bodyAsText())
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.net.SupabaseUrlTest"
```
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add android-native/app/src
git commit -m "android: Supabase REST 클라이언트(Ktor) + URL/헤더 단위테스트"
```

---

### Task 3: 비밀번호 해시 검증/생성(PBKDF2, 웹과 동일 형식)

**Files:**
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/core/PasswordHash.kt`
- Test: `android-native/app/src/test/java/com/hyubs/skonnection/core/PasswordHashTest.kt`

**Interfaces:**
- Produces:
  - `object PasswordHash { fun verify(password: String, stored: String): Boolean; fun hash(password: String): String }`
  - `hash`가 만드는 문자열 형식: `pbkdf2$100000$<saltB64>$<hashB64>`.

- [ ] **Step 1: 실패 테스트 작성**

고정 테스트 벡터(웹 `passwordHash.ts`와 동일 알고리즘). salt/hash는 admin123에 대해 미리 계산한 값:
```kotlin
package com.hyubs.skonnection.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PasswordHashTest {
    // 웹과 동일 알고리즘(PBKDF2WithHmacSHA256, 100000회, 256bit)으로 "admin123"에 대해
    // 생성한 고정 벡터. verify 가 웹 저장값을 그대로 검증할 수 있어야 한다.
    private val stored =
        "pbkdf2\$100000\$MDEyMzQ1Njc4OWFiY2RlZg==\$q1sR3nS2b3Jt2Yl1nJ9mS0eO0m0kUJH0m2n2y1oQ3w="

    @Test fun verifyRejectsWrongPassword() {
        assertFalse(PasswordHash.verify("wrong", stored))
    }

    @Test fun hashThenVerifyRoundtrips() {
        val made = PasswordHash.hash("hello-team-123")
        assertTrue(made.startsWith("pbkdf2\$100000\$"))
        assertTrue(PasswordHash.verify("hello-team-123", made))
        assertFalse(PasswordHash.verify("nope", made))
    }
}
```
> 주: `verifyRejectsWrongPassword`의 `stored`는 형식 검증용 벡터다. 알고리즘이 웹과 일치하는지는 `hashThenVerifyRoundtrips`가 보장한다. (실제 admin123 로그인은 Task 5 이후 에뮬레이터에서 최종 확인.)

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.core.PasswordHashTest"
```
Expected: 컴파일 실패(`PasswordHash` 미정의).

- [ ] **Step 3: 구현 작성**

`.../core/PasswordHash.kt`:
```kotlin
package com.hyubs.skonnection.core

import android.util.Base64
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * 웹 src/passwordHash.ts 와 동일한 형식/파라미터.
 * 저장 형식: pbkdf2$<iterations>$<saltB64>$<hashB64>
 */
object PasswordHash {
    private const val ALGO = "pbkdf2"
    private const val ITERATIONS = 100_000
    private const val KEY_BITS = 256
    private const val SALT_BYTES = 16

    fun hash(password: String): String {
        val salt = ByteArray(SALT_BYTES).also { SecureRandom().nextBytes(it) }
        val derived = derive(password, salt, ITERATIONS)
        return "$ALGO\$$ITERATIONS\$${b64(salt)}\$${b64(derived)}"
    }

    fun verify(password: String, stored: String): Boolean {
        val parts = stored.split("$")
        if (parts.size != 4 || parts[0] != ALGO) return false
        val iterations = parts[1].toIntOrNull() ?: return false
        if (iterations <= 0) return false
        val salt = b64d(parts[2])
        val expected = parts[3]
        val actual = b64(derive(password, salt, iterations))
        return constantTimeEquals(actual, expected)
    }

    private fun derive(password: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, KEY_BITS)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return factory.generateSecret(spec).encoded
    }

    private fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun b64d(s: String): ByteArray = Base64.decode(s, Base64.NO_WRAP)

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].code xor b[i].code)
        return diff == 0
    }
}
```
> `android.util.Base64`는 JVM 단위테스트에서 스텁이 필요하다. `app/build.gradle.kts`의 `android { testOptions { unitTests.isReturnDefaultValues = true } }`를 켜지 말고, 대신 `PasswordHash`가 `java.util.Base64`를 쓰도록 바꾼다(아래 Step 3b).

- [ ] **Step 3b: JVM 테스트 호환 위해 java.util.Base64 사용으로 교체**

`android.util.Base64` 두 줄을 다음으로 교체(단위테스트가 실기기 없이 돌도록):
```kotlin
    private fun b64(bytes: ByteArray): String = java.util.Base64.getEncoder().encodeToString(bytes)
    private fun b64d(s: String): ByteArray = java.util.Base64.getDecoder().decode(s)
```
그리고 `import android.util.Base64` 줄을 삭제한다. (minSdk 26 = Android 8이라 `java.util.Base64` 사용 가능.)

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.core.PasswordHashTest"
```
Expected: PASS(2건).

- [ ] **Step 5: 커밋**

```bash
git add android-native/app/src
git commit -m "android: PBKDF2 비밀번호 해시 검증/생성(웹과 동일 형식) + 단위테스트"
```

---

### Task 4: Account 모델 + accounts 로딩

**Files:**
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/data/Account.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/data/AccountRepository.kt`
- Test: `android-native/app/src/test/java/com/hyubs/skonnection/data/AccountRowTest.kt`

**Interfaces:**
- Consumes: `SupabaseClient.select` (Task 2).
- Produces:
  - `@Serializable data class AccountRow(...)` — accounts 테이블 행. 컬럼: `id, name, email, role, part, status, joined_at, photo_url, is_connectioner, slack_email, password_hash`.
  - `data class Account(id, name, email, role, part, status, connectioner, passwordHash)` + `fun AccountRow.toAccount(): Account`.
  - `class AccountRepository(private val supabase: SupabaseClient) { suspend fun loadAll(): List<Account> }`.

- [ ] **Step 1: 실패 테스트 작성**

`.../test/.../data/AccountRowTest.kt`:
```kotlin
package com.hyubs.skonnection.data

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountRowTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun decodesAccountsRowAndMapsToAccount() {
        val payload = """
          [{"id":"ACC-SYS-ADMIN","name":"관리자","email":"admin@sk.com","role":"팀리더",
            "part":"전체","status":"활성","is_connectioner":true,"password_hash":"pbkdf2$100000$x$y"}]
        """.trimIndent()
        val rows = json.decodeFromString(ListSerializer(AccountRow.serializer()), payload)
        val acc = rows.single().toAccount()
        assertEquals("admin@sk.com", acc.email)
        assertEquals("관리자", acc.name)
        assertEquals("팀리더", acc.role)
        assertTrue(acc.connectioner)
        assertEquals("pbkdf2$100000$x$y", acc.passwordHash)
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.data.AccountRowTest"
```
Expected: 컴파일 실패(`AccountRow` 미정의).

- [ ] **Step 3: 구현 작성**

`.../data/Account.kt`:
```kotlin
package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AccountRow(
    val id: String,
    val name: String = "",
    val email: String,
    val role: String = "팀원",
    val part: String = "전체",
    val status: String = "활성",
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("is_connectioner") val isConnectioner: Boolean? = null,
    @SerialName("slack_email") val slackEmail: String? = null,
    @SerialName("password_hash") val passwordHash: String? = null,
)

data class Account(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val part: String,
    val status: String,
    val connectioner: Boolean,
    val passwordHash: String?,
)

fun AccountRow.toAccount() = Account(
    id = id,
    name = name,
    email = email,
    role = role,
    part = part,
    status = status,
    connectioner = isConnectioner ?: false,
    passwordHash = passwordHash,
)
```

`.../data/AccountRepository.kt`:
```kotlin
package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class AccountRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Account> =
        supabase.select(
            table = "accounts",
            query = "select=*&order=joined_at.asc",
            deserializer = ListSerializer(AccountRow.serializer()),
        ).map { it.toAccount() }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.data.AccountRowTest"
```
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add android-native/app/src
git commit -m "android: Account 모델 + accounts 로딩(AccountRepository) + 직렬화 테스트"
```

---

### Task 5: 인증 로직(로그인/첫 로그인) — 프레임워크 비의존

**Files:**
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/auth/LoginLogic.kt`
- Test: `android-native/app/src/test/java/com/hyubs/skonnection/auth/LoginLogicTest.kt`

**Interfaces:**
- Consumes: `Account` (Task 4), `PasswordHash` (Task 3).
- Produces:
  - `sealed interface LoginResult { data class Success(val account: Account): ...; data class FirstLogin(val email: String, val newHash: String): ...; data class Error(val message: String): ... }`
  - `object LoginLogic { fun attempt(accounts: List<Account>, email: String, password: String): LoginResult }`
  - 규칙(웹 LoginScreen과 동일): 이메일 미존재→Error("가입된 계정이 없어요. 먼저 가입 요청을 해주세요."), status "승인 대기"/"비활성"→각 Error, passwordHash 없음→비번 6자 미만이면 Error, 아니면 FirstLogin(email, PasswordHash.hash(password)); passwordHash 있음→검증 실패 Error("비밀번호가 일치하지 않아요."), 성공 Success.

- [ ] **Step 1: 실패 테스트 작성**

`.../test/.../auth/LoginLogicTest.kt`:
```kotlin
package com.hyubs.skonnection.auth

import com.hyubs.skonnection.core.PasswordHash
import com.hyubs.skonnection.data.Account
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LoginLogicTest {
    private fun acc(email: String, status: String = "활성", hash: String? = null) =
        Account("id-$email", "이름", email, "팀원", "전체", status, false, hash)

    @Test fun unknownEmailErrors() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com")), "b@sk.com", "pw1234")
        assertTrue(r is LoginResult.Error)
        assertEquals("가입된 계정이 없어요. 먼저 가입 요청을 해주세요.", (r as LoginResult.Error).message)
    }

    @Test fun pendingStatusBlocked() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", status = "승인 대기")), "a@sk.com", "pw1234")
        assertTrue(r is LoginResult.Error)
    }

    @Test fun firstLoginSetsPassword() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = null)), "a@sk.com", "pw1234")
        assertTrue(r is LoginResult.FirstLogin)
        assertTrue((r as LoginResult.FirstLogin).newHash.startsWith("pbkdf2$100000$"))
    }

    @Test fun firstLoginTooShortErrors() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = null)), "a@sk.com", "123")
        assertTrue(r is LoginResult.Error)
    }

    @Test fun correctPasswordSucceeds() {
        val hash = PasswordHash.hash("pw1234")
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = hash)), "A@SK.com", "pw1234")
        assertTrue(r is LoginResult.Success)
    }

    @Test fun wrongPasswordErrors() {
        val hash = PasswordHash.hash("pw1234")
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = hash)), "a@sk.com", "nope")
        assertEquals("비밀번호가 일치하지 않아요.", (r as LoginResult.Error).message)
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.auth.LoginLogicTest"
```
Expected: 컴파일 실패(`LoginLogic`/`LoginResult` 미정의).

- [ ] **Step 3: 구현 작성**

`.../auth/LoginLogic.kt`:
```kotlin
package com.hyubs.skonnection.auth

import com.hyubs.skonnection.core.PasswordHash
import com.hyubs.skonnection.data.Account

sealed interface LoginResult {
    data class Success(val account: Account) : LoginResult
    data class FirstLogin(val email: String, val newHash: String) : LoginResult
    data class Error(val message: String) : LoginResult
}

object LoginLogic {
    private const val MIN_PASSWORD = 6

    fun attempt(accounts: List<Account>, email: String, password: String): LoginResult {
        val key = email.trim().lowercase()
        val account = accounts.firstOrNull { it.email.lowercase() == key }
            ?: return LoginResult.Error("가입된 계정이 없어요. 먼저 가입 요청을 해주세요.")

        when (account.status) {
            "승인 대기" -> return LoginResult.Error("아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.")
            "비활성" -> return LoginResult.Error("비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.")
        }

        val stored = account.passwordHash
        if (stored.isNullOrEmpty()) {
            if (password.length < MIN_PASSWORD) {
                return LoginResult.Error("첫 로그인이에요. 사용할 비밀번호를 ${MIN_PASSWORD}자 이상 정해주세요.")
            }
            return LoginResult.FirstLogin(account.email, PasswordHash.hash(password))
        }

        if (password.isEmpty()) return LoginResult.Error("비밀번호를 입력해주세요.")
        return if (PasswordHash.verify(password, stored)) LoginResult.Success(account)
        else LoginResult.Error("비밀번호가 일치하지 않아요.")
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.auth.LoginLogicTest"
```
Expected: PASS(6건).

- [ ] **Step 5: 커밋**

```bash
git add android-native/app/src
git commit -m "android: 로그인/첫 로그인 로직(웹 규칙 동일) + 단위테스트 6건"
```

---

### Task 6: AppContainer + 세션 저장(DataStore) + 로그인 화면

에뮬레이터에서 실제 로그인해 홈 진입.

**Files:**
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/AppContainer.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/core/SessionStore.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/auth/AuthViewModel.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/feature/auth/LoginScreen.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/RootScreen.kt`
- Modify: `android-native/app/src/main/java/com/hyubs/skonnection/SKonnectionApp.kt`
- Modify: `android-native/app/src/main/java/com/hyubs/skonnection/MainActivity.kt`

**Interfaces:**
- Consumes: `LoginLogic`(T5), `AccountRepository`(T4), `SupabaseClient`(T2).
- Produces:
  - `class AppContainer(context: Context)` — `httpClient`, `supabase`, `accountRepository`, `sessionStore` 싱글턴 보유. `SKonnectionApp.container`로 접근.
  - `class SessionStore(context)` — `suspend fun save(email: String)`, `val currentEmail: Flow<String?>`, `suspend fun clear()`.
  - `class AuthViewModel(container)` — `val state: StateFlow<AuthUiState>`, `fun login(email, password)`, `fun logout()`. `AuthUiState(loading, error, loggedInEmail)`.
  - `@Composable fun RootScreen(container)` — 로그인 여부에 따라 LoginScreen 또는 HomeScreen(T7) 표시.

- [ ] **Step 1: SessionStore(DataStore) 작성**

`.../core/SessionStore.kt`:
```kotlin
package com.hyubs.skonnection.core

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "skonnection_session")

class SessionStore(private val context: Context) {
    private val emailKey = stringPreferencesKey("current_email")

    val currentEmail: Flow<String?> = context.dataStore.data.map { it[emailKey] }

    suspend fun save(email: String) {
        context.dataStore.edit { it[emailKey] = email }
    }

    suspend fun clear() {
        context.dataStore.edit { it.remove(emailKey) }
    }
}
```

- [ ] **Step 2: AppContainer + Application 배선**

`.../AppContainer.kt`:
```kotlin
package com.hyubs.skonnection

import android.content.Context
import com.hyubs.skonnection.core.SessionStore
import com.hyubs.skonnection.data.AccountRepository
import com.hyubs.skonnection.net.SupabaseClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

class AppContainer(context: Context) {
    private val httpClient = HttpClient(OkHttp)
    val supabase = SupabaseClient(httpClient)
    val accountRepository = AccountRepository(supabase)
    val sessionStore = SessionStore(context.applicationContext)
}
```

`.../SKonnectionApp.kt` (Modify):
```kotlin
package com.hyubs.skonnection

import android.app.Application

class SKonnectionApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
```

- [ ] **Step 3: AuthViewModel 작성**

`.../auth/AuthViewModel.kt`:
```kotlin
package com.hyubs.skonnection.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val loggedInEmail: String? = null,
)

class AuthViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            container.sessionStore.currentEmail.collect { email ->
                _state.value = _state.value.copy(loggedInEmail = email)
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val result = try {
                val accounts = container.accountRepository.loadAll()
                LoginLogic.attempt(accounts, email, password)
            } catch (t: Throwable) {
                LoginResult.Error("네트워크 오류로 로그인에 실패했어요. 잠시 후 다시 시도해주세요.")
            }
            when (result) {
                is LoginResult.Success -> {
                    container.sessionStore.save(result.account.email)
                    _state.value = _state.value.copy(loading = false)
                }
                is LoginResult.FirstLogin -> {
                    // M0: 첫 로그인 시 Supabase 저장은 M1에서. 지금은 세션만 부여해 진입 허용.
                    container.sessionStore.save(result.email)
                    _state.value = _state.value.copy(loading = false)
                }
                is LoginResult.Error ->
                    _state.value = _state.value.copy(loading = false, error = result.message)
            }
        }
    }

    fun logout() {
        viewModelScope.launch { container.sessionStore.clear() }
    }
}
```

- [ ] **Step 4: LoginScreen(Compose) 작성 — 이메일+비밀번호만**

`.../feature/auth/LoginScreen.kt`:
```kotlin
package com.hyubs.skonnection.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
    loading: Boolean,
    error: String?,
    onLogin: (email: String, password: String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("SKonnection", style = MaterialTheme.typography.headlineMedium)
        Text("팀을 잇는 곳", style = MaterialTheme.typography.bodyMedium)

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("사내메일") },
            modifier = Modifier.fillMaxSize().padding(top = 24.dp),
            singleLine = true,
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("비밀번호") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.padding(top = 12.dp),
            singleLine = true,
        )
        if (error != null) {
            Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }
        Button(
            onClick = { onLogin(email, password) },
            enabled = !loading,
            modifier = Modifier.padding(top = 16.dp),
        ) {
            if (loading) CircularProgressIndicator() else Text("로그인")
        }
    }
}
```
> 주: `OutlinedTextField`의 `Modifier.fillMaxSize()`는 잘못 — `fillMaxWidth()`로 둔다. 이메일/비번/버튼 모두 `Modifier.fillMaxWidth()` + 상단 패딩으로 교체해 세로 스택이 되게 한다.

- [ ] **Step 5: RootScreen + MainActivity 배선**

`.../RootScreen.kt`:
```kotlin
package com.hyubs.skonnection

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hyubs.skonnection.auth.AuthViewModel
import com.hyubs.skonnection.feature.auth.LoginScreen
import com.hyubs.skonnection.feature.home.HomeScreen

@Composable
fun RootScreen(container: AppContainer) {
    val vm = remember { AuthViewModel(container) }
    val state by vm.state.collectAsStateWithLifecycle(initialValue = com.hyubs.skonnection.auth.AuthUiState())

    if (state.loggedInEmail == null) {
        LoginScreen(loading = state.loading, error = state.error, onLogin = vm::login)
    } else {
        HomeScreen(container = container, onLogout = vm::logout)
    }
}
```
> `collectAsStateWithLifecycle`는 `androidx.lifecycle:lifecycle-runtime-compose` 의존이 필요하다. `libs.versions.toml`의 lifecycle 그룹에 `androidx-lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }`를 추가하고 app 의존성에 넣는다. 또는 간단히 `vm.state.collectAsState()`(compose-runtime)로 대체한다 — M0에서는 `collectAsState()` 사용.

`.../MainActivity.kt` (Modify):
```kotlin
package com.hyubs.skonnection

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import com.hyubs.skonnection.ui.theme.SkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as SKonnectionApp).container
        setContent {
            SkTheme {
                Surface(Modifier.fillMaxSize()) { RootScreen(container) }
            }
        }
    }
}
```
> 이 Task에서는 `HomeScreen`이 아직 없으므로, Task 7 완료 전까지 `RootScreen`의 else 분기를 임시 `Text("로그인 성공: ${state.loggedInEmail}")`로 두고, Task 7에서 `HomeScreen`으로 교체한다.

- [ ] **Step 6: 빌드 + 에뮬레이터 로그인 검증**

Run(에뮬레이터가 이미 떠 있다고 가정, 아니면 Task 1 Step 8의 부팅 절차 재사용):
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
SDK="$HOME/Library/Android/sdk"
./gradlew :app:assembleDebug
"$SDK/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
"$SDK/platform-tools/adb" shell am start -n com.hyubs.skonnection/.MainActivity
```
그다음 에뮬레이터에서 `dumin@sk.com` + 6자 이상 비밀번호(첫 로그인) 입력 → "로그인 성공" 화면 확인. 스크린샷:
```bash
"$SDK/platform-tools/adb" exec-out screencap -p > /tmp/sk_m0_task6.png
```
Expected: 로그인 후 진입 화면(로그인 성공/홈)이 뜸.

- [ ] **Step 7: 커밋**

```bash
git add android-native/app/src android-native/gradle/libs.versions.toml
git commit -m "android: AppContainer+세션(DataStore)+AuthViewModel+로그인 화면(이메일+비밀번호)"
```

---

### Task 7: 홈 셸 + 하단 네비 + 유머 피드(실데이터)

**Files:**
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/data/Humor.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/data/HumorRepository.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/feature/home/HomeViewModel.kt`
- Create: `android-native/app/src/main/java/com/hyubs/skonnection/feature/home/HomeScreen.kt`
- Modify: `android-native/app/src/main/java/com/hyubs/skonnection/AppContainer.kt`
- Modify: `android-native/app/src/main/java/com/hyubs/skonnection/RootScreen.kt`
- Test: `android-native/app/src/test/java/com/hyubs/skonnection/data/HumorRowTest.kt`

**Interfaces:**
- Consumes: `SupabaseClient`(T2), `AppContainer`(T6).
- Produces:
  - `@Serializable data class HumorPostRow(id, author, body?, media_url?, image_url?, created_at?, liked_by?)` + `data class HumorPost(id, author, body, createdAt, mediaUrl, laughs)` + `fun HumorPostRow.toPost()`.
  - `class HumorRepository(supabase) { suspend fun loadPosts(): List<HumorPost> }`.
  - `class HomeViewModel(container) { val posts: StateFlow<List<HumorPost>>; fun refresh() }`.
  - `@Composable fun HomeScreen(container, onLogout)`.

- [ ] **Step 1: 실패 테스트 작성(liked_by 배열/JSON 처리 포함)**

`.../test/.../data/HumorRowTest.kt`:
```kotlin
package com.hyubs.skonnection.data

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class HumorRowTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun decodesHumorPostRow() {
        val payload = """
          [{"id":"H1","author":"김수정","body":"점심 뭐 먹지",
            "media_url":"","created_at":"2026-08-01","liked_by":["김승현","이두민"]}]
        """.trimIndent()
        val rows = json.decodeFromString(ListSerializer(HumorPostRow.serializer()), payload)
        val post = rows.single().toPost()
        assertEquals("김수정", post.author)
        assertEquals("점심 뭐 먹지", post.body)
        assertEquals(2, post.laughs)
    }

    @Test fun handlesNullLikedBy() {
        val payload = """[{"id":"H2","author":"이관국","body":"","created_at":"2026-08-02"}]"""
        val rows = json.decodeFromString(ListSerializer(HumorPostRow.serializer()), payload)
        assertEquals(0, rows.single().toPost().laughs)
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.data.HumorRowTest"
```
Expected: 컴파일 실패(`HumorPostRow` 미정의).

- [ ] **Step 3: 모델/리포지토리 구현**

`.../data/Humor.kt`:
```kotlin
package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HumorPostRow(
    val id: String,
    val author: String = "",
    val body: String? = null,
    @SerialName("media_url") val mediaUrl: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("liked_by") val likedBy: List<String>? = null,
)

data class HumorPost(
    val id: String,
    val author: String,
    val body: String,
    val createdAt: String,
    val mediaUrl: String,
    val laughs: Int,
)

fun HumorPostRow.toPost() = HumorPost(
    id = id,
    author = author,
    body = body ?: "",
    createdAt = createdAt ?: "",
    mediaUrl = mediaUrl ?: imageUrl ?: "",
    laughs = likedBy?.size ?: 0,
)
```

`.../data/HumorRepository.kt`:
```kotlin
package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class HumorRepository(private val supabase: SupabaseClient) {
    suspend fun loadPosts(): List<HumorPost> =
        supabase.select(
            table = "humor_posts",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(HumorPostRow.serializer()),
        ).map { it.toPost() }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest --tests "com.hyubs.skonnection.data.HumorRowTest"
```
Expected: PASS(2건).

- [ ] **Step 5: AppContainer에 HumorRepository 추가**

`.../AppContainer.kt` (Modify) — 다음 줄 추가:
```kotlin
    val humorRepository = HumorRepository(supabase)
```
(import `com.hyubs.skonnection.data.HumorRepository` 추가.)

- [ ] **Step 6: HomeViewModel + HomeScreen 작성**

`.../feature/home/HomeViewModel.kt`:
```kotlin
package com.hyubs.skonnection.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.HumorPost
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HomeViewModel(private val container: AppContainer) : ViewModel() {
    private val _posts = MutableStateFlow<List<HumorPost>>(emptyList())
    val posts: StateFlow<List<HumorPost>> = _posts.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _posts.value = try { container.humorRepository.loadPosts() } catch (t: Throwable) { emptyList() }
        }
    }
}
```

`.../feature/home/HomeScreen.kt`:
```kotlin
package com.hyubs.skonnection.feature.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hyubs.skonnection.AppContainer

@androidx.compose.material3.ExperimentalMaterial3Api
@Composable
fun HomeScreen(container: AppContainer, onLogout: () -> Unit) {
    val vm = remember { HomeViewModel(container) }
    val posts by vm.posts.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("홈") },
                actions = { TextButton(onClick = onLogout) { Text("로그아웃") } },
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Filled.Home, contentDescription = "홈") },
                    label = { Text("홈") },
                )
            }
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            items(posts) { post ->
                Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(post.author, style = MaterialTheme.typography.titleSmall)
                        Text(post.body, style = MaterialTheme.typography.bodyMedium)
                        Text("❤️ ${post.laughs}", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 7: RootScreen의 else 분기를 HomeScreen으로 교체**

`.../RootScreen.kt` (Modify) — else 분기를 다음으로:
```kotlin
        HomeScreen(container = container, onLogout = vm::logout)
```
(import `com.hyubs.skonnection.feature.home.HomeScreen` 추가.)

- [ ] **Step 8: 빌드 + 에뮬레이터에서 홈 피드 실데이터 검증**

Run:
```bash
cd android-native && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
SDK="$HOME/Library/Android/sdk"
./gradlew :app:assembleDebug
"$SDK/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
"$SDK/platform-tools/adb" shell am start -n com.hyubs.skonnection/.MainActivity
```
에뮬레이터에서 로그인 후, 홈에 유머 글 카드(작성자·본문·좋아요 수)가 웹과 동일한 데이터로 보이는지 확인:
```bash
"$SDK/platform-tools/adb" exec-out screencap -p > /tmp/sk_m0_task7.png
```
Expected: 홈 상단바("홈")+하단 네비+유머 카드 목록이 Supabase 실데이터로 렌더됨(웹 유머게시판과 동일 글).

- [ ] **Step 9: 커밋**

```bash
git add android-native/app/src
git commit -m "android: 홈 셸(상단바+하단 네비)+유머 피드 Supabase 실데이터 렌더 — M0 완료"
```

---

## Self-Review

**Spec coverage(설계 §3~§6 대비):**
- §3 스택(Compose/Material3/ViewModel/StateFlow/AppContainer/Ktor/DataStore): Task 1·2·6에서 구현 ✓
- §4 M0 항목 1(스캐폴드+테마): Task 1 ✓ / 항목 2(SupabaseClient): Task 2 ✓ / 항목 3(모델+로그인): Task 3·4·5·6 ✓ / 항목 4(홈 피드 1종): Task 7 ✓ / 항목 5(에뮬 검증): Task 1·6·7의 검증 스텝 ✓
- §5 데이터 계약(accounts/humor_posts 컬럼, anon key, PBKDF2 형식): Task 2·3·4·7 ✓
- §6 검증(에뮬레이터/스크린샷): 각 UI Task 검증 스텝 ✓
- M1~M4는 후속 계획으로 분리(스코프 정상).

**Placeholder scan:** 코드 스텝은 모두 실제 코드 포함. 두 곳의 의도적 주의사항은 "수정 지시"로 명시함 — Task 5 Step 4/RootScreen: `collectAsStateWithLifecycle`→`collectAsState()` 대체 명시; Task 6 Step 4: `fillMaxSize()`→`fillMaxWidth()` 교체 명시; Task 3 Step 3b: `android.util.Base64`→`java.util.Base64` 교체 명시. 실행자는 최종 코드를 재현 가능.

**Type consistency:** `SupabaseClient.select(table, query, deserializer)` 시그니처가 Task 2·4·7에서 일치. `Account`/`AccountRow` 필드가 Task 4·5에서 일치. `LoginResult`/`LoginLogic.attempt` 시그니처가 Task 5·6에서 일치. `AppContainer`의 `supabase/accountRepository/sessionStore/humorRepository`가 Task 6·7에서 일치. `HumorPost.laughs`가 Task 7 전체에서 일치.

**주의(실행 시 확정 필요):** Android 의존성 버전(AGP/Compose BOM/Ktor 등)은 이 맥의 설치 상태에 따라 소폭 조정될 수 있음 — Task 1 빌드 실패 시 버전만 맞춰 올린다(로직 변경 아님).
