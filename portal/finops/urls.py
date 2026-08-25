from django.urls import path

from . import views

app_name = "finops"

urlpatterns = [
    path("", views.index, name="index"),
]
