package com.econetvision.erp.util

object Constants {
    const val SHIFT_A = "SHIFT_A"
    const val SHIFT_B = "SHIFT_B"
    const val ROLE_ADMIN = "admin"
    const val ROLE_SUPERVISOR = "supervisor"
    const val ROLE_WORKER = "worker"

    // Extra tolerance (metres) added to a work location's allowed radius when
    // checking attendance, to absorb GPS drift. e.g. a 50 m geofence effectively
    // accepts up to 50 + 25 = 75 m.
    const val GEOFENCE_BUFFER_M = 25.0
}
