import React from 'react';
export const motion = new Proxy({}, {
  get: (_t, tag: string) => (props: any) => React.createElement(tag, props),
});
export const AnimatePresence = ({ children }: any) => <>{children}</>;
export const useAnimation = () => ({ start: jest.fn() });
export const useInView = () => [null, false];
