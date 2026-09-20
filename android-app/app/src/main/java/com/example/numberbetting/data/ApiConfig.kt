package com.example.numberbetting.data

object ApiConfig {
    const val BASE_URL = "https://newmatkadomain.com"

    @Volatile
    var cachedWorkingUrl: String? = "https://newmatkadomain.com"

    val FALLBACK_URLS = listOf(
        "https://newmatkadomain.com"
    )

    fun getWorkingUrls(): List<String> {
        val active = cachedWorkingUrl
        if (active != null) {
            return listOf(active) + FALLBACK_URLS.filter { it != active }
        }
        return FALLBACK_URLS
    }

    fun markUrlFailed(failedUrl: String) {
        if (cachedWorkingUrl == failedUrl) {
            cachedWorkingUrl = FALLBACK_URLS.firstOrNull { it != failedUrl }
        }
    }
}
