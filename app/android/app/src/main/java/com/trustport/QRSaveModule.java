package com.trustport;

import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.OutputStream;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

public class QRSaveModule extends ReactContextBaseJavaModule {

    public QRSaveModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "QRSave";
    }

    @ReactMethod
    public void saveQRToGallery(String content, String fileName, Promise promise) {
        try {
            Context context = getReactApplicationContext();

            // Generate QR code bitmap using ZXing
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, 512, 512);
            int width = bitMatrix.getWidth();
            int height = bitMatrix.getHeight();
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565);
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    bitmap.setPixel(x, y, bitMatrix.get(x, y) ? Color.BLACK : Color.WHITE);
                }
            }

            // Save to MediaStore (gallery)
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName + ".png");
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/TrustPort");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            android.net.Uri uri = context.getContentResolver()
                .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

            if (uri == null) {
                promise.reject("SAVE_FAILED", "Failed to create media entry");
                return;
            }

            OutputStream os = context.getContentResolver().openOutputStream(uri);
            if (os == null) {
                promise.reject("SAVE_FAILED", "Failed to open output stream");
                return;
            }

            bitmap.compress(Bitmap.CompressFormat.PNG, 100, os);
            os.close();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                context.getContentResolver().update(uri, values, null, null);
            }

            WritableMap result = Arguments.createMap();
            result.putString("uri", uri.toString());
            promise.resolve(result);

        } catch (Exception e) {
            promise.reject("SAVE_FAILED", e.getMessage(), e);
        }
    }
}
