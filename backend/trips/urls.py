from django.urls import path
from . import views

urlpatterns = [
    path('plan-trip/', views.plan_trip_view, name='plan-trip'),
]