plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.23" apply false
    // Firebase Cloud Messaging (push). Applied by :app only when
    // app/google-services.json is present so builds work without it.
    id("com.google.gms.google-services") version "4.4.1" apply false
}
