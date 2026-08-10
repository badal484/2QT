export const toast = Object.assign(jest.fn(), {
  success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(), loading: jest.fn(), dismiss: jest.fn(),
});
export const Toaster = () => null;
