package com.penrxplus.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {

    private String cachedHardwareDeviceId = null;

    /**
     * Computes a deterministic, immutable Hardware Machine ID (PRX-ANDR-XXXX-XXXX)
     * derived from Android's hardware/signing-key-bound ANDROID_ID (SSAID).
     * Never changes across app uninstalls and reinstalls.
     */
    private String resolveImmutableHardwareId() {
        if (cachedHardwareDeviceId != null && cachedHardwareDeviceId.startsWith("PRX-")) {
            return cachedHardwareDeviceId;
        }

        SharedPreferences prefs = getSharedPreferences("penrx_hw_prefs", Context.MODE_PRIVATE);
        String saved = prefs.getString("hardware_device_id", null);

        String rawAndroidId = null;
        try {
            rawAndroidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Exception ignored) {}

        if (rawAndroidId == null || rawAndroidId.trim().isEmpty() || "9774d56d682e549c".equalsIgnoreCase(rawAndroidId)) {
            if (saved != null && saved.startsWith("PRX-")) {
                cachedHardwareDeviceId = saved;
                return cachedHardwareDeviceId;
            }
            rawAndroidId = Build.BOARD + "-" + Build.BRAND + "-" + Build.DEVICE + "-" + Build.HARDWARE + "-" + Build.MODEL;
        }

        String normalized = rawAndroidId.trim();
        long hash = 2166136261L;
        String input = "ANDROID-HW-" + normalized;
        for (int i = 0; i < input.length(); i++) {
            hash ^= input.charAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            hash = (int) hash;
        }

        long absHash = Math.abs((long) (int) hash);
        String hex = Long.toHexString(absHash).toUpperCase();
        while (hex.length() < 8) {
            hex = "0" + hex;
        }

        String alphaNum = normalized.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        while (alphaNum.length() < 4) {
            alphaNum = "A" + alphaNum;
        }
        String suffix = alphaNum.substring(alphaNum.length() - 4);

        cachedHardwareDeviceId = "PRX-ANDR-" + hex.substring(0, 4) + "-" + suffix;
        prefs.edit().putString("hardware_device_id", cachedHardwareDeviceId).apply();
        return cachedHardwareDeviceId;
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.net.Network nw = cm.getActiveNetwork();
                if (nw == null) return false;
                NetworkCapabilities actNw = cm.getNetworkCapabilities(nw);
                return actNw != null && (
                    actNw.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    actNw.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    actNw.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                );
            } else {
                android.net.NetworkInfo nwInfo = cm.getActiveNetworkInfo();
                return nwInfo != null && nwInfo.isConnected();
            }
        } catch (Exception e) {
            return true;
        }
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            PackageManager pm = getPackageManager();
            pm.getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            Window window = getWindow();
            if (window != null) {
                int brandDark = Color.parseColor("#0b1329");
                window.getDecorView().setBackgroundColor(brandDark);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    window.setStatusBarColor(brandDark);
                    window.setNavigationBarColor(brandDark);
                }
            }
        } catch (Exception ignored) {}

        super.onCreate(savedInstanceState);

        final String hwId = resolveImmutableHardwareId();

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                final WebView webView = this.bridge.getWebView();
                int brandDark = Color.parseColor("#0b1329");
                webView.setBackgroundColor(brandDark);
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setJavaScriptEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                if (isNetworkAvailable()) {
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                } else {
                    settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                }

                String currentUa = settings.getUserAgentString();
                if (currentUa != null && !currentUa.contains("PenRxHwId/")) {
                    settings.setUserAgentString(currentUa + " PenRxHwId/" + hwId);
                }

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public String getHardwareDeviceId() {
                        return hwId;
                    }

                    /**
                     * Directly opens the patient's WhatsApp chat (via JID phone@s.whatsapp.net)
                     * with the generated Prescription Image (PNG) or PDF already attached!
                     */
                    @JavascriptInterface
                    public String shareFileToWhatsAppDirect(
                        String base64Data,
                        String fileName,
                        String mimeType,
                        String cleanPhone,
                        String caption
                    ) {
                        try {
                            String rawB64 = base64Data;
                            int commaIdx = rawB64.indexOf(',');
                            if (commaIdx >= 0) {
                                rawB64 = rawB64.substring(commaIdx + 1);
                            }
                            byte[] bytes = Base64.decode(rawB64, Base64.DEFAULT);

                            String safeName = (fileName != null && !fileName.trim().isEmpty())
                                ? fileName.replaceAll("[^a-zA-Z0-9._-]", "_")
                                : ("Prescription." + (mimeType != null && mimeType.contains("pdf") ? "pdf" : "png"));

                            File sharedDir = new File(getCacheDir(), "shared_rx");
                            if (!sharedDir.exists()) {
                                sharedDir.mkdirs();
                            }
                            File outFile = new File(sharedDir, safeName);
                            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                                fos.write(bytes);
                                fos.flush();
                            }

                            Uri contentUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                outFile
                            );

                            String targetMime = (mimeType != null && !mimeType.trim().isEmpty())
                                ? mimeType.trim()
                                : "image/png";

                            String digitsOnly = (cleanPhone != null) ? cleanPhone.replaceAll("[^0-9]", "") : "";

                            String targetPackage = null;
                            if (isPackageInstalled("com.whatsapp")) {
                                targetPackage = "com.whatsapp";
                            } else if (isPackageInstalled("com.whatsapp.w4b")) {
                                targetPackage = "com.whatsapp.w4b";
                            }

                            Intent sendIntent = new Intent(Intent.ACTION_SEND);
                            sendIntent.setType(targetMime);
                            sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                            if (caption != null && !caption.trim().isEmpty()) {
                                sendIntent.putExtra(Intent.EXTRA_TEXT, caption.trim());
                            }
                            if (!digitsOnly.isEmpty()) {
                                // Direct WhatsApp JID targeting: opens patient's conversation directly with the file attached!
                                sendIntent.putExtra("jid", digitsOnly + "@s.whatsapp.net");
                            }
                            sendIntent.setClipData(ClipData.newRawUri("", contentUri));
                            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                            if (targetPackage != null) {
                                sendIntent.setPackage(targetPackage);
                                grantUriPermission(targetPackage, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                startActivity(sendIntent);
                            } else {
                                Intent chooser = Intent.createChooser(sendIntent, "إرسال الروشتة عبر واتساب");
                                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                startActivity(chooser);
                            }
                            return "OK";
                        } catch (Exception err) {
                            return "ERROR:" + err.getMessage();
                        }
                    }
                }, "PenRxNative");

                webView.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            webView.evaluateJavascript(
                                "try{localStorage.setItem('penrx_unique_machine_id','" + hwId + "');localStorage.setItem('penrx_machine_id','" + hwId + "');}catch(e){}",
                                null
                            );
                        } catch (Exception ignored) {}
                    }
                }, 250);

                if (!isNetworkAvailable()) {
                    webView.loadUrl("file:///android_asset/public/index.html");
                }
            }
        } catch (Exception ignored) {}
    }
}
