package io.lesenacht.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioPlugin")
public class AudioPlugin extends Plugin {

    private final BroadcastReceiver actionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioForegroundService.BROADCAST_ACTION.equals(intent.getAction())) {
                String type = intent.getStringExtra(AudioForegroundService.EXTRA_ACTION_TYPE);
                JSObject ret = new JSObject();
                ret.put("type", type);
                if (intent.hasExtra(AudioForegroundService.EXTRA_SEEK_TO)) {
                    ret.put("seekTo", intent.getLongExtra(AudioForegroundService.EXTRA_SEEK_TO, 0) / 1000.0);
                }
                notifyListeners("onAction", ret);
            }
        }
    };

    @Override
    public void load() {
        IntentFilter filter = new IntentFilter(AudioForegroundService.BROADCAST_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(actionReceiver, filter);
        }
    }

    @PluginMethod
    public void startPlayback(PluginCall call) {
        String title = call.getString("title", "Lesenacht");
        String author = call.getString("author", "");

        Intent intent = new Intent(getContext(), AudioForegroundService.class);
        intent.setAction(AudioForegroundService.ACTION_START);
        intent.putExtra(AudioForegroundService.EXTRA_TITLE, title);
        intent.putExtra(AudioForegroundService.EXTRA_AUTHOR, author);
        intent.putExtra(AudioForegroundService.EXTRA_IS_PLAYING, true);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void updatePlayback(PluginCall call) {
        Boolean isPlaying = call.getBoolean("isPlaying");
        Double position = call.getDouble("position");
        Double duration = call.getDouble("duration");
        Double speed = call.getDouble("speed");
        String title = call.getString("title");
        String author = call.getString("author");

        Intent intent = new Intent(getContext(), AudioForegroundService.class);
        intent.setAction(AudioForegroundService.ACTION_UPDATE);
        if (isPlaying != null) intent.putExtra(AudioForegroundService.EXTRA_IS_PLAYING, isPlaying);
        if (position != null) intent.putExtra(AudioForegroundService.EXTRA_POSITION, (long)(position * 1000));
        if (duration != null) intent.putExtra(AudioForegroundService.EXTRA_DURATION, (long)(duration * 1000));
        if (speed != null) intent.putExtra(AudioForegroundService.EXTRA_SPEED, speed.floatValue());
        if (title != null) intent.putExtra(AudioForegroundService.EXTRA_TITLE, title);
        if (author != null) intent.putExtra(AudioForegroundService.EXTRA_AUTHOR, author);

        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioForegroundService.class);
        intent.setAction(AudioForegroundService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }
}
