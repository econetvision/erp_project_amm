package com.econetvision.erp.attendance.data

import com.google.gson.JsonParser

/** Turns a FastAPI error body into the message to show the supervisor. */
object ApiError {
    fun parse(body: String?, fallback: String): String {
        if (body.isNullOrBlank()) return fallback
        return try {
            val detail = JsonParser.parseString(body).asJsonObject.get("detail")
            when {
                detail == null || detail.isJsonNull -> fallback
                detail.isJsonPrimitive -> detail.asString.ifBlank { fallback }
                // Request validation errors arrive as a list of {loc, msg, type}.
                detail.isJsonArray -> detail.asJsonArray
                    .mapNotNull { it.asJsonObject.get("msg")?.asString }
                    .joinToString(", ")
                    .ifBlank { fallback }
                else -> fallback
            }
        } catch (e: Exception) {
            // Not JSON (e.g. an HTML page from a gateway).
            fallback
        }
    }
}
