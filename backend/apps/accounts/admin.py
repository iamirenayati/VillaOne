from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import OTPChallenge, User


@admin.register(User)
class VillaOneUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("VillaOne", {"fields": ("phone", "role", "is_phone_verified")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("VillaOne", {"fields": ("phone", "role")}),)
    list_display = ("phone", "get_full_name", "role", "is_phone_verified", "is_staff", "date_joined")
    search_fields = ("phone", "first_name", "last_name", "email")


@admin.register(OTPChallenge)
class OTPChallengeAdmin(admin.ModelAdmin):
    list_display = ("phone", "created_at", "expires_at", "attempts", "verified_at")
    readonly_fields = ("code_hash", "created_at")
    search_fields = ("phone",)

