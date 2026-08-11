variable "prefix" {
  type        = string
  description = "Short name prefix applied to every resource (e.g. \"orion\")."
}

variable "location" {
  type        = string
  default     = "eastus"
  description = "Azure region for the hub and, by default, every spoke."
}

variable "hub_address_prefix" {
  type        = string
  description = <<-EOT
    CIDR for the Virtual WAN hub's own routing infrastructure (Microsoft
    reserves this range for the hub's internal use — it is never reachable
    from on-prem or any spoke as an address space to route to). Minimum
    /24. Must not overlap the on-prem CIDR or any spoke's address space.
  EOT
}

variable "onprem" {
  description = <<-EOT
    The single flat on-prem VLAN tenant, and the VPN link Azure uses to
    reach it.
  EOT
  type = object({
    address_cidrs = list(string)
    link = object({
      name           = string
      ip_address     = optional(string)
      fqdn           = optional(string)
      provider_name  = optional(string)
      speed_in_mbps  = optional(number, 50)
      bandwidth_mbps = optional(number, 50)
      shared_key     = string
    })
  })

  validation {
    condition     = var.onprem.link.ip_address != null || var.onprem.link.fqdn != null
    error_message = "onprem.link needs either ip_address or fqdn set — that's how Azure finds your on-prem VPN device."
  }
}

variable "spokes" {
  description = <<-EOT
    Each Azure area to spin up, keyed by a short id (e.g. a tenant or
    environment name). `tier` controls reachability via the hub route
    tables — see README.md:
      - "isolated":    reaches nothing, and nothing reaches it (not even on-prem)
      - "onprem_only": on-prem only, invisible to every other spoke
      - "shared":      on-prem, plus every other "shared"-tier spoke
  EOT
  type = map(object({
    resource_group_name   = optional(string) # defaults to "<prefix>-<key>-rg"
    address_space          = list(string)
    subnet_address_prefix  = string
    tier                   = string
  }))
  default = {}

  validation {
    condition     = alltrue([for s in values(var.spokes) : contains(["isolated", "onprem_only", "shared"], s.tier)])
    error_message = "Each spoke's tier must be one of: isolated, onprem_only, shared."
  }
}
