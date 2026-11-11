/**
 * Supabase client stub: Offline fallback.
 * The application has migrated to native MongoDB Atlas.
 */
export const supabase = {
  auth: {
    getSession: async (): Promise<{ data: { session: any }; error: any }> => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async (): Promise<{ data: any; error: any }> => ({ data: null, error: null }),
    signInWithOAuth: async (): Promise<{ error: any }> => ({ error: null }),
    getUser: async (): Promise<{ data: { user: any }; error: any }> => ({ data: { user: null }, error: null }),
    oauth: {
      getAuthorizationDetails: async (_id: string): Promise<{ data: any; error: any }> => ({ data: null, error: null }),
      approveAuthorization: async (_id: string): Promise<{ data: any; error: any }> => ({ data: null, error: null }),
      denyAuthorization: async (_id: string): Promise<{ data: any; error: any }> => ({ data: null, error: null }),
    },
  },
  from: (_table: string) => ({
    select: () => Promise.resolve<{ data: any[]; error: any }>({ data: [], error: null }),
    insert: (_payload?: any) => ({
      execute: () => Promise.resolve<{ data: any[] }>({ data: [] }),
      select: () => ({
        single: () => ({
          execute: () => Promise.resolve<{ data: any }>({ data: null }),
        }),
      }),
    }),
    update: (_payload?: any) => ({
      eq: (_col: string, _val: any) => ({
        execute: () => Promise.resolve<{ data: any[] }>({ data: [] }),
      }),
    }),
    delete: () => ({
      eq: (_col: string, _val: any) => ({
        execute: () => Promise.resolve<{ data: any[] }>({ data: [] }),
        select: () => Promise.resolve<{ data: any[]; error: any }>({ data: [], error: null }),
      }),
      neq: (_col: string, _val: any) => ({
        execute: () => Promise.resolve<{ data: any[] }>({ data: [] }),
      }),
    }),
  }),
};
