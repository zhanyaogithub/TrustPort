package com.trustport;

import android.app.Activity;
import android.content.Intent;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import com.journeyapps.barcodescanner.ScanOptions;

public class QRScannerModule extends ReactContextBaseJavaModule {

    private static final String NAME = "QRScanner";
    private static final int SCAN_REQUEST_CODE = 49374;
    private Promise scanPromise;

    private final ActivityEventListener activityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == SCAN_REQUEST_CODE) {
                if (scanPromise != null) {
                    if (resultCode == Activity.RESULT_OK && data != null) {
                        String result = data.getStringExtra("SCAN_RESULT");
                        if (result != null) {
                            scanPromise.resolve(result);
                        } else {
                            scanPromise.reject("SCAN_EMPTY", "未扫描到内容");
                        }
                    } else if (resultCode == Activity.RESULT_CANCELED) {
                        scanPromise.reject("SCAN_CANCELLED", "用户取消扫描");
                    } else {
                        scanPromise.reject("SCAN_ERROR", "扫描失败");
                    }
                    scanPromise = null;
                }
            }
        }
    };

    public QRScannerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(activityEventListener);
    }

    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void scan(Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "无法获取当前 Activity");
            return;
        }

        scanPromise = promise;

        ScanOptions options = new ScanOptions();
        options.setDesiredBarcodeFormats(ScanOptions.QR_CODE);
        options.setPrompt("将二维码放入框内扫描");
        options.setCameraId(0);
        options.setBeepEnabled(false);
        options.setOrientationLocked(false);

        Intent intent = options.createScanIntent(activity);
        activity.startActivityForResult(intent, SCAN_REQUEST_CODE);
    }
}
