package com.econetvision.erp.util

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class BiometricCredentialStore {

    companion object {
        private const val KEY_ALIAS = "erp_biometric_key"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val PREFS_NAME = "biometric_creds"
        private const val PREF_CIPHERTEXT = "ciphertext"
        private const val PREF_IV = "iv"

        fun hasSavedCredentials(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.contains(PREF_CIPHERTEXT) && prefs.contains(PREF_IV)
        }

        fun clearCredentials(context: Context) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        }

        fun getSavedIv(context: Context): ByteArray? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val ivBase64 = prefs.getString(PREF_IV, null) ?: return null
            return Base64.decode(ivBase64, Base64.NO_WRAP)
        }
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)

        val existingKey = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existingKey != null) {
            return existingKey
        }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val specBuilder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            specBuilder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        }

        keyGenerator.init(specBuilder.build())
        return keyGenerator.generateKey()
    }

    fun getEncryptCipher(): Cipher {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        return cipher
    }

    fun getDecryptCipher(iv: ByteArray): Cipher {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), GCMParameterSpec(128, iv))
        return cipher
    }

    fun saveCredentials(context: Context, username: String, password: String, cipher: Cipher) {
        val plaintext = "$username:$password".toByteArray(Charsets.UTF_8)
        val ciphertext = cipher.doFinal(plaintext)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(PREF_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            putString(PREF_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            apply()
        }
    }

    fun loadCredentials(context: Context, cipher: Cipher): Pair<String, String>? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ciphertextBase64 = prefs.getString(PREF_CIPHERTEXT, null) ?: return null
        val ciphertext = Base64.decode(ciphertextBase64, Base64.NO_WRAP)

        val plaintext = cipher.doFinal(ciphertext)
        val decoded = String(plaintext, Charsets.UTF_8)
        val separatorIndex = decoded.indexOf(':')
        if (separatorIndex == -1) return null

        val username = decoded.substring(0, separatorIndex)
        val password = decoded.substring(separatorIndex + 1)
        return Pair(username, password)
    }
}
