export const firebaseAdminAuth = {
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'mock-uid', phone_number: '+919876543210' }),
};

export const firebaseAdminMessaging = {
    sendEachForMulticast: jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'mock-msg-id' }],
    }),
};

export const getAuth = jest.fn(() => firebaseAdminAuth);
export const getMessaging = jest.fn(() => firebaseAdminMessaging);
