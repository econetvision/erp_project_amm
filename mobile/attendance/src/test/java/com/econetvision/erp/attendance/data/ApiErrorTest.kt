package com.econetvision.erp.attendance.data

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiErrorTest {

    @Test
    fun `string detail is returned as is`() {
        val body = """{"detail":"You are 340 m from Yard A. Attendance can only be marked at the site."}"""
        assertEquals(
            "You are 340 m from Yard A. Attendance can only be marked at the site.",
            ApiError.parse(body, "fallback"),
        )
    }

    @Test
    fun `first browser login message reaches the user`() {
        val body = """{"detail":"First login must be done from a browser. Please sign in on the web portal, set your password, then log in here."}"""
        assertEquals(
            "First login must be done from a browser. Please sign in on the web portal, set your password, then log in here.",
            ApiError.parse(body, "fallback"),
        )
    }

    @Test
    fun `validation error list is joined`() {
        val body = """{"detail":[{"loc":["body","latitude"],"msg":"Input should be less than or equal to 90"},{"msg":"Field required"}]}"""
        assertEquals("Input should be less than or equal to 90, Field required", ApiError.parse(body, "fallback"))
    }

    @Test
    fun `html gateway error falls back`() {
        assertEquals("fallback", ApiError.parse("<html><body>502 Bad Gateway</body></html>", "fallback"))
    }

    @Test
    fun `null empty and detail-less bodies fall back`() {
        assertEquals("fallback", ApiError.parse(null, "fallback"))
        assertEquals("fallback", ApiError.parse("", "fallback"))
        assertEquals("fallback", ApiError.parse("{}", "fallback"))
        assertEquals("fallback", ApiError.parse("""{"detail":null}""", "fallback"))
        assertEquals("fallback", ApiError.parse("""{"detail":[]}""", "fallback"))
    }
}
