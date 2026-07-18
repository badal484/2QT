import { Vibration } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

export function playKitchenAlert() {
  try {
    const s = new Sound('alert.mp3', Sound.MAIN_BUNDLE, (error) => {
      if (!error) {
        s.setVolume(1.0);
        s.play(() => s.release());
      }
    });
  } catch {}
  Vibration.vibrate([0, 400, 100, 400]);
}
