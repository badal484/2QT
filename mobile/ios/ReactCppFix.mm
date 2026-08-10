// This file is intentionally empty.
// The debug-symbol stubs that used to live here caused vtable corruption at
// runtime: our stubs produced vtables for DebugStringConvertible/ShadowNode with
// debug virtual methods, while libReact-Fabric.a (compiled in Release) expects
// a different (smaller) vtable layout.  The linker errors those stubs were
// fixing are now prevented at their source instead — see the Podfile
// post_install hook where react-native-worklets-core is compiled with
// -URN_DEBUG_STRING_CONVERTIBLE so it never generates references to the
// prebuilt-missing debug symbols in the first place.
