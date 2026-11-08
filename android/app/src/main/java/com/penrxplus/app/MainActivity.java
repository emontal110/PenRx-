package com.penrxplus.app;

import android.app.KeyguardManager;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.pdf.PdfDocument;
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
import android.view.WindowManager;
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
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static boolean sessionBiometricUnlocked = false;
    private String cachedHardwareDeviceId = null;
    private View splashOverlay = null;

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

            int logoSize = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 92, getResources().getDisplayMetrics()
            );
            FrameLayout logoContainer = new FrameLayout(this);
            LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(logoSize, logoSize);
            logoParams.bottomMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 16, getResources().getDisplayMetrics()
            );
            logoContainer.setLayoutParams(logoParams);

            GradientDrawable logoBg = new GradientDrawable();
            logoBg.setColor(Color.parseColor("#1C252A"));
            logoBg.setCornerRadius(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 22, getResources().getDisplayMetrics()
            ));
            logoBg.setStroke(
                (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1.5f, getResources().getDisplayMetrics()),
                Color.parseColor("#34d399")
            );
            logoContainer.setBackground(logoBg);

            ImageView logo = new ImageView(this);
            logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
            FrameLayout.LayoutParams innerLogoParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            );
            logo.setLayoutParams(innerLogoParams);
            try {
                logo.setImageResource(R.drawable.penrx_logo);
            } catch (Exception e) {
                try {
                    logo.setImageResource(R.mipmap.ic_launcher_round);
                } catch (Exception ignored) {
                    try {
                        logo.setImageResource(R.mipmap.ic_launcher);
                    } catch (Exception ignored2) {}
                }
            }
            logoContainer.addView(logo);
            centerBox.addView(logoContainer);

            TextView title = new TextView(this);
            title.setText("PenRX+");
            title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
            title.setTypeface(null, Typeface.BOLD);
            title.setTextColor(Color.parseColor("#34d399"));
            title.setGravity(Gravity.CENTER);
            centerBox.addView(title);

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

            ProgressBar pb = new ProgressBar(this);
            int pbSize = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 30, getResources().getDisplayMetrics()
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

    public void dismissSplashOverlay() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (splashOverlay != null && splashOverlay.getParent() != null) {
                    splashOverlay.animate()
                        .alpha(0f)
                        .setDuration(180)
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

    private boolean checkDeviceBiometricOrCredentialSupport() {
        try {
            PackageManager pm = getPackageManager();
            if (pm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)) {
                    return true;
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null && km.isKeyguardSecure()) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return true;
    }

    private String normalizeWhatsAppJidPhone(String rawPhone) {
        if (rawPhone == null) return "";
        String digits = rawPhone.replaceAll("[^0-9]", "");
        if (digits.startsWith("00")) {
            digits = digits.substring(2);
        }
        if (digits.startsWith("01") && digits.length() == 11) {
            return "2" + digits;
        }
        if (digits.startsWith("1") && digits.length() == 10) {
            return "20" + digits;
        }
        return digits;
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

    private void syncDeviceIdToWebView(final WebView webView, final String hwId) {
        if (webView == null || hwId == null) return;
        try {
            final String sessionClearJs = sessionBiometricUnlocked
                ? "sessionStorage.setItem('penrx_biometric_unlocked_session','true');"
                : "";
            final String js =
                "try{" +
                "window.__PENRX_NATIVE_HW_ID__='" + hwId + "';" +
                "localStorage.setItem('penrx_unique_machine_id','" + hwId + "');" +
                "localStorage.setItem('penrx_machine_id','" + hwId + "');" +
                sessionClearJs +
                "window.dispatchEvent(new CustomEvent('penrx-hw-id-ready',{detail:'" + hwId + "'}));" +
                "}catch(e){}";
            webView.evaluateJavascript(js, null);
        } catch (Exception ignored) {}
    }

    /**
     * Writes decoded bytes to outFile. If the requested mimeType is application/pdf
     * but the incoming bytes are a PNG/JPEG bitmap (e.g., from mobile.html), converts
     * the bitmap into a crisp native Android PdfDocument automatically.
     */
    private void writeShareableFile(byte[] bytes, File outFile, boolean wantPdf) throws Exception {
        boolean isAlreadyPdf = bytes.length > 4 &&
            bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46; // "%PDF"

        if (wantPdf && !isAlreadyPdf && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp != null) {
                PdfDocument pdfDoc = new PdfDocument();
                int pageWidth = 595; // A4/A5 proportional points
                int pageHeight = Math.max(842, (int) ((float) bmp.getHeight() / Math.max(1, bmp.getWidth()) * pageWidth));
                PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create();
                PdfDocument.Page page = pdfDoc.startPage(pageInfo);
                Canvas canvas = page.getCanvas();
                canvas.drawColor(Color.WHITE);
                Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
                Rect destRect = new Rect(16, 16, pageWidth - 16, pageHeight - 16);
                canvas.drawBitmap(bmp, null, destRect, paint);
                pdfDoc.finishPage(page);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    pdfDoc.writeTo(fos);
                    fos.flush();
                }
                pdfDoc.close();
                bmp.recycle();
                outFile.setReadable(true, false);
                return;
            }
        }

        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            fos.write(bytes);
            fos.flush();
        }
        outFile.setReadable(true, false);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if (savedInstanceState == null) {
            sessionBiometricUnlocked = false;
        }

        try {
            Window window = getWindow();
            if (window != null) {
                int brandDark = Color.parseColor("#0b1329");
                window.setBackgroundDrawable(new ColorDrawable(brandDark));
                window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    window.setStatusBarColor(brandDark);
                    window.setNavigationBarColor(brandDark);
                }
            }
        } catch (Exception ignored) {}

        super.onCreate(savedInstanceState);

        showNativeSplashOverlay();

        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                dismissSplashOverlay();
            }
        }, 2200);

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
                boolean uaUpdated = false;
                if (currentUa != null && !currentUa.contains("PenRxHwId/")) {
                    settings.setUserAgentString(currentUa + " PenRxHwId/" + hwId);
                    uaUpdated = true;
                }

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public String getHardwareDeviceId() {
                        return hwId;
                    }

                    @JavascriptInterface
                    public void hideSplashScreen() {
                        dismissSplashOverlay();
                    }

                    @JavascriptInterface
                    public boolean hasBiometricHardware() {
                        return checkDeviceBiometricOrCredentialSupport();
                    }

                    @JavascriptInterface
                    public boolean isSessionUnlocked() {
                        return sessionBiometricUnlocked;
                    }

                    @JavascriptInterface
                    public void setSessionUnlocked(boolean unlocked) {
                        sessionBiometricUnlocked = unlocked;
                    }

                    @JavascriptInterface
                    public boolean isBiometricEnabled() {
                        SharedPreferences prefs = getSharedPreferences("penrx_hw_prefs", Context.MODE_PRIVATE);
                        return prefs.getBoolean("biometric_lock_enabled", false);
                    }

                    @JavascriptInterface
                    public void setBiometricEnabled(boolean enabled) {
                        SharedPreferences prefs = getSharedPreferences("penrx_hw_prefs", Context.MODE_PRIVATE);
                        prefs.edit().putBoolean("biometric_lock_enabled", enabled).apply();
                    }

                    @JavascriptInterface
                    public String shareFileToWhatsAppDirect(
                        String base64Data,
                        String fileName,
                        String mimeType,
                        String cleanPhone,
                        String caption
                    ) {
                        try {
                            String rawB64 = base64Data != null ? base64Data : "";
                            int commaIdx = rawB64.indexOf(',');
                            if (commaIdx >= 0) {
                                rawB64 = rawB64.substring(commaIdx + 1);
                            }
                            byte[] bytes = Base64.decode(rawB64, Base64.DEFAULT);

                            boolean wantPdf = (mimeType != null && mimeType.toLowerCase().contains("pdf")) ||
                                (fileName != null && fileName.toLowerCase().endsWith(".pdf"));
                            final String targetMime = wantPdf ? "application/pdf" : "image/png";
                            final String defaultExt = wantPdf ? ".pdf" : ".png";

                            String safeName = (fileName != null && !fileName.trim().isEmpty())
                                ? fileName.replaceAll("[^a-zA-Z0-9._-]", "_")
                                : ("Prescription" + defaultExt);
                            if (wantPdf && !safeName.toLowerCase().endsWith(".pdf")) {
                                safeName = safeName + ".pdf";
                            } else if (!wantPdf && !safeName.toLowerCase().endsWith(".png")) {
                                safeName = safeName + ".png";
                            }
                            final String finalSafeName = safeName;

                            File baseCache = getExternalCacheDir() != null ? getExternalCacheDir() : getCacheDir();
                            File sharedDir = new File(baseCache, "shared_rx");
                            if (!sharedDir.exists()) {
                                sharedDir.mkdirs();
                            }
                            final File outFile = new File(sharedDir, finalSafeName);
                            writeShareableFile(bytes, outFile, wantPdf);

                            final Uri contentUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                outFile
                            );

                            final String normalizedPhone = normalizeWhatsAppJidPhone(cleanPhone);
                            final String finalCaption = caption != null ? caption.trim() : "";

                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    try {
                                        String targetPackage = null;
                                        if (isPackageInstalled("com.whatsapp")) {
                                            targetPackage = "com.whatsapp";
                                        } else if (isPackageInstalled("com.whatsapp.w4b")) {
                                            targetPackage = "com.whatsapp.w4b";
                                        }

                                        Intent sendIntent = new Intent(Intent.ACTION_SEND);
                                        sendIntent.setType(targetMime);
                                        sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                                        if (!finalCaption.isEmpty()) {
                                            sendIntent.putExtra(Intent.EXTRA_TEXT, finalCaption);
                                        }
                                        if (!normalizedPhone.isEmpty()) {
                                            sendIntent.putExtra("jid", normalizedPhone + "@s.whatsapp.net");
                                        }

                                        try {
                                            ClipData clipData = ClipData.newUri(
                                                getContentResolver(),
                                                finalSafeName,
                                                contentUri
                                            );
                                            sendIntent.setClipData(clipData);
                                        } catch (Exception ignored) {}

                                        // IMPORTANT: Do NOT set FLAG_ACTIVITY_CLEAR_TOP!
                                        // FLAG_ACTIVITY_CLEAR_TOP clears WhatsApp's ContactPicker share handler
                                        // when WhatsApp is already open in the background, dropping the attachment!
                                        sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                                        try {
                                            grantUriPermission("com.whatsapp", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                        } catch (Exception ignored) {}
                                        try {
                                            grantUriPermission("com.whatsapp.w4b", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                        } catch (Exception ignored) {}

                                        if (targetPackage != null) {
                                            sendIntent.setPackage(targetPackage);
                                            try {
                                                List<ResolveInfo> resInfoList = getPackageManager().queryIntentActivities(
                                                    sendIntent,
                                                    PackageManager.MATCH_DEFAULT_ONLY
                                                );
                                                for (ResolveInfo resolveInfo : resInfoList) {
                                                    String pkgName = resolveInfo.activityInfo.packageName;
                                                    grantUriPermission(pkgName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                                }
                                            } catch (Exception ignored) {}
                                            MainActivity.this.startActivity(sendIntent);
                                        } else {
                                            Intent chooser = Intent.createChooser(sendIntent, "إرسال الروشتة عبر واتساب");
                                            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                            MainActivity.this.startActivity(chooser);
                                        }
                                    } catch (Exception uiErr) {
                                        try {
                                            Intent fallbackChooser = Intent.createChooser(
                                                new Intent(Intent.ACTION_SEND)
                                                    .setType(targetMime)
                                                    .putExtra(Intent.EXTRA_STREAM, contentUri)
                                                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
                                                "إرسال الروشتة عبر واتساب"
                                            );
                                            MainActivity.this.startActivity(fallbackChooser);
                                        } catch (Exception ignored2) {}
                                    }
                                }
                            });

                            return "OK";
                        } catch (Exception err) {
                            return "ERROR:" + err.getMessage();
                        }
                    }
                }, "PenRxNative");

                if (uaUpdated && savedInstanceState == null) {
                    String targetServerUrl = (this.bridge != null && this.bridge.getServerUrl() != null)
                        ? this.bridge.getServerUrl()
                        : "https://pen-rx.vercel.app";
                    webView.loadUrl(targetServerUrl);
                }

                int[] delays = new int[]{100, 350, 800, 1500, 2600};
                for (int delayMs : delays) {
                    webView.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            syncDeviceIdToWebView(webView, hwId);
                        }
                    }, delayMs);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        if (!isChangingConfigurations()) {
            sessionBiometricUnlocked = false;
        }
        super.onDestroy();
    }
}
