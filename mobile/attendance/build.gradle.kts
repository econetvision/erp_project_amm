plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ERP Attendance: attendance-only app for supervisors enabled for physical
// attendance. Installs alongside the main ERP app (separate application id).
android {
    namespace = "com.econetvision.erp.attendance"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.econetvision.erp.attendance"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        // Production backend on Railway (same as the main app).
        buildConfigField("String", "API_BASE_URL", "\"https://erpprojectamm-production-595f.up.railway.app/\"")
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

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    implementation("com.google.android.gms:play-services-location:21.1.0")

    // CameraX preview + ML Kit blink liveness, as in the main app's face scan.
    implementation("androidx.camera:camera-core:1.3.1")
    implementation("androidx.camera:camera-camera2:1.3.1")
    implementation("androidx.camera:camera-lifecycle:1.3.1")
    implementation("androidx.camera:camera-view:1.3.1")
    implementation("com.google.android.gms:play-services-mlkit-face-detection:17.1.0")

    testImplementation("junit:junit:4.13.2")
}
