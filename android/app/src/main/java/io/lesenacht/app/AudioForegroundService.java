package io.lesenacht.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.KeyEvent;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AudioForegroundService extends android.app.Service {

    public static final String CHANNEL_ID = "lesenacht_playback";
    public static final int NOTIFICATION_ID = 1337;

    public static final String ACTION_START = "io.lesenacht.app.action.START";
    public static final String ACTION_UPDATE = "io.lesenacht.app.action.UPDATE";
    public static final String ACTION_STOP = "io.lesenacht.app.action.STOP";

    // User-triggered actions from the notification; broadcast to JS.
    public static final String ACTION_PLAY = "io.lesenacht.app.action.PLAY";
    public static final String ACTION_PAUSE = "io.lesenacht.app.action.PAUSE";
    public static final String ACTION_SEEK_FORWARD = "io.lesenacht.app.action.SEEK_FORWARD";
    public static final String ACTION_SEEK_BACKWARD = "io.lesenacht.app.action.SEEK_BACKWARD";

    // Broadcast consumed by AudioPlugin -> forwarded to JS
    public static final String BROADCAST_ACTION = "io.lesenacht.app.broadcast.ACTION";
    public static final String EXTRA_ACTION_TYPE = "actionType";
    public static final String EXTRA_SEEK_TO = "seekTo";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_AUTHOR = "author";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_SPEED = "speed";
    public static final String EXTRA_THUMB_URL = "thumbUrl";

    private MediaSessionCompat mediaSession;
    private String title = "Lesenacht";
    private String author = "";
    private String currentThumbUrl = null;
    private Bitmap artworkBitmap = null;
    private boolean isPlaying = false;
    private long positionMs = 0L;
    private long durationMs = 0L;
    private float speed = 1.0f;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private final BroadcastReceiver localReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;
            switch (action) {
                case ACTION_PLAY:
                    forwardAction("play", -1);
                    break;
                case ACTION_PAUSE:
                    forwardAction("pause", -1);
                    break;
                case ACTION_SEEK_FORWARD:
                    forwardAction("seekforward", -1);
                    break;
                case ACTION_SEEK_BACKWARD:
                    forwardAction("seekbackward", -1);
                    break;
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        setupMediaSession();

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PLAY);
        filter.addAction(ACTION_PAUSE);
        filter.addAction(ACTION_SEEK_FORWARD);
        filter.addAction(ACTION_SEEK_BACKWARD);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(localReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(localReceiver, filter);
        }
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null) {
            // Handle media button intents routed by MediaButtonReceiver
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        // Delegate media button events to the media session callback
        if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
            return START_NOT_STICKY;
        }

        if (ACTION_STOP.equals(action)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        // START or UPDATE
        if (intent.hasExtra(EXTRA_TITLE)) title = intent.getStringExtra(EXTRA_TITLE);
        if (intent.hasExtra(EXTRA_AUTHOR)) author = intent.getStringExtra(EXTRA_AUTHOR);
        if (intent.hasExtra(EXTRA_IS_PLAYING)) isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, isPlaying);
        if (intent.hasExtra(EXTRA_POSITION)) positionMs = intent.getLongExtra(EXTRA_POSITION, positionMs);
        if (intent.hasExtra(EXTRA_DURATION)) durationMs = intent.getLongExtra(EXTRA_DURATION, durationMs);
        if (intent.hasExtra(EXTRA_SPEED)) speed = intent.getFloatExtra(EXTRA_SPEED, speed);
        
        if (intent.hasExtra(EXTRA_THUMB_URL)) {
            String newThumbUrl = intent.getStringExtra(EXTRA_THUMB_URL);
            if (newThumbUrl != null && !newThumbUrl.equals(currentThumbUrl)) {
                currentThumbUrl = newThumbUrl;
                loadArtwork(newThumbUrl);
            }
        }

        updateMediaSession();
        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);
        mediaSession.setActive(true);

        return START_NOT_STICKY;
    }

    private void setupMediaSession() {
        mediaSession = new MediaSessionCompat(this, "LesenachtMediaSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() { forwardAction("play", -1); }

            @Override
            public void onPause() { forwardAction("pause", -1); }

            @Override
            public void onFastForward() { forwardAction("seekforward", -1); }

            @Override
            public void onRewind() { forwardAction("seekbackward", -1); }

            @Override
            public void onSkipToNext() { forwardAction("seekforward", -1); }

            @Override
            public void onSkipToPrevious() { forwardAction("seekbackward", -1); }

            @Override
            public void onSeekTo(long pos) { forwardAction("seekto", pos); }

            @Override
            public void onStop() {
                forwardAction("stop", -1);
            }

            @Override
            public boolean onMediaButtonEvent(Intent mediaButtonEvent) {
                KeyEvent ke = mediaButtonEvent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (ke != null && ke.getAction() == KeyEvent.ACTION_DOWN) {
                    switch (ke.getKeyCode()) {
                        case KeyEvent.KEYCODE_MEDIA_PLAY:
                            forwardAction("play", -1); return true;
                        case KeyEvent.KEYCODE_MEDIA_PAUSE:
                            forwardAction("pause", -1); return true;
                        case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                        case KeyEvent.KEYCODE_HEADSETHOOK:
                            forwardAction(isPlaying ? "pause" : "play", -1); return true;
                        case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                        case KeyEvent.KEYCODE_MEDIA_NEXT:
                            forwardAction("seekforward", -1); return true;
                        case KeyEvent.KEYCODE_MEDIA_REWIND:
                        case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                            forwardAction("seekbackward", -1); return true;
                    }
                }
                return super.onMediaButtonEvent(mediaButtonEvent);
            }
        });
    }

    private void updateMediaSession() {
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title != null ? title : "")
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, author != null ? author : "")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, author != null ? author : "")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
            
        if (artworkBitmap != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artworkBitmap);
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, artworkBitmap);
        }

        mediaSession.setMetadata(builder.build());

        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SEEK_TO
            | PlaybackStateCompat.ACTION_FAST_FORWARD
            | PlaybackStateCompat.ACTION_REWIND
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_STOP;

        int state = isPlaying
            ? PlaybackStateCompat.STATE_PLAYING
            : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, isPlaying ? speed : 0f)
            .build();
        mediaSession.setPlaybackState(playbackState);
    }

    private Notification buildNotification() {
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentPi = PendingIntent.getActivity(this, 0, contentIntent, piFlags);

        NotificationCompat.Action rewindAction = new NotificationCompat.Action(
            android.R.drawable.ic_media_rew,
            "15s zurück",
            MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_REWIND)
        );

        NotificationCompat.Action playPauseAction = isPlaying
            ? new NotificationCompat.Action(
                android.R.drawable.ic_media_pause,
                "Pause",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PAUSE))
            : new NotificationCompat.Action(
                android.R.drawable.ic_media_play,
                "Abspielen",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY));

        NotificationCompat.Action forwardAction = new NotificationCompat.Action(
            android.R.drawable.ic_media_ff,
            "30s vor",
            MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_FAST_FORWARD)
        );

        MediaStyle style = new MediaStyle()
            .setMediaSession(mediaSession.getSessionToken())
            .setShowActionsInCompactView(0, 1, 2);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(author)
            .setContentIntent(contentPi)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(rewindAction)
            .addAction(playPauseAction)
            .addAction(forwardAction)
            .setStyle(style)
            .setDeleteIntent(
                MediaButtonReceiver.buildMediaButtonPendingIntent(
                    this, PlaybackStateCompat.ACTION_STOP));

        if (artworkBitmap != null) {
            builder.setLargeIcon(artworkBitmap);
        }

        return builder.build();
    }

    private void loadArtwork(String urlString) {
        executor.execute(() -> {
            try {
                URL url = new URL(urlString);
                Bitmap bitmap = BitmapFactory.decodeStream(url.openStream());
                if (bitmap != null) {
                    artworkBitmap = bitmap;
                    // Trigger a UI update with the new bitmap
                    updateMediaSession();
                    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                    if (nm != null) {
                        nm.notify(NOTIFICATION_ID, buildNotification());
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private PendingIntent buildActionPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(action).setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(this, requestCode, intent, flags);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Wiedergabe",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Hörbuch-Wiedergabe");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void forwardAction(String type, long seekTo) {
        Intent intent = new Intent(BROADCAST_ACTION).setPackage(getPackageName());
        intent.putExtra(EXTRA_ACTION_TYPE, type);
        if (seekTo >= 0) intent.putExtra(EXTRA_SEEK_TO, seekTo);
        sendBroadcast(intent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        try { unregisterReceiver(localReceiver); } catch (Exception ignored) {}
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }
}
