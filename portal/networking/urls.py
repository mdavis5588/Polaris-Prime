from django.urls import path

from . import views

app_name = "networking"

urlpatterns = [
    path("", views.index, name="index"),
    path("resource-groups/create/", views.resource_group_create, name="resource_group_create"),
    path("resource-groups/sync/<str:target>/", views.resource_group_sync, name="resource_group_sync"),
    path("resource-groups/<int:pk>/", views.resource_group_detail, name="resource_group_detail"),
    path("resource-groups/<int:pk>/delete/", views.resource_group_delete, name="resource_group_delete"),
    path("resource-groups/<int:rg_pk>/subnets/create/", views.subnet_create, name="subnet_create"),
    path("resource-groups/<int:rg_pk>/subnets/<int:pk>/delete/", views.subnet_delete, name="subnet_delete"),
    path("resource-groups/<int:rg_pk>/nsgs/create/", views.nsg_create, name="nsg_create"),
    path("resource-groups/<int:rg_pk>/nsgs/<int:pk>/", views.nsg_detail, name="nsg_detail"),
    path("resource-groups/<int:rg_pk>/nsgs/<int:pk>/delete/", views.nsg_delete, name="nsg_delete"),
    path("resource-groups/<int:rg_pk>/nsgs/<int:nsg_pk>/rules/create/", views.rule_create, name="rule_create"),
    path("resource-groups/<int:rg_pk>/nsgs/<int:nsg_pk>/rules/<int:pk>/delete/", views.rule_delete, name="rule_delete"),
    path("resource-groups/<int:rg_pk>/deployments/create/", views.deployment_create, name="deployment_create"),
    path("resource-groups/<int:rg_pk>/deployments/<int:pk>/delete/", views.deployment_delete, name="deployment_delete"),
]
