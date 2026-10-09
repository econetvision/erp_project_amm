package com.econetvision.erp.attendance.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessPolicyTest {

    @Test
    fun `supervisor with a site may use the app`() {
        assertTrue(AccessPolicy.canUse("supervisor", 5))
    }

    @Test
    fun `supervisor without a site may not`() {
        assertFalse(AccessPolicy.canUse("supervisor", null))
    }

    @Test
    fun `other roles may not even with a site`() {
        assertFalse(AccessPolicy.canUse("admin", 5))
        assertFalse(AccessPolicy.canUse("worker", 5))
        assertFalse(AccessPolicy.canUse("master", 5))
        assertFalse(AccessPolicy.canUse(null, 5))
    }
}
