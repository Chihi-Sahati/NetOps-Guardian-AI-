import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthManager, AuditLogger, RateLimiter } from '@/lib/security/zero-trust';
import crypto from 'crypto';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, ipAddress, userAgent } = body;

    // Rate limiting
    const rateCheck = RateLimiter.checkRateLimit(email);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        lockoutRemaining: rateCheck.lockoutRemaining,
        timestamp: new Date(),
      }, { status: 429 });
    }

    // Find user
    const user = await db.user.findUnique({ where: { email } });
    
    if (!user || !user.isActive) {
      RateLimiter.recordAttempt(email);
      await AuditLogger.log({
        action: 'login',
        result: 'failure',
        ipAddress,
        userAgent,
        details: { email, reason: 'invalid_credentials' },
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date(),
      }, { status: 401 });
    }

    // Verify password (in production, use bcrypt)
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password + process.env.AUTH_SECRET || 'default-secret')
      .digest('hex');

    const storedPassword = await db.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });

    if (!storedPassword || storedPassword.password !== hashedPassword) {
      RateLimiter.recordAttempt(email);
      await AuditLogger.log({
        userId: user.id,
        action: 'login',
        result: 'failure',
        ipAddress,
        userAgent,
        details: { email, reason: 'invalid_password' },
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date(),
      }, { status: 401 });
    }

    // Create session
    const token = await AuthManager.createSession(user.id, ipAddress, userAgent);
    
    // Clear rate limit
    RateLimiter.clearAttempts(email);
    
    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Audit log
    await AuditLogger.log({
      userId: user.id,
      action: 'login',
      result: 'success',
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      message: 'Login successful',
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Login failed',
      timestamp: new Date(),
    }, { status: 500 });
  }
}

// DELETE /api/auth/logout
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      await AuthManager.revokeSession(token);
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Logout failed',
      timestamp: new Date(),
    }, { status: 500 });
  }
}

// GET /api/auth/verify
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No token provided',
        timestamp: new Date(),
      }, { status: 401 });
    }

    const result = await AuthManager.validateSession(token);
    
    if (!result.valid) {
      return NextResponse.json({
        success: false,
        error: result.error,
        timestamp: new Date(),
      }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: result.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({
      success: true,
      data: { user },
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Token verification failed',
      timestamp: new Date(),
    }, { status: 500 });
  }
}
