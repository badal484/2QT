import { Vibration } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

let alertSound: Sound | null = null;

export function playKitchenAlert() {
  try {
    // Aggressive vibration for kitchen orders (approx 6 seconds to match audio)
    Vibration.vibrate([0, 800, 400, 800, 400, 800, 400, 800, 400, 800]);

    if (!alertSound) {
      alertSound = new Sound('alert.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.warn("Sound error:", error);
          alertSound = null; // Clear broken instance
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
  } catch (e) {
    console.warn("Failed to play kitchen alert:", e);
  }
}
