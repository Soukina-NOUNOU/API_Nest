import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ClerkAuthService } from './clerk-auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserDto } from 'src/users/dto/user.dto';
import {
  CacheInterceptor,
  CacheInvalidateInterceptor,
  Cache,
  NoCache,
  CacheKey,
} from '../common';

@Controller('auth')
@UseInterceptors(CacheInterceptor, CacheInvalidateInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  @Post('signup')
  @NoCache() // Don't cache signup operations
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto.email, dto.password, dto.name);
  }

  @Post('login')
  @NoCache() // Don't cache login operations
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('clerk/signup')
  async clerkSignup(@Body() dto: SignupDto & { firstName?: string; lastName?: string }) {
    try {
      if (!this.clerkAuthService.isAvailable()) {
        return { error: 'Clerk service not available' };
      }

      const clerkUser = await this.clerkAuthService.createUser(
        dto.email,
        dto.password,
        dto.firstName,
        dto.lastName,
        dto.name // If name is provided directly
      );

      // Generate a token for the created user
      const tokenData = await this.clerkAuthService.generateUserToken(clerkUser.id);
      
      // Create a JWT token with the Clerk user data
      const clerkBasedToken = this.authService.generateToken({
        sub: tokenData.userId,
        email: tokenData.email,
        clerkId: tokenData.clerkId,
        name: tokenData.name,
        iss: 'clerk-integration', // Identification of this token as coming from Clerk
        clerk_user: true,
      });

      return {
        success: true,
        user: {
          id: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          clerkId: clerkUser.id,
        },
        // JWT token based on Clerk data
        access_token: clerkBasedToken,
        tokenType: 'clerk-based-jwt',
        message: 'User successfully created in Clerk',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('clerk/login')
  async clerkLogin(@Body() dto: { email: string }) {
    try {
      if (!this.clerkAuthService.isAvailable()) {
        return { error: 'Clerk service not available' };
      }

      const tokenData = await this.clerkAuthService.authenticateByEmail(dto.email);
      
      // Create a JWT token with the validated Clerk data
      const clerkBasedToken = this.authService.generateToken({
        sub: tokenData.userId,
        email: tokenData.email,
        clerkId: tokenData.clerkId,
        name: tokenData.name,
        iss: 'clerk-integration', // Identification of this token as coming from Clerk
        clerk_user: true,
      });

      return {
        success: true,
        user: tokenData,
        // JWT token based on validated Clerk data
        access_token: clerkBasedToken,
        tokenType: 'clerk-based-jwt',
        message: 'Clerk authentication successful',
        note: 'JWT token generated with validated Clerk data',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @Cache.Short() // Cache profile for 5 minutes
  @CacheKey('user:auth:profile::userId')
  getProfile(@CurrentUser() user: UserDto) {
    return user;
  }

  @Get('clerk/profile')
  @UseGuards(JwtAuthGuard)
  @Cache.Short() // Cache clerk profile for 5 minutes  
  @CacheKey('user:clerk:profile::userId')
  getClerkProfile(@CurrentUser() user: any) {
    return {
      message: 'Authentifié via Clerk (données validées)',
      user: {
        id: user.id,
        clerkId: user.sub, // The Clerk ID is in the sub of the token
        email: user.email,
        name: user.name,
        isClerkUser: user.clerk_user || false,
        tokenType: 'clerk-based-jwt',
      },
      note: 'Utilisateur authentifié avec données provenant de Clerk',
    };
  }

  @Get('clerk/check-permissions')
  async checkClerkPermissions() {
    try {
      if (!this.clerkAuthService.isAvailable()) {
        return { error: 'Clerk service not available' };
      }

      // Test fetching user list to verify permissions
      const users = await this.clerkAuthService.getUserList();
      
      return {
        success: true,
        message: 'Permissions Clerk OK',
        userCount: users.length,
        canCreateUsers: true,
        note: 'Votre clé secrète Clerk a les bonnes permissions',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Problème avec les permissions Clerk',
        help: 'Vérifiez que votre CLERK_SECRET_KEY est correcte et a les permissions nécessaires',
      };
    }
  }

  @Post('clerk/validate-password')
  validatePassword(@Body() { password }: { password: string }) {
    return this.clerkAuthService.validatePassword(password);
  }
}
