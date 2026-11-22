import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

if (!fs.existsSync(manifestPath)) {
  console.log('[ensure-android-permissions] AndroidManifest.xml not found, skipping.');
  process.exit(0);
}

const requiredPermissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
];

let xml = fs.readFileSync(manifestPath, 'utf8');
let added = 0;

for (const perm of requiredPermissions) {
  if (!xml.includes(perm)) {
    xml = xml.replace(
      '<application',
      `    <uses-permission android:name="${perm}" />\n    <application`
    );
    added += 1;
  }
}

if (added > 0) {
  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log(
    `[ensure-android-permissions] Added ${added} location/background permission(s) to AndroidManifest.xml.`
  );
} else {
  console.log(
    '[ensure-android-permissions] All required location/background permissions already present.'
  );
}
