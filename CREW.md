# Family & Class crew linking

Grown-ups / teachers create a shared **family or class crew**. Kids join with a **6-letter code + nickname + emoji only** (no emails). Photos never leave the phone. Shared map pins are blurred to about **150 meters**.

## How to use (in the app)

1. Open the **Crew** tab.
2. **Create family / class crew** (grown-up/teacher) → pick Family or Class → optional name + optional adult PIN → get a code like `K7MQ2P`.
3. Share the **family or class code** with kids (whiteboard, chat, verbally).
4. On each kid phone: **Join with family or class code** → enter code + nickname + avatar.
5. Catch litter as usual. Turn the map filter to **Whole crew** to see everyone's blurred pins and the shared leaderboard.

**Leave crew** removes this phone from the shared roster; local Litter-dex data stays on the device. **Add on this phone only** still works for siblings sharing one device without cloud linking.

## Cloud sync (cross-phone) — one free signup

Without cloud config, create/join works for **demos on the same device/browser tabs** only. Other phones cannot see the code until Firebase is connected.

1. Open [Firebase Console](https://console.firebase.google.com/) (Google account, free Spark plan).
2. Create a project → add a **Web** app.
3. Enable **Authentication → Anonymous**.
4. Create **Firestore** database.
5. Paste rules (start simple; tighten later):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /crews/{code} {
      allow read, write: if request.auth != null;
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

6. Copy the web `firebaseConfig` into `js/firebase-config.js` (`window.LM_FIREBASE_CONFIG`).
7. Redeploy / hard-refresh the app. Status on the Crew card should say **cloud**.

## Privacy (COPPA-minded)

- Nicknames only — no kid emails or passwords.
- Adult/teacher creates the crew.
- No precise home/school pins in the cloud (blur ~150 m).
- Photos stay on-device (v1 does not upload photos).
- Offline / unlinked mode keeps working with localStorage only.
