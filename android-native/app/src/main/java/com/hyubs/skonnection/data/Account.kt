package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** accounts 테이블 행(웹 accountStore.ts / iOS Account.swift 매핑). */
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
    val photoUrl: String?,
    val slackEmail: String?,
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
    photoUrl = photoUrl,
    slackEmail = slackEmail,
    passwordHash = passwordHash,
)
