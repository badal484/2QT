import { Platform, Vibration, NativeModules } from 'react-native';
import { safeNotifee, AndroidImportance } from '../services/notifeeSafe';

let SoundPkg: any = null;
let alertSound: any = null;

try {
  if (NativeModules.RNSound || NativeModules.SoundManager || NativeModules.Sound) {
    const pkg = require('react-native-sound');
    SoundPkg = pkg?.default || pkg;
    if (SoundPkg && typeof SoundPkg.setCategory === 'function') {
      SoundPkg.setCategory('Playback', true);
    }
  }
} catch (e) {
  console.warn('[KitchenAlert] Safe load react-native-sound warning:', e);
}

export function playKitchenAlert() {
  try {
    // 1. Aggressive 6-second multi-pulse vibration
    Vibration.vibrate([0, 800, 400, 800, 400, 800, 400, 800, 400, 800]);

    // 2. Play high-importance alert sound via Notifee notification channel
    if (safeNotifee.isAvailable) {
      safeNotifee.createChannel({
        id: 'kitchen_order_alerts_v3',
        name: 'Kitchen Order Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      }).then((channelId: any) => {
        safeNotifee.displayNotification({
          title: '🔔 NEW KITCHEN ORDER!',
          body: 'A new order ticket has arrived in the kitchen.',
          android: {
            channelId: channelId || 'kitchen_order_alerts_v3',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            pressAction: { id: 'default' },
          },
        }).catch(() => {});
      }).catch(() => {});
    }

    // 3. Play sound file via react-native-sound if native module is present
    if (SoundPkg) {
      const fileName = Platform.OS === 'android' ? 'alert' : 'alert.mp3';
      if (!alertSound) {
        alertSound = new SoundPkg(fileName, SoundPkg.MAIN_BUNDLE, (error: any) => {
          if (error) {
            console.warn('[KitchenAlert] Sound load error:', error);
            alertSound = null;
            return;
          }
          alertSound?.setVolume(1.0);
          alertSound?.play();
        });
      } else {
        alertSound.stop(() => {
          alertSound?.setCurrentTime(0);
          alertSound?.setVolume(1.0);
          alertSound?.play();
        });
      }
    }
  } catch (e) {
    console.warn('[KitchenAlert] Failed to play kitchen alert sound:', e);
  }
}
