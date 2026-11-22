import fs from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve(process.cwd(), 'android');
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.log('[ensure-android-permissions] AndroidManifest.xml not found, skipping.');
  process.exit(0);
}

// 1. Ensure required Location, Background Service, Notification, Camera & Flashlight permissions in AndroidManifest.xml
const requiredPermissions = [
  'android.permission.INTERNET',
  'android.permission.CAMERA',
  'android.permission.FLASHLIGHT',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
];

const requiredFeatures = [
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera.flash" android:required="false" />',
];

const mlkitMetadata =
  '<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />';

let xml = fs.readFileSync(manifestPath, 'utf8');
let manifestChanged = false;

for (const perm of requiredPermissions) {
  if (!xml.includes(perm)) {
    xml = xml.replace(
      '<application',
      `    <uses-permission android:name="${perm}" />\n    <application`
    );
    manifestChanged = true;
  }
}

for (const featureTag of requiredFeatures) {
  const nameMatch = featureTag.match(/android:name="([^"]+)"/);
  const featureName = nameMatch ? nameMatch[1] : featureTag;
  if (!xml.includes(featureName)) {
    xml = xml.replace('<application', `    ${featureTag}\n    <application`);
    manifestChanged = true;
  }
}

if (!xml.includes('com.google.mlkit.vision.DEPENDENCIES')) {
  xml = xml.replace('</application>', `        ${mlkitMetadata}\n    </application>`);
  manifestChanged = true;
}

if (manifestChanged) {
  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log(
    '[ensure-android-permissions] Updated AndroidManifest.xml with location, camera, flashlight & ML Kit barcode metadata.'
  );
} else {
  console.log('[ensure-android-permissions] AndroidManifest.xml already up to date.');
}

// 2. Enable Data Binding in android/app/build.gradle (required by @capacitor-mlkit/barcode-scanning)
const appBuildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
if (fs.existsSync(appBuildGradlePath)) {
  let gradle = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!gradle.includes('dataBinding')) {
    gradle = gradle.replace(
      /android\s*\{/,
      `android {\n    buildFeatures {\n        dataBinding true\n    }`
    );
    fs.writeFileSync(appBuildGradlePath, gradle, 'utf8');
    console.log(
      '[ensure-android-permissions] Enabled buildFeatures.dataBinding in android/app/build.gradle.'
    );
  } else {
    console.log(
      '[ensure-android-permissions] dataBinding already configured in android/app/build.gradle.'
    );
  }
}

// 3. Patch MainActivity.java to also grant WebView RESOURCE_VIDEO_CAPTURE + runtime CAMERA permission
function findFileRecursive(dir, filename) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, filename);
      if (found) return found;
    } else if (entry.isFile() && entry.name === filename) {
      return full;
    }
  }
  return null;
}

const javaSrcDir = path.join(androidRoot, 'app', 'src', 'main', 'java');
const mainActivityPath = findFileRecursive(javaSrcDir, 'MainActivity.java');

if (mainActivityPath) {
  const existingJava = fs.readFileSync(mainActivityPath, 'utf8');
  const pkgMatch = existingJava.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m);
  const packageName = pkgMatch ? pkgMatch[1] : 'uk.codix.webstack.courier';

  const patchedJava = `package ${packageName};

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 9001;
    private PermissionRequest pendingCameraPermissionRequest = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    if (request == null) return;
                    String[] resources = request.getResources();
                    boolean needsCamera = resources != null
                        && Arrays.asList(resources).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);

                    if (needsCamera) {
                        runOnUiThread(() -> {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                                && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                    != PackageManager.PERMISSION_GRANTED) {
                                pendingCameraPermissionRequest = request;
                                ActivityCompat.requestPermissions(
                                    MainActivity.this,
                                    new String[] { Manifest.permission.CAMERA },
                                    CAMERA_PERMISSION_REQUEST_CODE
                                );
                            } else {
                                request.grant(resources);
                            }
                        });
                        return;
                    }

                    super.onPermissionRequest(request);
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (pendingCameraPermissionRequest != null) {
                PermissionRequest req = pendingCameraPermissionRequest;
                pendingCameraPermissionRequest = null;
                boolean granted = grantResults != null
                    && grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
                if (granted) {
                    req.grant(req.getResources());
                } else {
                    req.deny();
                }
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
}
`;

  fs.writeFileSync(mainActivityPath, patchedJava, 'utf8');
  console.log(
    `[ensure-android-permissions] Patched ${path.relative(process.cwd(), mainActivityPath)} with WebView camera runtime permission handler.`
  );
} else {
  console.log('[ensure-android-permissions] MainActivity.java not found, skipping Java patch.');
}
