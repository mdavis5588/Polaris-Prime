"""
NetBox client — VLANs/prefixes via NetBox core IPAM, NSG-equivalent
access lists via the community netbox-acls plugin. Ported from the
earlier Node version's netboxClient.ts.

IMPORTANT: netbox-acls is a third-party plugin, not NetBox core — its
exact field names can vary by version and aren't something this codebase
can verify against a live instance. The shapes below match the plugin's
documented API as of its stable releases; if your NetBox instance rejects
a field name here, check GET /api/plugins/access-lists/ (or its
Swagger/OpenAPI schema at /api/schema/) against what's below and adjust.
"""

from dataclasses import dataclass

import requests
from django.conf import settings

from .base import ProviderNotConfigured, RuleSpec

NOT_CONFIGURED = (
    "On-prem networking requires NETBOX_BASE_URL, NETBOX_API_TOKEN, "
    "NETBOX_VLAN_GROUP_ID, and NETBOX_PARENT_PREFIX_ID to be set — it "
    "provisions VLANs and NSG-equivalent access lists via NetBox."
)

_PROTOCOL_MAP = {"tcp": "tcp", "udp": "udp", "*": ""}


@dataclass
class NetBoxSettings:
    base_url: str
    api_token: str
    vlan_group_id: int
    vlan_id_range_start: int
    vlan_id_range_end: int
    parent_prefix_id: int
    prefix_length: int


def read_netbox_settings() -> NetBoxSettings:
    if not (settings.NETBOX_BASE_URL and settings.NETBOX_API_TOKEN and settings.NETBOX_VLAN_GROUP_ID and settings.NETBOX_PARENT_PREFIX_ID):
        raise ProviderNotConfigured(NOT_CONFIGURED)
    return NetBoxSettings(
        base_url=settings.NETBOX_BASE_URL.rstrip("/"),
        api_token=settings.NETBOX_API_TOKEN,
        vlan_group_id=int(settings.NETBOX_VLAN_GROUP_ID),
        vlan_id_range_start=settings.NETBOX_VLAN_ID_RANGE_START,
        vlan_id_range_end=settings.NETBOX_VLAN_ID_RANGE_END,
        parent_prefix_id=int(settings.NETBOX_PARENT_PREFIX_ID),
        prefix_length=settings.NETBOX_PREFIX_LENGTH,
    )


class NetBoxClient:
    def __init__(self, netbox_settings: NetBoxSettings):
        self._s = netbox_settings

    def _request(self, method: str, path: str, **kwargs):
        response = requests.request(
            method,
            f"{self._s.base_url}{path}",
            headers={"Authorization": f"Token {self._s.api_token}", "Content-Type": "application/json"},
            timeout=15,
            **kwargs,
        )
        if not response.ok:
            raise RuntimeError(f"NetBox request failed ({response.status_code} {path}): {response.text}")
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    def _next_available_vid(self) -> int:
        """
        NetBox has no built-in "next available VLAN ID" endpoint (unlike
        prefixes, which do), so this lists what's already used in the
        configured group and picks the lowest free id in the configured
        range. Good enough for this volume of VLAN creation; races
        between concurrent requests aren't handled (NetBox will reject a
        duplicate vid with a 400).
        """
        data = self._request("GET", f"/api/ipam/vlans/?group_id={self._s.vlan_group_id}&limit=0")
        used = {v["vid"] for v in data["results"]}
        for vid in range(self._s.vlan_id_range_start, self._s.vlan_id_range_end + 1):
            if vid not in used:
                return vid
        raise RuntimeError(f"No free VLAN id in range {self._s.vlan_id_range_start}-{self._s.vlan_id_range_end}")

    def list_vlans(self, site_id: int | None) -> list[dict]:
        """
        Every VLAN in the configured group, scoped to site_id when given
        — the shared NetBox instance's site is what scopes VLANs to a
        tenant here, the same role Azure RBAC plays for the Azure
        provider's list_resource_groups.
        """
        query = f"/api/ipam/vlans/?group_id={self._s.vlan_group_id}&limit=0"
        if site_id is not None:
            query += f"&site_id={site_id}"
        return self._request("GET", query)["results"]

    def create_vlan(self, name: str, site_id: int | None) -> dict:
        vid = self._next_available_vid()
        return self._request(
            "POST",
            "/api/ipam/vlans/",
            json={"vid": vid, "name": name, "group": self._s.vlan_group_id, "site": site_id, "status": "active"},
        )

    def delete_vlan(self, vlan_id: int) -> None:
        self._request("DELETE", f"/api/ipam/vlans/{vlan_id}/")

    def allocate_prefix_for_vlan(self, vlan_id: int) -> dict:
        """Carves the next available /prefix_length subnet out of the configured parent prefix, then attaches it to the given VLAN."""
        carved = self._request(
            "POST",
            f"/api/ipam/prefixes/{self._s.parent_prefix_id}/available-prefixes/",
            json=[{"prefix_length": self._s.prefix_length}],
        )[0]
        return self._request("PATCH", f"/api/ipam/prefixes/{carved['id']}/", json={"vlan": vlan_id})

    def delete_prefix(self, prefix_id: int) -> None:
        self._request("DELETE", f"/api/ipam/prefixes/{prefix_id}/")

    def create_access_list(self, name: str, vlan_id: int) -> dict:
        return self._request(
            "POST",
            "/api/plugins/access-lists/access-lists/",
            json={
                "name": name,
                "assigned_object_type": "ipam.vlan",
                "assigned_object_id": vlan_id,
                "type": "extended",
                "default_action": "deny",
            },
        )

    def delete_access_list(self, access_list_id: int) -> None:
        self._request("DELETE", f"/api/plugins/access-lists/access-lists/{access_list_id}/")

    def create_access_list_rule(self, access_list_id: int, rule: RuleSpec) -> dict:
        return self._request(
            "POST",
            "/api/plugins/access-lists/access-list-rules/",
            json={
                "access_list": access_list_id,
                "index": rule.priority,
                "description": rule.name,
                "action": "permit" if rule.access == "allow" else "deny",
                "protocol": _PROTOCOL_MAP.get(rule.protocol) or None,
                "source_prefix": None if rule.source_address_prefix == "*" else rule.source_address_prefix,
                "source_ports": None if rule.source_port_range == "*" else [rule.source_port_range],
                "destination_prefix": None if rule.destination_address_prefix == "*" else rule.destination_address_prefix,
                "destination_ports": None if rule.destination_port_range == "*" else [rule.destination_port_range],
            },
        )

    def delete_access_list_rule_by_name(self, access_list_id: int, rule_name: str) -> None:
        """netbox-acls rules aren't addressed by name, so removing one means finding it first by its description field, which create_access_list_rule sets to the rule's name."""
        data = self._request("GET", f"/api/plugins/access-lists/access-list-rules/?access_list_id={access_list_id}&limit=0")
        match = next((r for r in data["results"] if r.get("description") == rule_name), None)
        if not match:
            raise RuntimeError(f'No access list rule named "{rule_name}" found on access list {access_list_id}')
        self._request("DELETE", f"/api/plugins/access-lists/access-list-rules/{match['id']}/")
