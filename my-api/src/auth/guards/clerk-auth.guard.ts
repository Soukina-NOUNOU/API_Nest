import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ClerkAuthService } from '../clerk-auth.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private readonly clerkAuthService: ClerkAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }

    if (!this.clerkAuthService.isAvailable()) {
      throw new UnauthorizedException('Service d\'authentification Clerk non disponible');
    }

    try {
      // Check Token with Clerk
      const verifiedToken = await this.clerkAuthService.verifyToken(token);
      
      if (!verifiedToken.sub) {
        throw new UnauthorizedException('Token invalide');
      }

      // Get user information via Clerk
      const user = await this.clerkAuthService.getUser(verifiedToken.sub);
      
      // Add user information to the request
      request.user = {
        clerkId: user.id,
        email: user.email,
        name: user.name,
      };

      return true;
    } catch (error) {
      this.logger.error('Clerk authentication failed:', error.message);
      throw new UnauthorizedException('Authentification échouée');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}