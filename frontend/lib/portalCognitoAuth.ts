// Native email/password + TOTP MFA sign-up for the portal — an alternative to the
// Microsoft/Google buttons for contacts whose organization blocks third-party OAuth
// consent app-wide. Uses aws-amplify/auth (already a project dependency) against the
// SAME portal Cognito pool as the federated flow, reconfigured to point at it on every
// call (the pool the root layout's AmplifyProvider configures at module load is the
// INTERNAL app's pool — reconfiguring defensively here, rather than relying on module
// evaluation order, is what keeps the two from fighting over the global Amplify config).
import { Amplify } from 'aws-amplify'
import {
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signIn,
  confirmSignIn,
  fetchAuthSession,
  signOut as amplifySignOut,
} from 'aws-amplify/auth'

function configurePortalAmplify(): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_PORTAL_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_PORTAL_COGNITO_CLIENT_ID!,
      },
    },
  })
}

async function currentIdToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (!token) throw new Error('No session token available')
  return token
}

export async function portalCognitoSignOut(): Promise<void> {
  configurePortalAmplify()
  try {
    await amplifySignOut()
  } catch {
    // Nothing signed in, or the session was already gone — nothing to clean up.
  }
}

export async function portalSignUp(email: string, password: string): Promise<void> {
  configurePortalAmplify()
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email } },
  })
}

export async function portalConfirmSignUp(email: string, code: string): Promise<void> {
  configurePortalAmplify()
  await confirmSignUp({ username: email, confirmationCode: code })
}

export async function portalResendConfirmationCode(email: string): Promise<void> {
  configurePortalAmplify()
  await resendSignUpCode({ username: email })
}

export type PortalSignInOutcome =
  | { status: 'DONE'; idToken: string }
  | { status: 'TOTP_CHALLENGE' }
  | { status: 'TOTP_SETUP_REQUIRED'; sharedSecret: string; otpauthUri: string }

// Either outcome is finished by portalConfirmTotpCode below. Amplify keeps its own
// session state in storage independently of our whubbi_portal_user key, so a leftover
// session (an abandoned half-finished sign-up, or a portal sign-out that only cleared
// our key) would otherwise make signIn() throw UserAlreadyAuthenticatedException —
// hence clearing it first.
export async function portalSignInWithPassword(email: string, password: string): Promise<PortalSignInOutcome> {
  await portalCognitoSignOut()
  configurePortalAmplify()
  const result = await signIn({ username: email, password })

  if (result.isSignedIn) {
    return { status: 'DONE', idToken: await currentIdToken() }
  }

  switch (result.nextStep.signInStep) {
    case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
      return { status: 'TOTP_CHALLENGE' }
    case 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP': {
      const details = result.nextStep.totpSetupDetails
      return {
        status: 'TOTP_SETUP_REQUIRED',
        sharedSecret: details.sharedSecret,
        otpauthUri: details.getSetupUri('WHUBBI Portal', email).toString(),
      }
    }
    default:
      throw new Error(`Unexpected sign-in step: ${result.nextStep.signInStep}`)
  }
}

// Answers BOTH TOTP challenges — first-time enrollment
// (CONTINUE_SIGN_IN_WITH_TOTP_SETUP) and a returning user's code
// (CONFIRM_SIGN_IN_WITH_TOTP_CODE) — because Amplify completes both the same way, by
// responding to the pending sign-in challenge. Notably NOT verifyTOTPSetup(), which is
// for an already-signed-in user enrolling MFA after the fact and fails mid-sign-in with
// "User needs to be authenticated to call this API".
export async function portalConfirmTotpCode(code: string): Promise<string> {
  configurePortalAmplify()
  const result = await confirmSignIn({ challengeResponse: code })
  if (!result.isSignedIn) throw new Error('Incorrect code — please try again.')
  return currentIdToken()
}
