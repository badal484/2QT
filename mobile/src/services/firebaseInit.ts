import firebase from '@react-native-firebase/app';

export function ensureFirebaseInit() {
    try {
        const apps = firebase.apps;
        if (!apps || apps.length === 0) {
            console.log('[FirebaseInit] Initializing default Firebase app programmatically...');
            firebase.initializeApp({
                apiKey: 'AIzaSyCaLm5vOs9lw9QsF6v89HrNNbYiD5rqKg0',
                projectId: 'qqtt-ddd83',
                storageBucket: 'qqtt-ddd83.firebasestorage.app',
                appId: '1:1613467594:ios:77870d0dbc381c13a04933',
                messagingSenderId: '1613467594',
            });
        }
    } catch (e: any) {
        console.warn('[FirebaseInit] Automatic initialization notice:', e?.message || e);
    }
}

// Auto-run on import
ensureFirebaseInit();
