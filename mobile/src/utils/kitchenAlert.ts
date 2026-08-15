import { Platform, Vibration } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback', true);

let alertSound: Sound | null = null;

export function playKitchenAlert() {
  try {
    // Aggressive vibration for kitchen orders (approx 6 seconds to match audio)
    Vibration.vibrate([0, 800, 400, 800, 400, 800, 400, 800, 400, 800]);

    const fileName = Platform.OS === 'android' ? 'alert' : 'alert.mp3';

    if (!alertSound) {
      alertSound = new Sound(fileName, Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.warn("[KitchenAlert] Sound load error:", error);
          alertSound = null; // Clear broken instance
          return;
        }
        alertSound?.setVolume(1.0);
        alertSound?.play((success) => {
          if (!success) {
            console.warn("[KitchenAlert] Sound playback failed");
          }
        });
      });
    } else {
      alertSound.stop(() => {
        alertSound?.setCurrentTime(0);
        alertSound?.setVolume(1.0);
        alertSound?.play();
      });
    }
  } catch (e) {
    console.warn("[KitchenAlert] Failed to play kitchen alert:", e);
  }
}
