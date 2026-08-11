# Local state is fine for a first `tofu apply` to see this work, but this
# state file will contain the VPN shared key in plaintext (Terraform/OpenTofu
# state is never encrypted at rest by default) — don't commit it, and don't
# leave real deployments on local state. Point this at a remote backend
# before anyone but you touches it:
#
# terraform {
#   backend "azurerm" {
#     resource_group_name  = "tfstate-rg"
#     storage_account_name = "<globally-unique-name>"
#     container_name       = "tfstate"
#     key                  = "azure-hub-spoke.tfstate"
#   }
# }
#
# (Storage account should have versioning + soft delete on, and its own
# access restricted to whoever runs `tofu apply`.)
