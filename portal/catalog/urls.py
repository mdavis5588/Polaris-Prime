from django.urls import path

from . import views

app_name = "catalog"

urlpatterns = [
    path("", views.entry_list, name="list"),
    path("<int:pk>/", views.entry_detail, name="detail"),
]
