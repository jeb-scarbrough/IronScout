import { NextResponse } from 'next/server'
import { prisma } from '@ironscout/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Password validation following modern security best practices
    // Per NIST SP 800-63B and OWASP recommendations:
    // - Minimum length: 8 characters (recommend 15+)
    // - Maximum length: At least 64 characters (we allow 128)
    // - No complexity requirements (no forced mix of character types)
    // - Allow all printable ASCII and Unicode characters

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long (15+ recommended for better security)' },
        { status: 400 }
      )
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: 'Password must not exceed 128 characters' },
        { status: 400 }
      )
    }

    // No restrictions on character types - all printable characters allowed
    // This includes uppercase, lowercase, numbers, symbols, and Unicode characters

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        tier: 'FREE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
      }
    })

    return NextResponse.json(
      { message: 'User created successfully', user },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    )
  }
}
