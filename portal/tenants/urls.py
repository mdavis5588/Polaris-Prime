from django.urls import path

from . import views

app_name = "tenants"

urlpatterns = [
    path("switch/", views.switch_tenant, name="switch"),
]
