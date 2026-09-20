const fs = require('fs');
const file = 'android-app/app/src/main/java/com/example/numberbetting/presentation/navigation/AppNavigation.kt';
let content = fs.readFileSync(file, 'utf8');

const anchor = '// Poll wallet balance & live user name';
const replacement = `// Poll game schedules
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val schedUrl = URL("$baseUrl/api/admin/schedules")
                            val connSched = schedUrl.openConnection() as HttpURLConnection
                            connSched.requestMethod = "GET"
                            connSched.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            connSched.connectTimeout = 1500
                            if (connSched.responseCode == 200) {
                                val resText = connSched.inputStream.bufferedReader().readText()
                                if (resText.trim().startsWith("{")) {
                                    val schedJson = org.json.JSONObject(resText)
                                    val keys = schedJson.keys()
                                    while (keys.hasNext()) {
                                        val k = keys.next()
                                        val obj = schedJson.optJSONObject(k)
                                        if (obj != null) {
                                            val o = obj.optString("open", "")
                                            val c = obj.optString("close", "")
                                            val r = obj.optString("result", "")
                                            if (o.isNotEmpty() && c.isNotEmpty() && r.isNotEmpty()) {
                                                withContext(Dispatchers.Main) {
                                                    com.example.numberbetting.domain.GameScheduleManager.updateDynamicSchedule(k, o, c, r)
                                                }
                                            }
                                        }
                                    }
                                    break
                                }
                            }
                        } catch (e: Exception) { }
                    }

                    // Poll wallet balance & live user name`;

content = content.replace(anchor, replacement);
fs.writeFileSync(file, content);
console.log("Patched AppNavigation.kt");
