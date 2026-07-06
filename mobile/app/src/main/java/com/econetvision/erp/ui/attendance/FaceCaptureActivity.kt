package com.econetvision.erp.ui.attendance

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Size
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.econetvision.erp.databinding.ActivityFaceCaptureBinding
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Live face scan with blink liveness check.
 *
 * Shows a front-camera preview and runs ML Kit face detection on the analysis
 * stream. The user must be seen with eyes open, then closed, then open again
 * (a real blink) before a frame is captured — a static photo held up to the
 * camera can never pass. The captured frame is saved as a JPEG and its path is
 * returned in [EXTRA_IMAGE_PATH]; the caller then sends it to the backend for
 * face verification (clock-in / clock-out / face-scan).
 */
class FaceCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivityFaceCaptureBinding
    private lateinit var analysisExecutor: ExecutorService
    private var detector: FaceDetector? = null
    private val captured = AtomicBoolean(false)

    // Blink state machine: eyes open -> eyes closed -> eyes open again.
    private var sawEyesOpen = false
    private var sawEyesClosed = false
    private var noFaceFrames = 0

    private val timeoutHandler = Handler(Looper.getMainLooper())
    private val timeoutRunnable = Runnable {
        if (!captured.get()) {
            Toast.makeText(
                this,
                "Could not verify a blink. Try again with your face inside the oval and good lighting.",
                Toast.LENGTH_LONG,
            ).show()
            setResult(RESULT_CANCELED)
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFaceCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        binding.btnCancel.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Camera permission is required", Toast.LENGTH_LONG).show()
            setResult(RESULT_CANCELED)
            finish()
            return
        }

        analysisExecutor = Executors.newSingleThreadExecutor()
        detector = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
                .setMinFaceSize(MIN_FACE_SIZE)
                .build()
        )

        setStatus("Position your face inside the oval", GUIDE_NEUTRAL)
        startCamera()
        timeoutHandler.postDelayed(timeoutRunnable, TIMEOUT_MS)
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.previewView.surfaceProvider)
            }

            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(
                    ResolutionSelector.Builder()
                        .setResolutionStrategy(
                            ResolutionStrategy(
                                Size(640, 480),
                                ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                            )
                        )
                        .build()
                )
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { it.setAnalyzer(analysisExecutor) { proxy -> analyzeFrame(proxy) } }

            try {
                provider.unbindAll()
                try {
                    provider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, preview, analysis)
                } catch (e: Exception) {
                    // Devices without a front camera (kiosks/tablets) fall back to the back camera.
                    provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Could not start camera: ${e.message}", Toast.LENGTH_LONG).show()
                setResult(RESULT_CANCELED)
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun analyzeFrame(imageProxy: ImageProxy) {
        if (captured.get()) {
            imageProxy.close()
            return
        }
        val mediaImage = imageProxy.image
        val faceDetector = detector
        if (mediaImage == null || faceDetector == null) {
            imageProxy.close()
            return
        }
        val input = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        faceDetector.process(input)
            .addOnSuccessListener { faces -> onFacesDetected(faces, imageProxy) }
            .addOnCompleteListener { imageProxy.close() }
    }

    /**
     * Runs on the main thread (ML Kit's default callback executor). The
     * [imageProxy] is still open here — it is closed by the analyzer's
     * onComplete listener after this returns, so the winning frame must be
     * converted to a bitmap synchronously.
     */
    private fun onFacesDetected(faces: List<Face>, imageProxy: ImageProxy) {
        if (captured.get() || isFinishing) return

        when {
            faces.isEmpty() -> {
                // A few empty frames are normal (e.g. mid-blink on some devices);
                // only reset after a sustained loss of the face.
                if (++noFaceFrames > NO_FACE_RESET_FRAMES) {
                    resetBlinkState()
                    setStatus("Position your face inside the oval", GUIDE_NEUTRAL)
                }
            }
            faces.size > 1 -> {
                resetBlinkState()
                setStatus("Only one face should be visible", GUIDE_NEUTRAL)
            }
            else -> {
                noFaceFrames = 0
                val face = faces[0]
                val left = face.leftEyeOpenProbability
                val right = face.rightEyeOpenProbability
                if (left == null || right == null) return

                val bothOpen = left >= EYE_OPEN_THRESHOLD && right >= EYE_OPEN_THRESHOLD
                val bothClosed = left <= EYE_CLOSED_THRESHOLD && right <= EYE_CLOSED_THRESHOLD

                when {
                    !sawEyesOpen -> {
                        if (bothOpen) {
                            sawEyesOpen = true
                            setStatus("Now blink", GUIDE_PROMPT)
                        } else {
                            setStatus("Look at the camera with your eyes open", GUIDE_NEUTRAL)
                        }
                    }
                    !sawEyesClosed -> {
                        if (bothClosed) sawEyesClosed = true
                    }
                    bothOpen -> {
                        // Full open -> closed -> open cycle observed: liveness verified.
                        if (captured.compareAndSet(false, true)) {
                            setStatus("Blink verified ✓ Capturing…", GUIDE_SUCCESS)
                            captureFrame(imageProxy)
                        }
                    }
                }
            }
        }
    }

    private fun resetBlinkState() {
        sawEyesOpen = false
        sawEyesClosed = false
    }

    private fun setStatus(text: String, guideColor: Int) {
        binding.tvInstruction.text = text
        binding.faceOverlay.setGuideColor(guideColor)
    }

    private fun captureFrame(imageProxy: ImageProxy) {
        try {
            var bitmap = imageProxy.toBitmap()

            val rotation = imageProxy.imageInfo.rotationDegrees
            if (rotation != 0) {
                val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            }

            if (bitmap.width > TARGET_WIDTH) {
                val ratio = TARGET_WIDTH.toFloat() / bitmap.width
                bitmap = Bitmap.createScaledBitmap(
                    bitmap, TARGET_WIDTH, (bitmap.height * ratio).toInt(), true
                )
            }

            val dir = File(cacheDir, "face_captures").apply { mkdirs() }
            val file = File(dir, "face_${System.currentTimeMillis()}.jpg")
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
            }

            timeoutHandler.removeCallbacks(timeoutRunnable)
            setResult(RESULT_OK, intent.putExtra(EXTRA_IMAGE_PATH, file.absolutePath))
            finish()
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to capture image: ${e.message}", Toast.LENGTH_LONG).show()
            setResult(RESULT_CANCELED)
            finish()
        }
    }

    override fun onDestroy() {
        timeoutHandler.removeCallbacks(timeoutRunnable)
        detector?.close()
        if (::analysisExecutor.isInitialized) analysisExecutor.shutdown()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_IMAGE_PATH = "extra_image_path"

        // ML Kit eye-open probability thresholds for the blink state machine.
        private const val EYE_OPEN_THRESHOLD = 0.65f
        private const val EYE_CLOSED_THRESHOLD = 0.25f
        private const val MIN_FACE_SIZE = 0.2f
        private const val NO_FACE_RESET_FRAMES = 5
        private const val TIMEOUT_MS = 45_000L
        private const val TARGET_WIDTH = 640

        private const val GUIDE_NEUTRAL = 0xFFFFFFFF.toInt()
        private const val GUIDE_PROMPT = 0xFF4EA8E8.toInt() // accent
        private const val GUIDE_SUCCESS = 0xFF198754.toInt() // success
    }
}
