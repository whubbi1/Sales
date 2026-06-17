// lib/amplifyConfig.ts
// Configuration AWS Amplify pour Cognito

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!.replace('https://', ''),
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [
            'http://localhost:3000/auth/callback',
            'https://dev.whubbi.wcomply.com/auth/callback',
          ],
          redirectSignOut: [
            'http://localhost:3000',
            'https://dev.whubbi.wcomply.com',
          ],
          responseType: 'code' as const,
        },
      },
    },
  },
}
