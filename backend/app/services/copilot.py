# backend/app/services/copilot.py
# Intégration Microsoft Copilot / Azure OpenAI pour WCOMPLY

import httpx
import os
from typing import Optional

AZURE_OPENAI_ENDPOINT   = os.getenv("AZURE_OPENAI_ENDPOINT")   # ex: https://wcomply.openai.azure.com/
AZURE_OPENAI_API_KEY    = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4")
AZURE_OPENAI_API_VERSION = "2024-02-15-preview"

SYSTEM_PROMPT = """Tu es l'assistant IA de WCOMPLY, une application de gestion commerciale.
Tu aides les commerciaux à :
- Analyser leurs opportunités et pipeline de vente
- Préparer des emails et communications clients
- Résumer les informations clients importantes
- Suggérer des actions commerciales pertinentes
- Analyser les données de performance commerciale

Réponds toujours de façon concise, professionnelle et orientée vers l'action.
Utilise le contexte fourni sur les clients et opportunités pour personnaliser tes réponses.
"""

async def chat_with_copilot(
    message: str,
    history: Optional[list[dict]] = None,
    context: Optional[dict] = None,
    access_token: Optional[str] = None,  # Token MS Copilot si disponible
) -> dict:
    """
    Envoyer un message à Microsoft Copilot (via Azure OpenAI).
    
    Args:
        message:      Message de l'utilisateur
        history:      Historique de conversation [{"role": "user"|"assistant", "content": "..."}]
        context:      Données contextuelles (client, opportunité, emails récents...)
        access_token: Token Microsoft pour Copilot natif (optionnel)
    
    Returns:
        {"response": str, "suggestions": list[str]}
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Injecter le contexte métier si disponible
    if context:
        context_msg = _build_context_message(context)
        messages.append({"role": "system", "content": context_msg})

    # Historique de conversation
    if history:
        messages.extend(history[-10:])  # Garder les 10 derniers échanges

    messages.append({"role": "user", "content": message})

    # ── Option 1 : Microsoft Copilot natif (si token dispo) ─────────────────
    if access_token:
        return await _call_ms_copilot(messages, access_token)

    # ── Option 2 : Azure OpenAI (fallback) ───────────────────────────────────
    return await _call_azure_openai(messages)

async def _call_azure_openai(messages: list[dict]) -> dict:
    """Appel Azure OpenAI."""
    url = (
        f"{AZURE_OPENAI_ENDPOINT}openai/deployments/{AZURE_OPENAI_DEPLOYMENT}"
        f"/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={
                "api-key":      AZURE_OPENAI_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "messages":    messages,
                "max_tokens":  1000,
                "temperature": 0.7,
            },
        )
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    return {
        "response":    content,
        "suggestions": _extract_suggestions(content),
        "model":       data.get("model", AZURE_OPENAI_DEPLOYMENT),
    }

async def _call_ms_copilot(messages: list[dict], access_token: str) -> dict:
    """Appel Microsoft Copilot via Graph API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://graph.microsoft.com/v1.0/copilot/chat",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            },
            json={"messages": messages},
        )
        response.raise_for_status()
        data = response.json()

    content = data.get("message", {}).get("content", "")
    return {
        "response":    content,
        "suggestions": _extract_suggestions(content),
        "model":       "microsoft-copilot",
    }

def _build_context_message(context: dict) -> str:
    """Construire un message de contexte métier pour Copilot."""
    parts = ["Contexte commercial actuel :"]

    if client := context.get("client"):
        parts.append(f"- Client : {client.get('name')} ({client.get('company')})")
        parts.append(f"  Secteur : {client.get('sector', 'N/A')}")
        parts.append(f"  Dernier contact : {client.get('last_contact', 'N/A')}")

    if opportunity := context.get("opportunity"):
        parts.append(f"- Opportunité : {opportunity.get('title')}")
        parts.append(f"  Valeur : {opportunity.get('value', 0):,.0f} €")
        parts.append(f"  Étape : {opportunity.get('stage')}")
        parts.append(f"  Probabilité : {opportunity.get('probability', 0)}%")

    if recent_emails := context.get("recent_emails"):
        parts.append(f"- {len(recent_emails)} emails récents avec ce client")

    return "\n".join(parts)

def _extract_suggestions(content: str) -> list[str]:
    """Extraire des suggestions d'actions depuis la réponse Copilot."""
    # Simple extraction — à améliorer avec un prompt structuré
    suggestions = []
    lines = content.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith(("- ", "• ", "→ ", "* ")):
            suggestions.append(line[2:].strip())
    return suggestions[:3]  # Maximum 3 suggestions


async def analyze_opportunity(opportunity_data: dict) -> dict:
    """Analyser une opportunité commerciale avec Copilot."""
    prompt = f"""Analyse cette opportunité commerciale et donne des recommandations :

Titre : {opportunity_data.get('title')}
Client : {opportunity_data.get('client_name')}
Valeur : {opportunity_data.get('value', 0):,.0f} €
Étape : {opportunity_data.get('stage')}
Probabilité : {opportunity_data.get('probability', 0)}%
Notes : {opportunity_data.get('notes', 'Aucune note')}

Fournis :
1. Une évaluation du potentiel (1-5)
2. Les 3 prochaines actions recommandées
3. Les risques identifiés
4. Un résumé en 2 phrases pour un manager"""

    return await chat_with_copilot(prompt)
