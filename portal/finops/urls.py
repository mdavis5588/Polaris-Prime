from django.urls import path

from . import views

app_name = "finops"

urlpatterns = [
    path("", views.index, name="index"),
    path("resource-groups/<int:pk>/", views.resource_group_detail, name="resource_group_detail"),
    path("rates/", views.rate_card, name="rate_card"),
]
