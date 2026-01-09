import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClerkAuthService {
  private readonly logger = new Logger(ClerkAuthService.name);
  private readonly clerkClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('CLERK_SECRET_KEY not found. Clerk authentication will be disabled.');
      return;
    }
    
    this.clerkClient = createClerkClient({ secretKey });
    this.logger.log('Clerk authentication service initialized');
  }

  /**
   * Verify the validity of a Clerk JWT token
   */
  async verifyToken(token: string) {
    try {
      if (!this.clerkClient) {
        throw new Error('Clerk client not initialized');
      }
      
      // Decode the token to see its content (without verification)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          this.logger.debug('Token payload preview:', {
            iss: payload.iss,
            aud: payload.aud,
            kid: payload.kid,
            exp: payload.exp,
          });
        }
      } catch (decodeError) {
        this.logger.debug('Could not decode token for preview:', decodeError.message);
      }

      const verifiedToken = await this.clerkClient.verifyToken(token);
      return verifiedToken;
    } catch (error) {
      this.logger.debug('Clerk token verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Get user information via Clerk
   */
  async getUser(userId: string) {
    try {
      if (!this.clerkClient) {
        throw new Error('Clerk client not initialized');
      }

      const user = await this.clerkClient.users.getUser(userId);
      
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;
      
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: fullName,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    } catch (error) {
      this.logger.error(`Failed to get user ${userId} from Clerk:`, error.message);
      throw error;
    }
  }

  /**
   * Check if the Clerk service is available
   */
  isAvailable(): boolean {
    return !!this.clerkClient;
  }

  /**
   * Validate a password according to Clerk criteria (public method)
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Le mot de passe doit contenir au moins 8 caractères');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une majuscule');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une minuscule');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*(),.?":{}|<>)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a password according to Clerk criteria (private method)
   */
  private validatePasswordInternal(password: string): { isValid: boolean; errors: string[] } {
    return this.validatePassword(password);
  }

  /**
   * Create a user directly in Clerk
   */
  async createUser(email: string, password?: string, firstName?: string, lastName?: string, fullName?: string) {
    try {
      if (!this.clerkClient) {
        throw new Error('Clerk client not initialized');
      }

      // Validate the password locally before sending to Clerk
      if (password) {
        const passwordValidation = this.validatePasswordInternal(password);
        if (!passwordValidation.isValid) {
          throw new Error(`Invalid password: ${passwordValidation.errors.join(', ')}`);
        }
      }

      // Prepare data according to Clerk API format
      const userData: any = {
        emailAddress: [email], // Clerk expects an array of emails
      };

      // Add the password only if provided
      if (password) {
        userData.password = password;
      }

      // If we have firstName and lastName, use them
      if (firstName) {
        userData.firstName = firstName;
      }
      if (lastName) {
        userData.lastName = lastName;
      }

      // Otherwise, if we have a full name, try to split it
      if (fullName && !firstName && !lastName) {
        const nameParts = fullName.trim().split(' ');
        if (nameParts.length >= 2) {
          userData.firstName = nameParts[0];
          userData.lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          userData.firstName = nameParts[0];
        }
      }

      const user = await this.clerkClient.users.createUser(userData);

      this.logger.log(`User created successfully in Clerk: ${user.id}`);
      return user;
    } catch (error) {
      // More detailed log of Clerk error
      let detailedError = 'No additional error data';
      
      if (error.response) {
        detailedError = error.response;
      } else if (error.errors) {
        detailedError = error.errors;
      } else if (error.meta) {
        detailedError = error.meta;
      }

      // Create a more user-friendly error message
      let userFriendlyMessage = error.message;
      
      if (error.message === 'Unprocessable Entity') {
        userFriendlyMessage = 'Invalid data. Ensure the password meets criteria (8+ characters, uppercase, lowercase, number, special character) and the email is unique.';
      }

      throw new Error(userFriendlyMessage);
    }
  }

  /**
   * Generate a Clerk-compatible JWT token
   */
  async generateUserToken(userId: string) {
    try {
      if (!this.clerkClient) {
        throw new Error('Clerk client not initialized');
      }

      // Get user information from Clerk
      const user = await this.getUser(userId);
      
      // Create or synchronize the user in the local database
      await this.createOrSyncLocalUser(user);
      
      // Return the necessary data to create a local JWT token
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        clerkId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    } catch (error) {
      this.logger.error('Failed to generate token:', error.message);
      throw error;
    }
  }

  /**
   * Create or synchronize a Clerk user in the local database
   */
  private async createOrSyncLocalUser(clerkUser: any) {
    try {
      // Check if the user already exists in the local database
      const existingUser = await this.prisma.user.findUnique({
        where: { clerkId: clerkUser.id }
      });

      if (existingUser) {
        if (existingUser) { throw new ConflictException('Un utilisateur avec cet email existe déjà'); }
      }

      // Create user in local database
      const localUser = await this.prisma.user.create({
        data: {
          email: clerkUser.email,
          name: clerkUser.name || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
          clerkId: clerkUser.id,
          // No local password for Clerk users
        }
      });

      this.logger.log(`Created local user for Clerk ID: ${clerkUser.id}`);
      return localUser;
    } catch (error) {
      this.logger.error('Failed to create/sync local user:', error.message);
      throw error;
    }
  }

  /**
   * Authenticate a user by email
   */
  async authenticateByEmail(email: string) {
    try {
      if (!this.clerkClient) {
        throw new Error('Clerk client not initialized');
      }

      this.logger.debug(`Searching for user with email: ${email}`);

      // Search for the user by email
      const users = await this.clerkClient.users.getUserList({
        emailAddress: [email],
      });

      this.logger.debug(`Found ${users.length} users with email ${email}`);

      if (users.length === 0) {
        throw new Error(`User not found with email: ${email}`);
      }

      const user = users[0];
      this.logger.debug(`Generating token for user: ${user.id}`);
      
      return await this.generateUserToken(user.id);
    } catch (error) {
      this.logger.error('Authentication failed:', {
        email,
        message: error.message,
        clerkError: error.response?.data || error.response || 'No additional error data',
      });
      throw error;
    }
  }

  /**
   * Get the list of users (for testing permissions)
   */
  async getUserList() {
    try {
      if (!this.clerkClient) {
        throw new Error('Clerk client not initialized');
      }

      const users = await this.clerkClient.users.getUserList();
      return users;
    } catch (error) {
      this.logger.error('Failed to get user list:', error.message);
      throw error;
    }
  }
}