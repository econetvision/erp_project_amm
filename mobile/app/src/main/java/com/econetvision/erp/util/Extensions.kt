package com.econetvision.erp.util

import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.econetvision.erp.R

fun View.visible() { visibility = View.VISIBLE }
fun View.gone() { visibility = View.GONE }

/** Visual style for [showToast]. */
enum class ToastType { SUCCESS, ERROR, WARNING, INFO }

fun Fragment.toast(message: String) = showToast(message, ToastType.INFO)

/**
 * Show a styled toast with an icon and colored background so errors and status
 * messages are clearly distinguishable (vs. a plain grey system toast).
 */
fun Fragment.showToast(
    message: String,
    type: ToastType = ToastType.INFO,
    longDuration: Boolean = false,
) {
    val ctx = context ?: return
    val (colorRes, icon) = when (type) {
        ToastType.SUCCESS -> R.color.success to "✅"
        ToastType.ERROR   -> R.color.danger to "⛔"
        ToastType.WARNING -> R.color.warning to "⚠️"
        ToastType.INFO    -> R.color.primary to "ℹ️"
    }

    val view = LayoutInflater.from(ctx).inflate(R.layout.toast_custom, null)
    view.findViewById<TextView>(R.id.toastIcon).text = icon
    view.findViewById<TextView>(R.id.toastMessage).text = message
    view.findViewById<View>(R.id.toastRoot).background
        ?.mutate()
        ?.setTint(ContextCompat.getColor(ctx, colorRes))

    Toast(ctx).apply {
        duration = if (longDuration) Toast.LENGTH_LONG else Toast.LENGTH_SHORT
        @Suppress("DEPRECATION") // custom view toasts still render for foreground apps
        setView(view)
        setGravity(Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL, 0, 160)
        show()
    }
}
