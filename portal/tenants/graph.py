"""
Microsoft Graph app-only (client credentials) calls to check a user's
Azure AD group membership live — ported from the earlier Node version's
graphClient.ts. Requires GRAPH_CLIENT_ID/SECRET/TENANT_ID (see settings.py)
to have the GroupMember.Read.All (or Directory.Read.All) Graph API
APPLICATION permission, admin-consented in the Azure AD tenant.
"""

import time

import requests
from django.conf import settings

_token_cache: dict = {"token": None, "expires_at": 0.0}


class GraphNotConfigured(RuntimeError):
    pass


def _get_graph_app_token() -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 30:
        return _token_cache["token"]

    tenant_id = settings.GRAPH_TENANT_ID
    client_id = settings.GRAPH_CLIENT_ID
    client_secret = settings.GRAPH_CLIENT_SECRET
    if not (tenant_id and client_id and client_secret):
        raise GraphNotConfigured(
            "Microsoft Graph app credentials are not configured — set "
            "AZURE_AD_GRAPH_CLIENT_ID, AZURE_AD_GRAPH_CLIENT_SECRET, and "
            "AZURE_AD_TENANT_ID."
        )

    response = requests.post(
        f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + float(data["expires_in"])
    return _token_cache["token"]


def get_user_group_ids(ad_object_id: str) -> list[str]:
    """Returns the Azure AD group object ids the given user directly belongs to."""
    token = _get_graph_app_token()
    response = requests.get(
        f"https://graph.microsoft.com/v1.0/users/{ad_object_id}/memberOf",
        params={"$select": "id"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return [item["id"] for item in data.get("value", []) if "id" in item]
