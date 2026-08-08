package com.officegpt.officegpt_app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val channelName = "officegpt/incoming_files"
    private var channel: MethodChannel? = null
    private val pending = mutableListOf<Map<String, Any>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        collectIntent(intent)
        super.onCreate(savedInstanceState)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).also { bridge ->
            bridge.setMethodCallHandler { call, result ->
                if (call.method == "getInitialFiles") result.success(drainPending())
                else result.notImplemented()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        collectIntent(intent)
        val files = drainPending()
        if (files.isNotEmpty()) channel?.invokeMethod("incomingFiles", files)
    }

    private fun collectIntent(source: Intent?) {
        if (source == null) return
        val uris = mutableListOf<Uri>()
        when (source.action) {
            Intent.ACTION_SEND -> source.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let(uris::add)
            Intent.ACTION_SEND_MULTIPLE -> source.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let(uris::addAll)
            Intent.ACTION_VIEW, Intent.ACTION_EDIT -> source.data?.let(uris::add)
        }
        uris.distinct().forEach { copyIncoming(it)?.let(pending::add) }
    }

    private fun copyIncoming(uri: Uri): Map<String, Any>? {
        return try {
            val resolver = contentResolver
            var name = "共享文件"
            var size = 0L
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (nameIndex >= 0) name = cursor.getString(nameIndex) ?: name
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
                }
            }
            val safeName = name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
            val directory = File(cacheDir, "incoming").apply { mkdirs() }
            val target = File(directory, "${System.currentTimeMillis()}-$safeName")
            val input = resolver.openInputStream(uri) ?: return null
            input.use { stream -> target.outputStream().use(stream::copyTo) }
            if (size <= 0) size = target.length()
            mapOf("name" to name, "path" to target.absolutePath, "size" to size)
        } catch (_: Exception) {
            null
        }
    }

    private fun drainPending(): List<Map<String, Any>> = pending.toList().also { pending.clear() }
}
