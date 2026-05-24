package com.econetvision.erp.util

import android.view.View
import android.widget.Toast
import androidx.fragment.app.Fragment

fun View.visible() { visibility = View.VISIBLE }
fun View.gone() { visibility = View.GONE }

fun Fragment.toast(message: String) {
    Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
}
