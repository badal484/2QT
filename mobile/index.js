import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

// RootNavigator swaps between entirely separate Stack.Navigator trees
// (Auth/Customer/Rider/Kitchen/Admin) based on auth state. Native screen
// containers from react-native-screens commit Fragment transactions for
// the outgoing and incoming navigators in the same render pass, which
// crashes with "FragmentManager is already executing transactions" on
// Android. Disabling native screens removes the Fragment-based container
// (falls back to plain Views); @react-navigation/stack's transitions are
// JS-driven anyway, so this only costs the inactive-screen memory/freeze
// optimization, not animation behavior.
enableScreens(false);

AppRegistry.registerComponent(appName, () => App);
