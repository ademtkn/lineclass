# LineClass Android (Capacitor)

Uygulama https://lineclass.com.kg adresini yükleyen bir Capacitor kabuğudur (`capacitor.config.json`). Web tarafı güncellenince uygulamanın yeniden yayınlanması gerekmez.

```bash
npm install
npx cap sync android
cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Simgeler: `assets/` içindeki görsellerden `npx capacitor-assets generate --android`.
Mağaza (release) için imza anahtarı (.jks) gerekir; anahtarı repoya koymayın.
