export const useRouter = () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), pathname: '/' });
export const usePathname = () => '/';
export const useSearchParams = () => ({ get: jest.fn() });
export const redirect = jest.fn();
