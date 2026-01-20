 
/**
 * Placeholder token service.
 * Provides an overridable hook so controllers can clear cached tokens
 * without hard dependencies on a specific implementation.
 */
export const tokenService: {
  clearTokensForUser?: (userId: string) => Promise<void> | void;
} = {
  clearTokensForUser: async () => {
    // No-op: implement token blacklist/cleanup when ready.
  },
};
