package com.penrxplus.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.ColorDrawable;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {

    private String cachedHardwareDeviceId = null;
    private View splashOverlay = null;

    /**
     * Shows a native branded loading overlay with logo, title, and emerald progress bar.
     * Prevents any black screen during WebView initialization and remote cold start.
     */
    private void showNativeSplashOverlay() {
        try {
            int brandDark = Color.parseColor("#0b1329");
            FrameLayout root = new FrameLayout(this);
            root.setBackgroundColor(brandDark);
            root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));

            LinearLayout centerBox = new LinearLayout(this);
            centerBox.setOrientation(LinearLayout.VERTICAL);
            centerBox.setGravity(Gravity.CENTER);
            FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            centerParams.gravity = Gravity.CENTER;
            centerBox.setLayoutParams(centerParams);

            // 1. Logo
            ImageView logo = new ImageView(this);
            int logoSize = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 92, getResources().getDisplayMetrics()
            );
            LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(logoSize, logoSize);
            logoParams.bottomMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 16, getResources().getDisplayMetrics()
            );
            logo.setLayoutParams(logoParams);
            try {
                logo.setImageResource(R.drawable.splash);
            } catch (Exception e) {
                try {
                    logo.setImageResource(R.mipmap.ic_launcher);
                } catch (Exception ignored) {}
            }
            centerBox.addView(logo);

            // 2. App Title: PenRX+
            TextView title = new TextView(this);
            title.setText("PenRX+");
            title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
            title.setTypeface(null, Typeface.BOLD);
            title.setTextColor(Color.parseColor("#34d399"));
            title.setGravity(Gravity.CENTER);
            centerBox.addView(title);

            // 3. Subtitle
            TextView subTitle = new TextView(this);
            subTitle.setText("منظومة إدارة الروشتات والعيادات الطبية الذكية");
            subTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            subTitle.setTextColor(Color.parseColor("#94a3b8"));
            subTitle.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            subParams.topMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 6, getResources().getDisplayMetrics()
            );
            subParams.bottomMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 22, getResources().getDisplayMetrics()
            );
            subTitle.setLayoutParams(subParams);
            centerBox.addView(subTitle);

            // 4. Progress Spinner
            ProgressBar pb = new ProgressBar(this);
            int pbSize = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 32, getResources().getDisplayMetrics()
            );
            LinearLayout.LayoutParams pbParams = new LinearLayout.LayoutParams(pbSize, pbSize);
            pbParams.bottomMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 10, getResources().getDisplayMetrics()
            );
            pb.setLayoutParams(pbParams);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                pb.setIndeterminateTintList(ColorStateList.valueOf(Color.parseColor("#10b981")));
            }
            centerBox.addView(pb);

            // 5. Loading status text
            TextView statusText = new TextView(this);
            statusText.setText("جاري فتح العيادة الذكية...");
            statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            statusText.setTextColor(Color.parseColor("#10b981"));
            statusText.setGravity(Gravity.CENTER);
            centerBox.addView(statusText);

            root.addView(centerBox);
            splashOverlay = root;

            addContentView(splashOverlay, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));
        } catch (Exception e) {
            splashOverlay = null;
        }
    }

    /**
     * Smoothly dismisses the native splash overlay once the web interface finishes hydration.
     */
    public void dismissSplashOverlay() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (splashOverlay != null && splashOverlay.getParent() != null) {
                    splashOverlay.animate()
                        .alpha(0f)
                        .setDuration(250)
                        .withEndAction(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    ViewGroup parent = (ViewGroup) splashOverlay.getParent();
                                    if (parent != null) {
                                        parent.removeView(splashOverlay);
                                    }
                                } catch (Exception ignored) {}
                            }
                        })
                        .start();
                }
            }
        });
    }

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

    private void loadOfflineShell(WebView webView) {
        try {
            webView.loadUrl("file:///android_asset/public/index.html");
        } catch (Exception ignored) {}
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
                window.setBackgroundDrawable(new ColorDrawable(brandDark));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    window.setStatusBarColor(brandDark);
                    window.setNavigationBarColor(brandDark);
                }
            }
        } catch (Exception ignored) {}

        super.onCreate(savedInstanceState);

        // Instantly display native branded splash overlay so there is zero black screen during startup/cold start
        showNativeSplashOverlay();

        // Safety fallback timer: auto-dismiss splash after 7 seconds if network takes too long
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                dismissSplashOverlay();
            }
        }, 7000);

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
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setLoadWithOverviewMode(true);
                settings.setUseWideViewPort(true);

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
                     * Signals the native layer that React hydration is complete,
                     * smoothly fading out the native splash overlay.
                     */
                    @JavascriptInterface
                    public void hideSplashScreen() {
                        dismissSplashOverlay();
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
                    loadOfflineShell(webView);
                }

                webView.setWebViewClient(new android.webkit.WebViewClient() {
                    @Override
                    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                        super.onReceivedError(view, errorCode, description, failingUrl);
                        if (view.getUrl() == null || view.getUrl().startsWith("https://pen-rx.vercel.app")) {
                            loadOfflineShell(view);
                        }
                    }
                });
            }
        } catch (Exception ignored) {}
    }
}
