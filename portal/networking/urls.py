from django.urls import path

from . import views

app_name = "networking"

urlpatterns = [
    path("", views.index, name="index"),
]
