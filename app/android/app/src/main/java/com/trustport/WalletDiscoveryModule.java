package com.trustport;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.ByteArrayOutputStream;
import java.util.List;

public class WalletDiscoveryModule extends ReactContextBaseJavaModule {

    private static final String MWA_INTENT_ACTION = "android.intent.action.VIEW";
    private static final String MWA_INTENT_URI = "solana-wallet:/";

    public WalletDiscoveryModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "WalletDiscovery";
    }

    @ReactMethod
    public void discoverWallets(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            PackageManager pm = context.getPackageManager();

            // Create the MWA intent
            Intent mwaIntent = new Intent(MWA_INTENT_ACTION);
            mwaIntent.setData(Uri.parse(MWA_INTENT_URI));

            // Query all activities that can handle this intent
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(mwaIntent, 0);

            WritableArray wallets = Arguments.createArray();

            for (ResolveInfo resolveInfo : resolveInfos) {
                WritableMap wallet = Arguments.createMap();
                String packageName = resolveInfo.activityInfo.packageName;
                String appName = resolveInfo.loadLabel(pm).toString();

                // Skip our own app
                if (packageName.equals(context.getPackageName())) {
                    continue;
                }

                wallet.putString("packageName", packageName);
                wallet.putString("appName", appName);
                wallet.putString("activityName", resolveInfo.activityInfo.name);

                // Get app icon as base64
                try {
                    Drawable icon = resolveInfo.loadIcon(pm);
                    String iconBase64 = drawableToBase64(icon);
                    wallet.putString("icon", iconBase64);
                } catch (Exception e) {
                    wallet.putString("icon", "");
                }

                wallets.pushMap(wallet);
            }

            promise.resolve(wallets);
        } catch (Exception e) {
            promise.reject("WALLET_DISCOVERY_ERROR", e.getMessage(), e);
        }
    }

    private String drawableToBase64(Drawable drawable) {
        try {
            Bitmap bitmap;
            if (drawable instanceof BitmapDrawable) {
                bitmap = ((BitmapDrawable) drawable).getBitmap();
            } else {
                int width = drawable.getIntrinsicWidth() > 0 ? drawable.getIntrinsicWidth() : 48;
                int height = drawable.getIntrinsicHeight() > 0 ? drawable.getIntrinsicHeight() : 48;
                bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                drawable.draw(canvas);
            }

            // Scale down to 48x48
            Bitmap scaled = Bitmap.createScaledBitmap(bitmap, 48, 48, true);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
            byte[] bytes = outputStream.toByteArray();
            return "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }
}
