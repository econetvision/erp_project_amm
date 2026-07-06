package com.econetvision.erp.ui.attendance

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

/**
 * Dims the camera preview and cuts out an oval "face guide" in the middle.
 * The oval's stroke colour reflects the liveness state (searching / blink
 * prompt / verified) via [setGuideColor].
 */
class FaceOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val dimPaint = Paint().apply { color = 0x99000000.toInt() }
    private val cutoutPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
        isAntiAlias = true
    }
    private val strokePaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 10f
        isAntiAlias = true
        color = Color.WHITE
    }
    private val ovalRect = RectF()

    fun setGuideColor(color: Int) {
        strokePaint.color = color
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val saved = canvas.saveLayer(null, null)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), dimPaint)

        val ovalWidth = width * 0.72f
        val ovalHeight = ovalWidth * 1.3f
        val top = height * 0.16f
        ovalRect.set(
            (width - ovalWidth) / 2f,
            top,
            (width + ovalWidth) / 2f,
            top + ovalHeight,
        )
        canvas.drawOval(ovalRect, cutoutPaint)
        canvas.drawOval(ovalRect, strokePaint)
        canvas.restoreToCount(saved)
    }
}
