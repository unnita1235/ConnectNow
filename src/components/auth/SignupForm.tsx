/**
 * Signup Form Component
 * =============================================================================
 * Registration form with email, username, password, and validation.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { signupSchema, type SignupInput } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Loader2, Mail, Lock, User, Eye, EyeOff, Check, X } from 'lucide-react';

/**
 * Password strength indicator
 */
function PasswordStrength({ password }: { password: string }) {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 15;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd)) score += 15;
    if (/[0-9]/.test(pwd)) score += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 10;

    if (score < 40) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score < 70) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score < 90) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrength(password);

  const requirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
  ];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <Progress value={strength.score} className="h-2 flex-1" />
        <span className={`text-xs font-medium ${
          strength.score < 40 ? 'text-red-500' :
          strength.score < 70 ? 'text-yellow-500' :
          strength.score < 90 ? 'text-blue-500' : 'text-green-500'
        }`}>
          {strength.label}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-1 text-xs">
        {requirements.map((req, i) => (
          <li key={i} className="flex items-center gap-1">
            {req.met ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={req.met ? 'text-green-500' : 'text-muted-foreground'}>
              {req.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      displayName: '',
    },
  });

  const password = watch('password');

  const onSubmit = async (data: SignupInput) => {
    setError(null);

    try {
      // Call signup API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          password: data.password,
          displayName: data.displayName || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Registration failed');
        return;
      }

      // Auto-login after successful registration
      const signInResult = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Registration succeeded but login failed - redirect to login
        router.push('/login?registered=true');
        return;
      }

      // Redirect to channels
      router.push('/channels');
      router.refresh();
    } catch (err) {
      console.error('Signup error:', err);
      setError('Network error. Please check your connection.');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Create an account
        </CardTitle>
        <CardDescription className="text-center">
          Join ConnectNow and start collaborating
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-10"
                autoComplete="email"
                autoFocus
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                className="pl-10"
                autoComplete="username"
                {...register('username')}
              />
            </div>
            {errors.username && (
              <p className="text-sm text-red-500">{errors.username.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              3-30 characters, letters, numbers, and underscores only
            </p>
          </div>

          {/* Display Name Field (optional) */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              Display Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-sm text-red-500">{errors.displayName.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                className="pl-10 pr-10"
                autoComplete="new-password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
            <PasswordStrength password={password || ''} />
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                className="pl-10 pr-10"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          {/* Terms */}
          <p className="text-xs text-center text-muted-foreground">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>

          {/* Login link */}
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default SignupForm;
