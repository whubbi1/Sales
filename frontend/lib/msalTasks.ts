// lib/msalTasks.ts
// Client-side Microsoft sign-in used ONLY to create a task in the user's own
// Outlook (Microsoft To Do) when they opt in from the Sales Tasks feature.
// Microsoft's To Do API is delegated-only (no application-permission path),
// so this has to run as a short-lived popup sign-in from the browser rather
// than a backend-triggered call like the rest of the app's Graph integrations.
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'

// Same Azure AD app registration already used for every other Graph call in
// this app (backend/app/routers/microsoft.py) — client/tenant IDs are public
// identifiers, not secrets. Requires the app registration to have a
// Single-page application redirect URI for this origin and the delegated
// Tasks.ReadWrite permission consented; if either is missing, the popup will
// surface a clear Azure AD error.
const TENANT_ID = 'f4e85ba0-6103-4a2b-a0d3-9bb3bb43b9ca'
const CLIENT_ID = 'fa03d40b-fa3c-4a66-9902-22128558fd78'
const SCOPES = ['Tasks.ReadWrite']

let msalInstance: PublicClientApplication | null = null
let initPromise: Promise<void> | null = null

function getInstance() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      cache: { cacheLocation: 'sessionStorage' },
    })
    initPromise = msalInstance.initialize()
  }
  return msalInstance
}

export function isMsalConfigured() {
  return typeof window !== 'undefined'
}

async function getAccessToken(): Promise<string> {
  const instance = getInstance()
  await initPromise

  const accounts = instance.getAllAccounts()
  if (accounts.length > 0) {
    try {
      const result = await instance.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] })
      return result.accessToken
    } catch (e) {
      if (!(e instanceof InteractionRequiredAuthError)) throw e
    }
  }

  const result = await instance.loginPopup({ scopes: SCOPES })
  return result.accessToken
}

export async function createOutlookTask({ title, description, dueDate }: { title: string; description?: string; dueDate?: string }): Promise<string> {
  const token = await getAccessToken()
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const listsResp = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', { headers })
  if (!listsResp.ok) throw new Error(`Could not read your Outlook task lists (${listsResp.status})`)
  const listsData = await listsResp.json()
  const defaultList = (listsData.value || []).find((l: any) => l.wellknownListName === 'defaultList') || (listsData.value || [])[0]
  if (!defaultList) throw new Error('No Outlook task list found for your account')

  const body: any = { title }
  if (description) body.body = { content: description, contentType: 'text' }
  if (dueDate) body.dueDateTime = { dateTime: `${dueDate}T00:00:00`, timeZone: 'UTC' }

  const createResp = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${defaultList.id}/tasks`, {
    method: 'POST', headers, body: JSON.stringify(body),
  })
  if (!createResp.ok) throw new Error(`Could not create the Outlook task (${createResp.status})`)
  const created = await createResp.json()
  return created.id
}
