import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tier?: string | null
      isAdmin?: boolean
    } & DefaultSession['user']
  }

  interface User {
    tier?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string
    email?: string
  }
}
