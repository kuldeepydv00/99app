// 99xmatka Android app: opens https://newmatkadomain.com full screen in Chrome (a Trusted Web
// Activity). There is no app code: everything players see is the website, so a website update
// shows in the app straight away and the APK never needs rebuilding for game or screen changes.
plugins {
    id("com.android.application")
}

android {
    namespace = "com.newcompany.newmatka"
    compileSdk = 34

    defaultConfig {
        // Same id and signing key as the old app, so phones that have it get this as an update
        applicationId = "com.newcompany.newmatka"
        minSdk = 21
        targetSdk = 34
        versionCode = 100
        versionName = "2.0.0"
    }

    signingConfigs {
        // app/debug.keystore (not in git, keep a backup): the key the old app was signed with.
        // Its fingerprint is in website/public/.well-known/assetlinks.json, which is what lets the
        // app open the site full screen without an address bar.
        create("app") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("app")
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("app")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}

// After "./gradlew assembleRelease" the APK is copied to website/public/99xmatka.apk, which the
// website's Download App pop-up downloads (https://newmatkadomain.com/99xmatka.apk).
val copyApkToWebsite by tasks.registering(Copy::class) {
    from(layout.buildDirectory.file("outputs/apk/release/app-release.apk"))
    into(rootProject.layout.projectDirectory.dir("../website/public"))
    rename { "99xmatka.apk" }
}
afterEvaluate {
    tasks.named("assembleRelease") { finalizedBy(copyApkToWebsite) }
}
